import { describe, expect, it } from 'vitest'
import type { IndoorEdge, IndoorGraph, IndoorMovementType, IndoorNode, IndoorRouteCompressionContext } from './indoorRouting'
import { findBestElderlyRoute } from './elderlyRouteScoring'
import { findRoutesFromPlatform, platformOriginNodes } from './indoorRouting'
import { classifyLegacyRouteAgainstTrace, compareCandidateSets, searchMultiObjectiveRoutes, searchPlatformToExitsMultiObjective,
  searchMultiObjectiveRoutesToTargets, traceRouteThroughSearch, isTraversalHistoryAtLeastAsFlexible, dominatesWithTraversalAvailability,
  DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS, isTargetCoverageAtLeastAsBroad } from './multiObjectiveRouting'
import { outingCoursePresets } from '../data/coursePresets'
import { loadedOedo2026IndoorDatasets } from '../data/catalogs/oedo2026IndoorDatasets'
import { buildIndoorGraph } from './indoorRouting'
import { buildRegisteredStationMapCompressionContext } from '../data/stationMaps/registry'
import { computeRouteCost } from './routeCost'

function graphFixture(nodes: Array<Pick<IndoorNode, 'id' | 'kind' | 'levelIndex' | 'parentPlatformId'> & Partial<IndoorNode>>,
  records: Array<[string, string, IndoorMovementType, number]>) {
  const fullNodes: IndoorNode[] = nodes.map(node => ({ id: node.id, name: node.name ?? node.id, latitude: 0, longitude: 0,
    locationType: node.kind === 'platform' ? 1 : node.kind === 'boarding-area' ? 4 : node.kind === 'entrance-exit' ? 2 : 3,
    kind: node.kind, levelIndex: node.levelIndex, parentPlatformId: node.parentPlatformId }))
  const edges: IndoorEdge[] = records.map(([fromNodeId, toNodeId, movementType, lengthMeters], i) => ({
    id: `fictional-path-${i}`, fromNodeId, toNodeId, movementType, lengthMeters, sourceType: 'gtfs-pathways',
  }))
  const graph: IndoorGraph = { stationId: 'fictional-multi-objective', stationName: 'Synthetic station', nodes: new Map(fullNodes.map(node => [node.id, node])),
    edges, adjacency: new Map(fullNodes.map(node => [node.id, edges.filter(edge => edge.fromNodeId === node.id)])),
    source: { name: 'synthetic', url: 'https://example.invalid/gtfs', license: 'test', feedVersion: 'fictional', retrievedAt: 'test' } }
  return graph
}

const N = (id: string, kind: IndoorNode['kind'] = 'internal', levelIndex?: number, parentPlatformId?: string) => ({ id, kind, levelIndex, parentPlatformId })
const sequence = (route: { edges: IndoorEdge[] }) => JSON.stringify(route.edges.map(edge => [edge.id, edge.fromNodeId, edge.toNodeId]))

describe('shadow multi-objective candidate search', () => {
  it('keeps complete candidate traversal sets identical under distance-lower-bound ordering', () => {
    const graph = graphFixture([N('o', 'boarding-area'), N('fork'), N('a', 'entrance-exit'), N('b', 'entrance-exit'), N('loop')], [
      ['o', 'fork', 'walk', 2], ['fork', 'a', 'walk', 3], ['fork', 'b', 'walk', 4],
      ['a', 'loop', 'walk', 1], ['loop', 'fork', 'walk', 1],
    ])
    const current = searchMultiObjectiveRoutesToTargets(graph, 'o', ['a', 'b'])
    const informed = searchMultiObjectiveRoutesToTargets(graph, 'o', ['a', 'b'], { queueOrdering: 'distance-lower-bound' })
    expect(current.complete).toBe(true)
    expect(informed.complete).toBe(true)
    expect(informed.queueOrdering).toBe('distance-lower-bound')
    const keys = (result: typeof current) => Object.values(result.exits).flatMap(exit => exit.candidates.map(c => c.directedTraversalKey)).sort()
    expect(keys(informed)).toEqual(keys(current))
  })

  it('uses destination distance to discover a useful route before a misleading short prefix under a small budget', () => {
    const graph = graphFixture([N('o', 'boarding-area'), N('detour-1'), N('detour-2'), N('detour-3'), N('toward'), N('exit', 'entrance-exit')], [
      ['o', 'detour-1', 'walk', 1], ['detour-1', 'detour-2', 'walk', 1], ['detour-2', 'detour-3', 'walk', 1],
      ['detour-3', 'exit', 'walk', 1000], ['o', 'toward', 'walk', 10], ['toward', 'exit', 'walk', 10],
    ])
    const limits = { maxTotalLabels: 5, maxLabelsPerState: 96, maxCompletedCandidates: 3000, maxExpansions: 150000 }
    const current = searchMultiObjectiveRoutesToTargets(graph, 'o', ['exit'], { limits })
    const informed = searchMultiObjectiveRoutesToTargets(graph, 'o', ['exit'], { limits, queueOrdering: 'distance-lower-bound' })
    expect(current.complete).toBe(false)
    expect(current.exits.exit.candidateDiscovered).toBe(false)
    expect(informed.exits.exit.candidateDiscovered).toBe(true)
    expect(informed.exits.exit.candidates[0].route.distanceMeters).toBe(20)
    expect(informed.firstCandidateAdmittedLabelCount).not.toBeNull()
    expect(informed.firstCandidateExpansionCount).not.toBeNull()
  })

  it('uses invalid lengths only as optimistic heuristic weights and never prunes unreachable targets', () => {
    const graph = graphFixture([N('o', 'boarding-area'), N('mid'), N('reachable', 'entrance-exit'), N('isolated', 'entrance-exit')], [
      ['o', 'mid', 'walk', Number.NaN], ['mid', 'reachable', 'walk', 4],
    ])
    const result = searchMultiObjectiveRoutesToTargets(graph, 'o', ['reachable', 'isolated'], { queueOrdering: 'distance-lower-bound' })
    expect(result.complete).toBe(true)
    expect(result.exits.reachable.candidateDiscovered).toBe(true)
    expect(result.exits.isolated.unreachableProven).toBe(true)
    expect(result.candidateCountsByExit).toEqual({ isolated: 0, reachable: 1 })
  })

  it('multi-target A/C: expands a shared prefix once and preserves each exit identity', () => {
    const graph = graphFixture([N('o', 'boarding-area'), N('common'), N('fork'), N('a', 'entrance-exit'),
      N('b', 'entrance-exit'), N('c', 'entrance-exit')], [
      ['o', 'common', 'walk', 1], ['common', 'fork', 'walk', 1], ['fork', 'a', 'walk', 1],
      ['fork', 'b', 'walk', 2], ['fork', 'c', 'walk', 3],
    ])
    const old = searchMultiObjectiveRoutes(graph, ['o'], ['a', 'b', 'c'], { diagnostics: true })
    const multi = searchMultiObjectiveRoutesToTargets(graph, 'o', ['a', 'b', 'c'], { diagnostics: true })
    expect(multi.complete).toBe(true)
    for (const target of ['a', 'b', 'c']) {
      expect(multi.exits[target].candidates.map(candidate => candidate.targetExitId)).toEqual([target])
      expect(multi.exits[target].candidates[0].directedTraversalKey).toBe(old.candidates.find(candidate => candidate.targetExitId === target)!.directedTraversalKey)
    }
    const commonPrefix = JSON.stringify(graph.edges.slice(0, 1).map(edge => JSON.stringify([edge.id, edge.fromNodeId, edge.toNodeId])))
    const oldAdmissions = old.diagnosticTrace?.filter(event => event.event === 'admitted' && JSON.stringify(event.directedTraversalHistory) === commonPrefix).length
    const newAdmissions = multi.diagnosticTrace?.filter(event => event.event === 'admitted' && JSON.stringify(event.directedTraversalHistory) === commonPrefix).length
    expect(oldAdmissions).toBe(3)
    expect(newAdmissions).toBe(1)
  })

  it('multi-target B: continues after reaching one exit to discover a later exit', () => {
    const graph = graphFixture([N('o', 'boarding-area'), N('a', 'entrance-exit'), N('passage'), N('b', 'entrance-exit')], [
      ['o', 'a', 'walk', 1], ['a', 'passage', 'walk', 1], ['passage', 'b', 'walk', 1],
    ])
    const result = searchMultiObjectiveRoutesToTargets(graph, 'o', ['a', 'b'])
    expect(result.exits.a.candidates).toHaveLength(1)
    expect(result.exits.b.candidates).toHaveLength(1)
    expect(result.exits.b.candidates[0].route.edges.map(edge => edge.toNodeId)).toEqual(['a', 'passage', 'b'])
  })

  it('multi-target D: target-coverage difference cannot alone allow unsafe dominance', () => {
    expect(isTargetCoverageAtLeastAsBroad(new Set(['b']), new Set(['a', 'b']))).toBe(false)
    expect(isTargetCoverageAtLeastAsBroad(new Set(['a', 'b']), new Set(['b']))).toBe(true)
    const graph = graphFixture([N('o', 'boarding-area'), N('a', 'entrance-exit'), N('join'), N('shared'),
      N('b', 'entrance-exit')], [
      ['o', 'a', 'walk', 1], ['a', 'join', 'walk', 1], ['o', 'join', 'stairs', 4],
      ['join', 'shared', 'walk', 1], ['shared', 'b', 'walk', 1],
    ])
    const result = searchMultiObjectiveRoutesToTargets(graph, 'o', ['a', 'b'], { diagnostics: true })
    expect(result.exits.a.candidateDiscovered).toBe(true)
    expect(result.exits.b.candidates.some(candidate => candidate.route.edges.some(edge => edge.toNodeId === 'a'))).toBe(true)
    expect(result.exits.b.candidateDiscovered).toBe(true)
    const exitB = result.exits.b.candidates[0]
    expect(exitB.originBoardingAreaId).toBe('o')
    expect(exitB.targetExitId).toBe('b')
  })

  it('multi-target E: keeps separate ES/EV frontiers and profile selection per exit', () => {
    const graph = graphFixture([N('o', 'boarding-area'), N('fork'), N('a', 'entrance-exit'), N('b', 'entrance-exit')], [
      ['o', 'fork', 'elevator', 80], ['fork', 'a', 'walk', 20], ['o', 'fork', 'escalator', 85], ['fork', 'a', 'walk', 20],
      ['o', 'fork', 'elevator', 90], ['fork', 'b', 'walk', 20], ['o', 'fork', 'escalator', 88], ['fork', 'b', 'walk', 20],
    ])
    const result = searchMultiObjectiveRoutesToTargets(graph, 'o', ['a', 'b'])
    const informed = searchMultiObjectiveRoutesToTargets(graph, 'o', ['a', 'b'], { queueOrdering: 'distance-lower-bound' })
    expect(informed.complete).toBe(true)
    expect(Object.values(informed.exits).flatMap(exit => exit.candidates.map(candidate => candidate.directedTraversalKey)).sort())
      .toEqual(Object.values(result.exits).flatMap(exit => exit.candidates.map(candidate => candidate.directedTraversalKey)).sort())
    for (const target of ['a', 'b']) {
      expect(result.exits[target].frontiers['escalator-preferred'].some(candidate => candidate.route.edges[0].movementType === 'escalator')).toBe(true)
      expect(result.exits[target].frontiers['elevator-preferred'].some(candidate => candidate.route.edges[0].movementType === 'elevator')).toBe(true)
      expect(result.exits[target].selectedByProfile['escalator-preferred']?.route.edges[0].movementType).toBe('escalator')
      expect(result.exits[target].selectedByProfile['elevator-preferred']?.route.edges[0].movementType).toBe('elevator')
      expect(informed.exits[target].frontiers['escalator-preferred'].some(candidate => candidate.route.edges[0].movementType === 'escalator')).toBe(true)
      expect(informed.exits[target].frontiers['elevator-preferred'].some(candidate => candidate.route.edges[0].movementType === 'elevator')).toBe(true)
      expect(result.exits[target].candidates.every(candidate => candidate.targetExitId === target)).toBe(true)
    }
  })

  it('supports opt-in evidence-aware selection without changing candidate discovery', () => {
    const graph = graphFixture([N('board', 'boarding-area'), N('fork'), N('exit', 'entrance-exit')], [
      ['board', 'fork', 'elevator', 80], ['fork', 'exit', 'walk', 20],
      ['board', 'fork', 'escalator', 85], ['fork', 'exit', 'walk', 20],
    ])
    const current = searchMultiObjectiveRoutesToTargets(graph, 'board', ['exit'], { queueOrdering: 'distance-lower-bound' })
    const evidenceAware = searchMultiObjectiveRoutesToTargets(graph, 'board', ['exit'],
      { queueOrdering: 'distance-lower-bound', selectionMode: 'evidence-aware' })
    expect(evidenceAware.candidateCountsByExit).toEqual(current.candidateCountsByExit)
    expect(evidenceAware.complete).toBe(current.complete)
    expect(evidenceAware.exits.exit.selectedByProfile['escalator-preferred']?.route.edges[0].movementType).toBe('escalator')
    expect(evidenceAware.exits.exit.selectedByProfile['elevator-preferred']?.route.edges[0].movementType).toBe('elevator')
  })

  it('multi-target F: cutoff leaves undiscovered exits unknown, not unreachable', () => {
    const graph = graphFixture([N('o', 'boarding-area'), N('a', 'entrance-exit'), N('middle'), N('b', 'entrance-exit')], [
      ['o', 'a', 'walk', 1], ['o', 'middle', 'walk', 2], ['middle', 'b', 'walk', 1],
    ])
    const result = searchMultiObjectiveRoutesToTargets(graph, 'o', ['a', 'b'], { limits: { maxTotalLabels: 2 } })
    expect(result.complete).toBe(false)
    expect(result.exits.a.searchComplete).toBe(false)
    expect(result.exits.b.candidateDiscovered).toBe(false)
    expect(result.exits.b.unreachableProven).toBe(false)
  })

  it('A: discovers stairs 1 / 12m omitted by all four legacy profiles and balanced can choose it', () => {
    const graph = graphFixture([N('board', 'boarding-area'), N('a'), N('b'), N('c'), N('p'), N('exit', 'entrance-exit')], [
      ['board', 'a', 'stairs', 1], ['a', 'p', 'walk', 10],
      ['board', 'b', 'stairs', 2], ['b', 'c', 'stairs', 2], ['c', 'p', 'stairs', 2], ['p', 'exit', 'walk', 1],
    ])
    const legacy = (['shortest', 'avoid-stairs', 'elevator-priority', 'escalator-priority'] as const)
      .flatMap(profile => findRoutesFromPlatform(graph, 'board', 'exit', profile).map(candidate => candidate.route))
    expect(new Set(legacy.map(sequence)).size).toBe(1)
    const result = searchMultiObjectiveRoutes(graph, ['board'], ['exit'])
    expect(result.complete).toBe(true)
    expect(result.candidates.map(candidate => [candidate.searchCost.rawStairTraversals, candidate.searchCost.totalPathwayMeters]))
      .toEqual(expect.arrayContaining([[1, 12], [3, 7]]))
    expect(compareCandidateSets(legacy, result, graph).legacyOnly).toHaveLength(0)
    expect(result.selectedByProfile.balanced?.searchCost.rawStairTraversals).toBe(1)
  })

  it('B/C/I: preserves ES/EV reversals in separate frontiers and avoids the long detour', () => {
    const graph = graphFixture([N('board', 'boarding-area'), N('fork'), N('exit', 'entrance-exit')], [
      ['board', 'fork', 'elevator', 80], ['fork', 'exit', 'walk', 20],
      ['board', 'fork', 'escalator', 85], ['fork', 'exit', 'walk', 20],
      ['board', 'fork', 'escalator', 160], ['fork', 'exit', 'walk', 20],
    ])
    const result = searchMultiObjectiveRoutes(graph, ['board'], ['exit'])
    const shortEV = result.candidates.find(c => c.route.edges[0].movementType === 'elevator')!
    const shortES = result.candidates.find(c => c.route.edges[0].movementType === 'escalator' && c.route.distanceMeters === 105)!
    expect(result.frontiers.balanced.map(c => c.directedTraversalKey)).toEqual(expect.arrayContaining([shortEV.directedTraversalKey, shortES.directedTraversalKey]))
    expect(result.frontiers['escalator-preferred'].map(c => c.directedTraversalKey)).toContain(shortES.directedTraversalKey)
    expect(result.frontiers['elevator-preferred'].map(c => c.directedTraversalKey)).toContain(shortEV.directedTraversalKey)
    expect(result.selectedByProfile['escalator-preferred']?.directedTraversalKey).toBe(shortES.directedTraversalKey)
    expect(result.selectedByProfile['elevator-preferred']?.directedTraversalKey).toBe(shortEV.directedTraversalKey)
    expect(result.selectedByProfile['escalator-preferred']?.route.distanceMeters).not.toBe(180)
  })

  it('D: retains distance/stairs tradeoffs', () => {
    const graph = graphFixture([N('board', 'boarding-area'), N('fork'), N('stair-mid'), N('exit', 'entrance-exit')], [
      ['board', 'fork', 'walk', 149], ['fork', 'exit', 'walk', 1],
      ['board', 'stair-mid', 'stairs', 40], ['stair-mid', 'exit', 'walk', 40],
    ])
    const result = searchMultiObjectiveRoutes(graph, ['board'], ['exit'])
    expect(result.candidates.map(c => [c.searchCost.rawStairTraversals, c.route.distanceMeters])).toEqual(expect.arrayContaining([[0, 150], [1, 80]]))
  })

  it('E: permits a legitimate down-then-up route that revisits a node', () => {
    const graph = graphFixture([N('board', 'boarding-area', -1), N('lower', 'internal', -2), N('exit', 'entrance-exit', -1)], [
      ['board', 'lower', 'elevator', 1], ['lower', 'board', 'stairs', 1], ['board', 'exit', 'walk', 30],
    ])
    const result = searchMultiObjectiveRoutes(graph, ['board'], ['exit'])
    // The returning prefix is admitted: the search does not reject a node merely
    // because it appeared earlier. Its completed loop is later Pareto-dominated.
    expect(result.exploredLabelCount).toBeGreaterThanOrEqual(4)
    const downUp = graphFixture([N('board', 'boarding-area', -1), N('lower', 'internal', -2), N('upper', 'internal', -1), N('exit', 'entrance-exit', 0)], [
      ['board', 'lower', 'elevator', 1], ['lower', 'upper', 'stairs', 1], ['upper', 'exit', 'walk', 1], ['board', 'exit', 'walk', 30],
    ])
    const downThenUp = searchMultiObjectiveRoutes(downUp, ['board'], ['exit']).candidates.find(candidate => candidate.route.edges.length === 3)!
    expect(downThenUp).toBeDefined()
    expect(downThenUp.routeCost.verticalActions.down).toBe(1)
    expect(downThenUp.routeCost.verticalActions.up).toBe(1)
  })

  it('F: zero-cost cycle terminates; edge-simple labels and Pareto state pruning are bounded', () => {
    const graph = graphFixture([N('board', 'boarding-area'), N('u'), N('v'), N('exit', 'entrance-exit')], [
      ['board', 'u', 'walk', 0], ['u', 'v', 'walk', 0], ['v', 'u', 'walk', 0], ['u', 'exit', 'walk', 1],
    ])
    const result = searchMultiObjectiveRoutes(graph, ['board'], ['exit'], { limits: { maxExpansions: 100 } })
    expect(result.complete).toBe(true)
    expect(result.expansionCount).toBeLessThan(100)
    expect(result.candidates.every(candidate => new Set(candidate.route.edges.map(edge => `${edge.id}:${edge.fromNodeId}>${edge.toNodeId}`)).size === candidate.route.edges.length)).toBe(true)
  })

  it('G: search raw edges stay distinct from final semantic EV sessions', () => {
    const graph = graphFixture([N('board', 'boarding-area', -3), N('enter', 'internal', -2), N('lift', 'internal', -2), N('leave', 'internal', -1), N('exit', 'entrance-exit')], [
      ['board', 'enter', 'elevator', 8], ['enter', 'lift', 'walk', 1], ['lift', 'leave', 'elevator', 8], ['leave', 'exit', 'walk', 1],
    ])
    ;['board', 'enter', 'lift', 'leave', 'exit'].forEach((id, index) => { graph.nodes.get(id)!.longitude = 139 + index * 0.0001 })
    const compression: IndoorRouteCompressionContext = { byPathwayId: Object.fromEntries(graph.edges.map(edge => [edge.id, { facilityId: 'mapped-lift' }])),
      nonBranchingNodeIds: new Set(['board', 'enter', 'lift', 'leave']) }
    const result = searchMultiObjectiveRoutes(graph, ['board'], ['exit'], { compressionContext: compression })
    const candidate = result.candidates[0]
    expect(candidate.searchCost.rawElevatorTraversals).toBe(2)
    expect(candidate.routeCost.observedSemanticUses.elevator).toBe(1)
    expect(candidate.routeCost.elevatorUses).toBeNull() // matching Facility is not explicit session proof
    const proof = { firstRouteIndex: 0, lastRouteIndex: 2, instanceKey: 'source-backed-lift', source: 'https://example.invalid/equipment-survey', basis: 'explicit-equipment-session' as const, connectorRouteIndices: [1] }
    const finalized = computeRouteCost(candidate.route, { graph, compression, sessionProofs: [proof] })
    expect(finalized.elevatorUses).toBe(1)
    expect(finalized.equipmentBoardings).toBe(1)
    expect(candidate.searchCost.rawElevatorTraversals).toBe(2)
  })

  it('H: multiple boarding areas, gates and exits keep their identities', () => {
    const graph = graphFixture([N('platform', 'platform'), N('boarding-A', 'boarding-area', undefined, 'platform'), N('boarding-B', 'boarding-area', undefined, 'platform'),
      N('gate-A-in'), N('gate-A-out'), N('gate-B-in'), N('gate-B-out'), N('exit-A', 'entrance-exit'), N('exit-B', 'entrance-exit')], [
      ['boarding-A', 'gate-A-in', 'walk', 1], ['gate-A-in', 'gate-A-out', 'fare-gate', 0], ['gate-A-out', 'exit-A', 'walk', 1],
      ['boarding-B', 'gate-B-in', 'walk', 1], ['gate-B-in', 'gate-B-out', 'fare-gate', 0], ['gate-B-out', 'exit-B', 'walk', 1],
    ])
    const result = searchPlatformToExitsMultiObjective(graph, ['platform'], ['exit-A', 'exit-B'])
    expect(result.candidates).toHaveLength(2)
    expect(new Set(result.candidates.map(c => c.originBoardingAreaId))).toEqual(new Set(['boarding-A', 'boarding-B']))
    expect(new Set(result.candidates.map(c => c.targetExitId))).toEqual(new Set(['exit-A', 'exit-B']))
    expect(new Set(result.candidates.map(candidate => candidate.route.edges.find(edge => edge.movementType === 'fare-gate')!.fromNodeId))).toEqual(new Set(['gate-A-in', 'gate-B-in']))
    expect(result.candidates.every(c => c.routeCost.equipmentInstanceTransfers === 0)).toBe(true)
    expect(platformOriginNodes(graph, 'platform').map(node => node.id)).toEqual(['boarding-A', 'boarding-B'])
  })

  it('J: reports a cutoff as incomplete', () => {
    const graph = graphFixture([N('board', 'boarding-area'), N('exit', 'entrance-exit')], [['board', 'exit', 'walk', 1]])
    const result = searchMultiObjectiveRoutes(graph, ['board'], ['exit'], { limits: { maxExpansions: 0 } })
    expect(result.complete).toBe(false)
    expect(result.cutoffReasons).toContain('maxExpansions')
    expect(result.candidates).toHaveLength(0)
  })

  it('A: preserves a future-flexible prefix when a cheaper label has consumed its required edge', () => {
    const graph = graphFixture([N('v', 'boarding-area'), N('x'), N('p'), N('q'), N('gate-in'), N('gate-out'), N('return'), N('exit', 'entrance-exit')], [
      ['v', 'x', 'walk', 0], // X: the cheap prefix consumes the edge needed after rejoining v
      ['x', 'p', 'walk', 0], ['p', 'gate-in', 'walk', 0], ['gate-in', 'gate-out', 'fare-gate', 0],
      ['gate-out', 'return', 'walk', 0], ['return', 'v', 'walk', 0],
      ['v', 'q', 'stairs', 1], ['q', 'p', 'walk', 1], // more expensive prefix leaves X unused
      ['x', 'exit', 'walk', 1],
    ])
    const result = searchMultiObjectiveRoutes(graph, ['v'], ['exit'], { diagnostics: true })
    const targetRoute = { nodes: ['v', 'q', 'p', 'gate-in', 'gate-out', 'return', 'v', 'x', 'exit'].map(id => graph.nodes.get(id)!),
      edges: [graph.edges[6], graph.edges[7], graph.edges[2], graph.edges[3], graph.edges[4], graph.edges[5], graph.edges[0], graph.edges[8]], distanceMeters: 3 }
    const replay = traceRouteThroughSearch(graph, targetRoute, 'v', 'exit')
    expect(result.complete).toBe(true)
    // This route's B prefix must survive at the convergence state so its next
    // traversal can use X. A may no longer consume B merely by lower cost.
    const edgeXKey = JSON.stringify([graph.edges[0].id, graph.edges[0].fromNodeId, graph.edges[0].toNodeId])
    const prefixB = targetRoute.edges.slice(0, 6).map(edge => JSON.stringify([edge.id, edge.fromNodeId, edge.toNodeId]))
    const retainedB = result.diagnosticTrace!.find(event => event.event === 'admitted' && JSON.stringify(event.directedTraversalHistory) === JSON.stringify(prefixB))
    expect(retainedB).toBeDefined()
    expect(retainedB!.usedDirectedEdges).not.toContain(edgeXKey)
    const prefixA = [graph.edges[0], graph.edges[1], graph.edges[2], graph.edges[3], graph.edges[4], graph.edges[5]]
      .map(edge => JSON.stringify([edge.id, edge.fromNodeId, edge.toNodeId]))
    const retainedA = result.diagnosticTrace!.find(event => event.event === 'admitted' && JSON.stringify(event.directedTraversalHistory) === JSON.stringify(prefixA))!
    expect(retainedA.stateKey).toBe(retainedB!.stateKey)
    expect(isTraversalHistoryAtLeastAsFlexible(new Set(retainedA.usedDirectedEdges), new Set(retainedB!.usedDirectedEdges))).toBe(false)
    expect(isTraversalHistoryAtLeastAsFlexible(new Set(retainedB!.usedDirectedEdges), new Set(retainedA.usedDirectedEdges))).toBe(false)
    expect(replay.status).toBe('completed')
    expect(result.candidates.some(candidate => candidate.directedTraversalKey === sequence(targetRoute))).toBe(true)
    expect(replay.search.diagnosticTrace).toBeDefined()
  })

  it('B-E: uses directed used-edge subset for dominance flexibility', () => {
    const forward = JSON.stringify(['path', 'lower', 'upper'])
    const reverse = JSON.stringify(['path', 'upper', 'lower'])
    expect(isTraversalHistoryAtLeastAsFlexible(new Set([forward]), new Set([forward, reverse]))).toBe(true)
    expect(isTraversalHistoryAtLeastAsFlexible(new Set([forward]), new Set([reverse]))).toBe(false)
    expect(isTraversalHistoryAtLeastAsFlexible(new Set([forward, reverse]), new Set([forward]))).toBe(false)
    expect(isTraversalHistoryAtLeastAsFlexible(new Set([forward]), new Set([forward]))).toBe(true)
    const lowCost = { totalPathwayMeters: 1, rawStairTraversals: 0, rawEscalatorTraversals: 0, rawElevatorTraversals: 0,
      rawEquipmentTypeChanges: 0, rawFareGateTraversals: 0, decisionPoints: 0 }
    const highCost = { ...lowCost, totalPathwayMeters: 2, rawStairTraversals: 1 }
    expect(dominatesWithTraversalAvailability(lowCost, new Set([forward]), highCost, new Set([forward]))).toBe(true)
    expect(dominatesWithTraversalAvailability(lowCost, new Set([forward]), highCost, new Set([forward, reverse]))).toBe(true)
    expect(dominatesWithTraversalAvailability(lowCost, new Set([forward]), highCost, new Set([reverse]))).toBe(false)

    const graph = graphFixture([N('v', 'boarding-area'), N('x'), N('p'), N('q'), N('exit', 'entrance-exit')], [
      ['v', 'x', 'walk', 0], ['x', 'p', 'walk', 0], ['p', 'v', 'walk', 0],
      ['p', 'q', 'walk', 1], ['q', 'p', 'walk', 1], ['x', 'exit', 'walk', 1],
    ])
    const search = searchMultiObjectiveRoutes(graph, ['v'], ['exit'], { diagnostics: true })
    const safePrune = search.diagnosticTrace!.find(event => event.event === 'pruned' && event.pruneReason === 'pareto-dominated'
      && event.directedTraversalHistory.length === 5)
    expect(safePrune).toBeDefined()
    const dominator = search.diagnosticTrace!.find(event => event.labelId === safePrune!.dominatingLabelId)!
    expect(isTraversalHistoryAtLeastAsFlexible(new Set(dominator.usedDirectedEdges), new Set(safePrune!.usedDirectedEdges))).toBe(true)
  })

  it('keeps raw-search versus semantic-cost reversal visible without redesigning costs', () => {
    const graph = graphFixture([N('board', 'boarding-area'), N('a1'), N('a2'), N('join'), N('b1'), N('exit', 'entrance-exit')], [
      ['board', 'a1', 'elevator', 1], ['a1', 'a2', 'elevator', 1], ['a2', 'join', 'elevator', 8],
      ['board', 'b1', 'elevator', 1], ['b1', 'join', 'elevator', 4],
      ['join', 'b1', 'walk', 1], ['b1', 'exit', 'walk', 1],
    ])
    // The shared continuation is distinct from the branch node so both labels
    // reach an identical search state after their final walk traversal.
    graph.edges = graph.edges.filter(edge => edge.id !== 'fictional-path-5' && edge.id !== 'fictional-path-6')
    graph.edges.push({ id: 'shared-walk', fromNodeId: 'join', toNodeId: 'exit', movementType: 'walk', lengthMeters: 2, sourceType: 'gtfs-pathways' })
    graph.adjacency = new Map([...graph.nodes.keys()].map(id => [id, graph.edges.filter(edge => edge.fromNodeId === id)]))
    const compression: IndoorRouteCompressionContext = { byPathwayId: {
      'fictional-path-0': { facilityId: 'same-device' }, 'fictional-path-1': { facilityId: 'same-device' },
      'fictional-path-2': { facilityId: 'same-device' }, 'fictional-path-3': { facilityId: 'device-one' },
      'fictional-path-4': { facilityId: 'device-two' },
    }, nonBranchingNodeIds: new Set(['board', 'a1', 'a2', 'b1', 'join']) }
    const result = searchMultiObjectiveRoutes(graph, ['board'], ['exit'], { diagnostics: true, compressionContext: compression })
    const routeA = { nodes: ['board', 'a1', 'a2', 'join', 'exit'].map(id => graph.nodes.get(id)!),
      edges: [graph.edges[0], graph.edges[1], graph.edges[2], graph.edges.find(edge => edge.id === 'shared-walk')!], distanceMeters: 12 }
    const routeB = { nodes: ['board', 'b1', 'join', 'exit'].map(id => graph.nodes.get(id)!),
      edges: [graph.edges[3], graph.edges[4], graph.edges.find(edge => edge.id === 'shared-walk')!], distanceMeters: 7 }
    const proof = { firstRouteIndex: 0, lastRouteIndex: 2, instanceKey: 'single-session', source: 'synthetic evidence',
      basis: 'explicit-equipment-session' as const, connectorRouteIndices: [] }
    const costA = computeRouteCost(routeA, { graph, compression, sessionProofs: [proof] })
    const costB = computeRouteCost(routeB, { graph, compression })
    const replay = traceRouteThroughSearch(graph, routeA, 'board', 'exit', { compressionContext: compression })
    expect(replay.status).toBe('completed')
    expect(result.candidates.some(candidate => candidate.directedTraversalKey === sequence(routeA))).toBe(true)
    const rawA = result.candidates.find(candidate => candidate.directedTraversalKey === sequence(routeA))!.searchCost
    const rawB = result.candidates.find(candidate => candidate.directedTraversalKey === sequence(routeB))!.searchCost
    expect(rawA.rawElevatorTraversals).toBe(3)
    expect(rawB.rawElevatorTraversals).toBe(2)
    expect(rawA.totalPathwayMeters).toBeGreaterThan(rawB.totalPathwayMeters!)
    expect(costA.elevatorUses).toBe(1)
    expect(costB.elevatorUses).toBe(2)
    expect(costA.equipmentBoardings).toBe(1)
    expect(costB.equipmentBoardings).toBe(2)
  })

  it('diagnostic history separates gate identities after a shared prefix, without shrinking state', () => {
    const graph = graphFixture([N('board', 'boarding-area'), N('a-in'), N('a-out'), N('b-in'), N('b-out'), N('merge'), N('shared'), N('exit', 'entrance-exit')], [
      ['board', 'a-in', 'walk', 1], ['a-in', 'a-out', 'fare-gate', 0], ['a-out', 'merge', 'walk', 1],
      ['board', 'b-in', 'walk', 1], ['b-in', 'b-out', 'fare-gate', 0], ['b-out', 'merge', 'walk', 1],
      ['merge', 'shared', 'walk', 1], ['shared', 'exit', 'walk', 1],
    ])
    const result = searchMultiObjectiveRoutes(graph, ['board'], ['exit'], { diagnostics: true })
    const sharedLabels = result.diagnosticTrace!.filter(event => event.event === 'admitted' && event.currentNodeId === 'shared')
    expect(sharedLabels).toHaveLength(2)
    expect(new Set(sharedLabels.map(event => event.stateKey)).size).toBe(2)
    expect(new Set(sharedLabels.map(event => event.fareGateState.sequence[0])).size).toBe(2)
    // Current repeated-gate policy consults prior gate identity, so the history
    // is future-relevant under today's cycle rule; this test only observes it.
  })

  it('shared origin prefixes preserve origin and target-exit identities', () => {
    const graph = graphFixture([N('origin-a', 'boarding-area'), N('origin-b', 'boarding-area'), N('merge'), N('shared'),
      N('split'), N('exit-a', 'entrance-exit'), N('exit-b', 'entrance-exit')], [
      ['origin-a', 'merge', 'walk', 1], ['origin-b', 'merge', 'walk', 1], ['merge', 'shared', 'walk', 1],
      ['shared', 'split', 'walk', 1], ['split', 'exit-a', 'walk', 1], ['split', 'exit-b', 'walk', 1],
    ])
    const result = searchMultiObjectiveRoutes(graph, ['origin-a', 'origin-b'], ['exit-a', 'exit-b'], { diagnostics: true })
    expect(result.candidates).toHaveLength(4)
    expect(new Set(result.candidates.map(candidate => `${candidate.originBoardingAreaId}>${candidate.targetExitId}`))).toEqual(new Set([
      'origin-a>exit-a', 'origin-a>exit-b', 'origin-b>exit-a', 'origin-b>exit-b',
    ]))
    const sameNode = result.diagnosticTrace!.filter(event => event.event === 'admitted' && event.currentNodeId === 'shared')
    expect(new Set(sameNode.map(event => event.stateKey)).size).toBe(4)
  })

  it('records maxTotalLabels cutoff and does not present partial candidates as a conclusive selection', () => {
    const graph = graphFixture([N('board', 'boarding-area'), N('middle'), N('exit', 'entrance-exit')], [
      ['board', 'middle', 'walk', 1], ['middle', 'exit', 'walk', 1],
    ])
    const result = searchMultiObjectiveRoutes(graph, ['board'], ['exit'], { diagnostics: true, limits: { maxTotalLabels: 2 } })
    expect(result.complete).toBe(false)
    expect(result.cutoffReasons).toContain('maxTotalLabels')
    expect(result.candidates).toHaveLength(0)
    expect(Object.values(result.selectedByProfile).every(candidate => candidate === null)).toBe(true)
    expect(result.diagnosticTrace!.some(event => event.event === 'limit-reached' && event.pruneReason === 'maxTotalLabels')).toBe(true)

    const competing = graphFixture([N('board', 'boarding-area'), N('middle'), N('exit', 'entrance-exit')], [
      ['board', 'exit', 'walk', 1], ['board', 'middle', 'walk', 2], ['middle', 'exit', 'walk', 1],
    ])
    const partialSelection = searchMultiObjectiveRoutes(competing, ['board'], ['exit'], { limits: { maxCompletedCandidates: 1 } })
    expect(partialSelection.complete).toBe(false)
    expect(partialSelection.selectedByProfile.balanced).not.toBeNull()
    // The result's documented contract is “best seen”; incomplete never means global optimum.
  })

  it('records replay outcomes for completed, cycle, invalid, and cutoff prefixes', () => {
    const graph = graphFixture([N('board', 'boarding-area'), N('middle'), N('exit', 'entrance-exit')], [
      ['board', 'middle', 'walk', 1], ['middle', 'exit', 'walk', 1],
    ])
    const completed = searchMultiObjectiveRoutes(graph, ['board'], ['exit'], { diagnostics: true })
    expect(classifyLegacyRouteAgainstTrace(completed.candidates[0].route, completed, 'board', 'exit').status).toBe('completed')
    const partial = { nodes: [graph.nodes.get('board')!, graph.nodes.get('middle')!], edges: [graph.edges[0]], distanceMeters: 1 }
    expect(classifyLegacyRouteAgainstTrace(partial, completed, 'board', 'exit').status).toBe('valid')

    const malformed = { ...graph.edges[0], id: 'bad-edge', fromNodeId: 'missing' }
    graph.edges.push(malformed)
    graph.adjacency.set('board', [graph.edges[0], malformed])
    const invalidTrace = searchMultiObjectiveRoutes(graph, ['board'], ['exit'], { diagnostics: true })
    expect(invalidTrace.diagnosticTrace!.some(event => event.event === 'invalid-transition')).toBe(true)
    const invalidRoute = { nodes: [graph.nodes.get('board')!, N('missing') as IndoorNode], edges: [malformed], distanceMeters: 1 }
    expect(classifyLegacyRouteAgainstTrace(invalidRoute, invalidTrace, 'board', 'exit').status).toBe('invalid-transition')

    const cycleGraph = graphFixture([N('board', 'boarding-area'), N('middle'), N('loop'), N('exit', 'entrance-exit')], [
      ['board', 'middle', 'walk', 1], ['middle', 'loop', 'walk', 1], ['loop', 'board', 'walk', 1], ['middle', 'exit', 'walk', 1],
    ])
    const cycleTrace = searchMultiObjectiveRoutes(cycleGraph, ['board'], ['exit'], { diagnostics: true })
    expect(cycleTrace.diagnosticTrace!.some(event => event.event === 'cycle-rejected')).toBe(true)
    const repeatedEdgeRoute = { nodes: ['board', 'middle', 'loop', 'board', 'middle'].map(id => cycleGraph.nodes.get(id)!),
      edges: [cycleGraph.edges[0], cycleGraph.edges[1], cycleGraph.edges[2], cycleGraph.edges[0]], distanceMeters: 4 }
    expect(classifyLegacyRouteAgainstTrace(repeatedEdgeRoute, cycleTrace, 'board', 'exit').status).toBe('cycle-rejected')

    const limitedGraph = graphFixture([N('board', 'boarding-area'), N('middle'), N('exit', 'entrance-exit')], [
      ['board', 'middle', 'walk', 1], ['middle', 'exit', 'walk', 1],
    ])
    const limited = searchMultiObjectiveRoutes(limitedGraph, ['board'], ['exit'], { diagnostics: true, limits: { maxTotalLabels: 2 } })
    const completeExpectedRoute = { nodes: ['board', 'middle', 'exit'].map(id => limitedGraph.nodes.get(id)!),
      edges: limitedGraph.edges, distanceMeters: 2 }
    expect(classifyLegacyRouteAgainstTrace(completeExpectedRoute, limited, 'board', 'exit').status).toBe('limit-reached')
  })

  it('does not treat an incomplete pathway length as zero when profiling a completed route', () => {
    const graph = graphFixture([N('board', 'boarding-area'), N('exit', 'entrance-exit')], [
      ['board', 'exit', 'walk', Number.NaN],
    ])
    const result = searchMultiObjectiveRoutes(graph, ['board'], ['exit'])
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].searchCost.totalPathwayMeters).toBeNull()
    expect(Number.isNaN(result.candidates[0].route.distanceMeters)).toBe(true)
    expect(result.candidates[0].routeCost.totalPathwayMeters).toBeNull()
    expect(Object.values(result.selectedByProfile).every(candidate => candidate === null)).toBe(true)
  })
})

it('runs shadow candidate coverage for all supported courses without touching production selection', () => {
  const diagnostics = outingCoursePresets.map(course => {
    const dataset = loadedOedo2026IndoorDatasets.find(d => d.station.id === course.arrivalStationId)!
    const graph = buildIndoorGraph(dataset.gtfs)
    const compression = buildRegisteredStationMapCompressionContext(dataset.station.id, graph)
    const platformId = course.arrivalPlatformAssignments[0].platformId
    const exits = [course.preferredExitId!].flat()
    const legacyVariants = (['shortest', 'avoid-stairs', 'elevator-priority', 'escalator-priority'] as const)
      .flatMap(preference => exits.flatMap(exit => findRoutesFromPlatform(graph, platformId, exit, preference)))
    const legacyKeys = new Set(legacyVariants.map(item => sequence(item.route)))
    const before = findBestElderlyRoute(graph, platformId, exits, compression)
    const result = searchPlatformToExitsMultiObjective(graph, [platformId], exits, { compressionContext: compression })
    const comparison = compareCandidateSets(legacyVariants.map(item => item.route), result, graph, compression)
    const after = findBestElderlyRoute(graph, platformId, exits, compression)
    expect(sequence({ edges: before!.route.edges })).toBe(sequence({ edges: after!.route.edges }))
    expect(comparison.legacyCandidateCount).toBe(legacyKeys.size)
    return { station: dataset.station.name, legacy: comparison.legacyCandidateCount, multi: result.candidates.length,
      legacyOnly: comparison.legacyOnly.length,
      additional: result.candidates.filter(candidate => !legacyKeys.has(candidate.directedTraversalKey)).length,
      selected: Object.fromEntries(Object.entries(result.selectedByProfile).map(([profile, candidate]) => [profile, candidate && {
        stairs: candidate.routeCost.stairs.uses, ES: candidate.routeCost.escalatorUses, EV: candidate.routeCost.elevatorUses,
        transfers: candidate.routeCost.equipmentInstanceTransfers, unresolved: candidate.routeCost.unresolvedEquipmentTransitions,
        meters: candidate.routeCost.totalPathwayMeters,
      }])),
      exampleAdditional: (() => {
        const extra = result.candidates.filter(candidate => !legacyKeys.has(candidate.directedTraversalKey))
          .sort((a, b) => a.route.distanceMeters - b.route.distanceMeters)[0]
        return extra ? { meters: extra.route.distanceMeters,
          raw: extra.searchCost, cost: { stairs: extra.routeCost.stairs.uses, ES: extra.routeCost.escalatorUses,
            EV: extra.routeCost.elevatorUses, boardings: extra.routeCost.equipmentBoardings,
            transfers: extra.routeCost.equipmentInstanceTransfers, unresolved: extra.routeCost.unresolvedEquipmentTransitions },
          actions: extra.route.edges.map(edge => edge.movementType) } : null
      })(),
      labels: result.exploredLabelCount, pruned: result.prunedLabelCount, complete: result.complete, cutoffs: result.cutoffReasons }
  })
  expect(diagnostics).toHaveLength(12)
  console.info('Shadow multi-objective comparison (does not change production)', JSON.stringify(diagnostics))
}, 120_000)

it('compares origin-wise multi-target shadow search with existing origin × exit search for all courses', () => {
  const summaries = outingCoursePresets.map(course => {
    const dataset = loadedOedo2026IndoorDatasets.find(d => d.station.id === course.arrivalStationId)!
    const graph = buildIndoorGraph(dataset.gtfs)
    const compression = buildRegisteredStationMapCompressionContext(dataset.station.id, graph)
    const platformId = course.arrivalPlatformAssignments[0].platformId
    const exits = [course.preferredExitId!].flat()
    const origins = [...new Set(platformOriginNodes(graph, platformId).map(origin => origin.id))].sort()
    const budgetPerOrigin = Math.max(1, Math.floor(DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS.maxTotalLabels / Math.max(1, origins.length)))
    const expansionsPerOrigin = Math.max(1, Math.floor(DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS.maxExpansions / Math.max(1, origins.length)))
    const completedPerOrigin = Math.max(1, Math.floor(DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS.maxCompletedCandidates / Math.max(1, origins.length)))
    const options = { compressionContext: compression, limits: { maxTotalLabels: budgetPerOrigin,
      maxExpansions: expansionsPerOrigin, maxCompletedCandidates: completedPerOrigin }, diagnostics: true }
    const existing = searchPlatformToExitsMultiObjective(graph, [platformId], exits, { compressionContext: compression, diagnostics: true })
    const run = (queueOrdering: 'current' | 'distance-lower-bound') => origins.map(origin =>
      searchMultiObjectiveRoutesToTargets(graph, origin, exits, { ...options, queueOrdering }))
    const multi = run('current'), informed = run('distance-lower-bound')
    const collect = (results: typeof multi) => results.flatMap(result => Object.values(result.exits).flatMap(exit => exit.candidates))
    const multiCandidates = collect(multi), informedCandidates = collect(informed)
    const existingKeys = new Set(existing.candidates.map(candidate => `${candidate.originBoardingAreaId}|${candidate.targetExitId}|${candidate.directedTraversalKey}`))
    const multiKeys = new Set(multiCandidates.map(candidate => `${candidate.originBoardingAreaId}|${candidate.targetExitId}|${candidate.directedTraversalKey}`))
    const informedKeys = new Set(informedCandidates.map(candidate => `${candidate.originBoardingAreaId}|${candidate.targetExitId}|${candidate.directedTraversalKey}`))
    const legacyCandidates = exits.flatMap(exit => (['shortest', 'avoid-stairs', 'elevator-priority', 'escalator-priority'] as const)
      .flatMap(preference => findRoutesFromPlatform(graph, platformId, exit, preference)))
      .map(candidate => ({ origin: candidate.origin.id, target: exits.find(exit => candidate.route.nodes.at(-1)?.id === exit)!, key: sequence(candidate.route) }))
    const legacyKeys = new Set(legacyCandidates.map(candidate => `${candidate.origin}|${candidate.target}|${candidate.key}`))
    const legacyByExit = Object.fromEntries(exits.map(exit => {
      const legacy = new Set(legacyCandidates.filter(candidate => candidate.target === exit)
        .map(candidate => `${candidate.origin}|${candidate.target}|${candidate.key}`))
      const multiForExit = new Set(multiCandidates.filter(candidate => candidate.targetExitId === exit)
        .map(candidate => `${candidate.originBoardingAreaId}|${candidate.targetExitId}|${candidate.directedTraversalKey}`))
      const informedForExit = new Set(informedCandidates.filter(candidate => candidate.targetExitId === exit)
        .map(candidate => `${candidate.originBoardingAreaId}|${candidate.targetExitId}|${candidate.directedTraversalKey}`))
      const scopeComplete = multi.every(result => result.exits[exit]?.searchComplete)
      return [exit, { legacy: legacy.size, current: multiForExit.size, gPlusH: informedForExit.size,
        currentCommon: [...legacy].filter(key => multiForExit.has(key)).length,
        gPlusHCommon: [...legacy].filter(key => informedForExit.has(key)).length,
        legacyOnlyObserved: [...legacy].filter(key => !multiForExit.has(key)).length,
        gPlusHLegacyOnlyObserved: [...legacy].filter(key => !informedForExit.has(key)).length,
        absenceConclusive: { current: scopeComplete, gPlusH: informed.every(result => result.exits[exit]?.searchComplete) } }]
    }))
    const profileSelectionDifferences = ['balanced', 'escalator-preferred', 'elevator-preferred'].map(profile => {
      const selectionKey = (results: typeof multi) => new Map(results.flatMap(result => exits.map(exit => {
        const candidate = result.exits[exit]?.selectedByProfile[profile as 'balanced' | 'escalator-preferred' | 'elevator-preferred']
        return [`${result.originBoardingAreaId}|${exit}`, candidate?.directedTraversalKey ?? null] as const
      })))
      const currentSelection = selectionKey(multi), informedSelection = selectionKey(informed)
      const keys = new Set([...currentSelection.keys(), ...informedSelection.keys()])
      return [profile, { currentSelected: [...currentSelection.values()].filter(Boolean).length,
        gPlusHSelected: [...informedSelection.values()].filter(Boolean).length,
        changedAmongBothSelected: [...keys].filter(key => currentSelection.get(key) !== null
          && informedSelection.get(key) !== null && currentSelection.get(key) !== informedSelection.get(key)).length }]
    })
    const summarize = (results: typeof multi, candidates: typeof multiCandidates) => ({
      candidates: candidates.length, labels: results.reduce((sum, result) => sum + result.exploredLabelCount, 0),
      states: results.reduce((sum, result) => sum + result.distinctStateCount, 0),
      pruned: results.reduce((sum, result) => sum + result.prunedLabelCount, 0),
      expansions: results.reduce((sum, result) => sum + result.expansionCount, 0),
      complete: results.every(result => result.complete), cutoffs: [...new Set(results.flatMap(result => result.cutoffReasons))],
      exitCoverage: Object.fromEntries(exits.map(exit => [exit, candidates.some(candidate => candidate.targetExitId === exit)])),
      firstCandidate: results.filter(result => result.firstCandidateAdmittedLabelCount !== null)
        .map(result => ({ labels: result.firstCandidateAdmittedLabelCount, expansions: result.firstCandidateExpansionCount }))
        .sort((a, b) => a.labels! - b.labels!)[0] ?? null,
    })
    return { course: course.destination, station: dataset.station.name, origins: origins.length, exits: exits.length,
      existing: { labels: existing.exploredLabelCount, states: new Set(existing.diagnosticTrace?.filter(event => event.event === 'admitted').map(event => event.stateKey)).size,
        pruned: existing.prunedLabelCount, candidates: existing.candidates.length, complete: existing.complete },
      multi: summarize(multi, multiCandidates), distanceLowerBound: summarize(informed, informedCandidates),
      legacyCoverage: { legacyRoutes: legacyKeys.size, existingCandidates: existingKeys.size, current: [...existingKeys].filter(key => multiKeys.has(key)).length,
        gPlusH: [...existingKeys].filter(key => informedKeys.has(key)).length,
        currentCovered: [...legacyKeys].filter(key => multiKeys.has(key)).length,
        gPlusHCovered: [...legacyKeys].filter(key => informedKeys.has(key)).length,
        currentNotObserved: [...legacyKeys].filter(key => !multiKeys.has(key)).length,
        gPlusHNotObserved: [...legacyKeys].filter(key => !informedKeys.has(key)).length, byExit: legacyByExit },
      profileSelectionDifferences }
  })
  expect(summaries).toHaveLength(12)
  expect(summaries.find(summary => summary.station === '赤羽橋')?.exits).toBe(1)
  const totals = summaries.reduce((total, item) => ({
    legacy: total.legacy + item.legacyCoverage.legacyRoutes,
    currentCandidates: total.currentCandidates + item.multi.candidates,
    gPlusHCandidates: total.gPlusHCandidates + item.distanceLowerBound.candidates,
    currentLegacyCovered: total.currentLegacyCovered + item.legacyCoverage.currentCovered,
    gPlusHLegacyCovered: total.gPlusHLegacyCovered + item.legacyCoverage.gPlusHCovered,
  }), { legacy: 0, currentCandidates: 0, gPlusHCandidates: 0, currentLegacyCovered: 0, gPlusHLegacyCovered: 0 })
  console.info('Origin-wise multi-target shadow comparison (independent of production)', JSON.stringify({ totals,
    courses: summaries.map(item => ({ station: item.station, current: item.multi, gPlusH: item.distanceLowerBound,
      legacy: item.legacyCoverage, profileSelectionDifferences: item.profileSelectionDifferences })) }))
}, 240_000)

it('compares origin-wise multi-target search for representative P2 exit sets', () => {
  const cases = [
    { key: 'akabanebashi', platform: '422P2', exits: ['422N0012'] },
    { key: 'kokuritsu-kyogijo', platform: '426P2', exits: ['426N0139', '426N0241'] },
    { key: 'tochomae', platform: '429P2', exits: ['429N0137', '429N0093', '429N0122', '429N0098'] },
  ]
  const reports = cases.map(item => {
    const dataset = loadedOedo2026IndoorDatasets.find(entry => entry.key === item.key)!
    const graph = buildIndoorGraph(dataset.gtfs)
    const compression = buildRegisteredStationMapCompressionContext(dataset.station.id, graph)
    const origins = [...new Set(platformOriginNodes(graph, item.platform).map(origin => origin.id))].sort()
    const sharedLimits = { maxTotalLabels: DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS.maxTotalLabels,
      maxExpansions: DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS.maxExpansions,
      maxCompletedCandidates: DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS.maxCompletedCandidates }
    const existing = searchMultiObjectiveRoutes(graph, origins, item.exits, { compressionContext: compression, diagnostics: true, limits: sharedLimits })
    const perOrigin = { maxTotalLabels: Math.max(1, Math.floor(sharedLimits.maxTotalLabels / origins.length)),
      maxExpansions: Math.max(1, Math.floor(sharedLimits.maxExpansions / origins.length)),
      maxCompletedCandidates: Math.max(1, Math.floor(sharedLimits.maxCompletedCandidates / origins.length)) }
    const multi = origins.map(origin => searchMultiObjectiveRoutesToTargets(graph, origin, item.exits,
      { compressionContext: compression, diagnostics: true, limits: perOrigin }))
    const multiCandidates = multi.flatMap(result => Object.values(result.exits).flatMap(exit => exit.candidates))
    const existingKeys = new Set(existing.candidates.map(candidate => `${candidate.originBoardingAreaId}|${candidate.targetExitId}|${candidate.directedTraversalKey}`))
    const multiKeys = new Set(multiCandidates.map(candidate => `${candidate.originBoardingAreaId}|${candidate.targetExitId}|${candidate.directedTraversalKey}`))
    const byExit = Object.fromEntries(item.exits.map(exit => [exit, { existing: existing.candidates.filter(candidate => candidate.targetExitId === exit).length,
      multi: multiCandidates.filter(candidate => candidate.targetExitId === exit).length,
      multiComplete: multi.every(result => result.exits[exit]?.searchComplete) }]))
    return { station: dataset.station.name, origins: origins.length, exits: item.exits.length,
      existing: { labels: existing.exploredLabelCount, states: new Set(existing.diagnosticTrace!.filter(event => event.event === 'admitted').map(event => event.stateKey)).size,
        pruned: existing.prunedLabelCount, candidates: existing.candidates.length, complete: existing.complete },
      multi: { labels: multi.reduce((sum, result) => sum + result.exploredLabelCount, 0),
        states: new Set(multi.flatMap(result => result.diagnosticTrace!.filter(event => event.event === 'admitted')
          .map(event => `${result.originBoardingAreaId}|${event.stateKey}`))).size,
        pruned: multi.reduce((sum, result) => sum + result.prunedLabelCount, 0), candidates: multiCandidates.length,
        complete: multi.every(result => result.complete) },
      additionalTargetDuplicatedAdmissionsAvoided: [...existingKeys].length, commonCandidates: [...existingKeys].filter(key => multiKeys.has(key)).length,
      absentCandidates: [...existingKeys].filter(key => !multiKeys.has(key)).length, byExit }
  })
  console.info('Focused P2 origin-wise multi-target comparison', JSON.stringify(reports))
  expect(reports).toHaveLength(3)
}, 240_000)

it('classifies legacy-only candidates for representative real station fixtures when diagnostics are enabled', () => {
  const cases = [
    { key: 'akabanebashi', platform: '422P2', exits: ['422N0012'] },
    { key: 'kokuritsu-kyogijo', platform: '426P2', exits: ['426N0139', '426N0241'] },
    { key: 'tochomae', platform: '429P2', exits: ['429N0137', '429N0093', '429N0122', '429N0098'] },
  ]
  const reports = cases.map(item => {
    const dataset = loadedOedo2026IndoorDatasets.find(entry => entry.key === item.key)!
    const graph = buildIndoorGraph(dataset.gtfs)
    const compression = buildRegisteredStationMapCompressionContext(dataset.station.id, graph)
    const legacy = item.exits.flatMap(exit => (['shortest', 'avoid-stairs', 'elevator-priority', 'escalator-priority'] as const)
      .flatMap(profile => findRoutesFromPlatform(graph, item.platform, exit, profile)))
    const allLegacy = new Map(legacy.map(candidate => [sequence(candidate.route), candidate]))
    const shadow = searchPlatformToExitsMultiObjective(graph, [item.platform], item.exits, { compressionContext: compression, diagnostics: true })
    const returned = new Set(shadow.candidates.map(candidate => candidate.directedTraversalKey))
    const missing = [...allLegacy.entries()].filter(([key]) => !returned.has(key)).map(([, candidate]) => ({
      key: sequence(candidate.route), origin: candidate.origin.id, route: candidate.route,
      target: item.exits.find(exit => candidate.route.nodes.at(-1)?.id === exit) ?? '',
    }))
    const classified = missing.map(candidate => ({ ...candidate,
      result: classifyLegacyRouteAgainstTrace(candidate.route, shadow, candidate.origin, candidate.target) }))
    const counts = Object.fromEntries(['completed', 'dominated', 'cycle-rejected', 'limit-reached', 'invalid-transition', 'valid'].map(status => [status,
      classified.filter(item => item.result.status === status).length]))
    const representative = item.key === 'tochomae' ? [...classified].sort((a, b) => a.route.edges.length - b.route.edges.length)[0] : undefined
    return { station: dataset.station.name, legacy: allLegacy.size, shadow: shadow.candidates.length, legacyOnly: missing.length,
      complete: shadow.complete, cutoffs: shadow.cutoffReasons, reasonCounts: counts,
      labels: shadow.exploredLabelCount, distinctStates: new Set(shadow.diagnosticTrace!.filter(event => event.event === 'admitted').map(event => event.stateKey)).size,
      pruned: shadow.prunedLabelCount,
      tochomaeRepresentative: representative && { edgeCount: representative.route.edges.length,
        matchedPrefixLength: representative.result.matchedPrefixLength, firstLostTraversal: representative.result.firstLostTraversal,
        status: representative.result.status, reason: representative.result.reason } }
  })
  console.info('Real-station diagnostic classification (search is unchanged)', JSON.stringify(reports))
  expect(reports).toHaveLength(3)
  expect(reports.every(report => report.complete === false)).toBe(true)
}, 120_000)
