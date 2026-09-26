import { describe, expect, it } from 'vitest'
import { computeRouteCost, type EquipmentSessionProof } from './routeCost'
import type { IndoorGraph, IndoorMovementType, IndoorRoute, IndoorRouteCompressionContext } from './indoorRouting'
import { outingCoursePresets } from '../data/coursePresets'
import { loadedOedo2026IndoorDatasets } from '../data/catalogs/oedo2026IndoorDatasets'
import { buildRegisteredStationMapCompressionContext } from '../data/stationMaps/registry'
import { buildIndoorGraph } from './indoorRouting'
import { findBestElderlyRoute } from './elderlyRouteScoring'

function fixture(types: IndoorMovementType[], lengths: number[], levels: (number | undefined)[] = []) {
  const nodes = Array.from({ length: types.length + 1 }, (_, i) => ({ id: `fictional-node-${i}`, latitude: 0,
    longitude: i * 0.00001, locationType: 3, kind: 'internal' as const, levelIndex: levels[i] }))
  const edges = types.map((movementType, i) => ({ id: `fictional-edge-${i}`, fromNodeId: nodes[i].id,
    toNodeId: nodes[i + 1].id, lengthMeters: lengths[i], movementType, sourceType: 'gtfs-pathways' as const }))
  const route: IndoorRoute = { nodes, edges, distanceMeters: lengths.reduce((a, b) => a + b, 0) }
  const graph: IndoorGraph = { stationId: 'fictional-cost-station', stationName: 'Synthetic', source: {
    name: 'synthetic', url: 'https://example.invalid/fixture', license: 'test', feedVersion: 'test', retrievedAt: 'test',
  }, nodes: new Map(nodes.map(node => [node.id, node])), edges,
  adjacency: new Map(nodes.map(node => [node.id, edges.filter(edge => edge.fromNodeId === node.id)])) }
  return { route, graph }
}

function proof(first: number, last: number, instanceKey: string, connectorRouteIndices: number[] = []): EquipmentSessionProof {
  return { firstRouteIndex: first, lastRouteIndex: last, instanceKey, connectorRouteIndices,
    source: 'https://example.invalid/explicit-session-survey', basis: 'explicit-equipment-session' }
}

describe('generic RouteCost measurement (not selection)', () => {
  it('A: pure walkway', () => {
    const f = fixture(['walk'], [100])
    const cost = computeRouteCost(f.route, f)
    expect(cost.walkingMeters).toBe(100)
    expect(cost.totalPathwayMeters).toBe(100)
    expect([cost.stairs.uses, cost.escalatorUses, cost.elevatorUses, cost.equipmentBoardings]).toEqual([0, 0, 0, 0])
  })
  it('B: excludes stairs from walking; does not invent rise or stair count', () => {
    const f = fixture(['walk', 'stairs'], [50, 10], [-2, -2, -1])
    const cost = computeRouteCost(f.route, f)
    expect(cost.totalPathwayMeters).toBe(60)
    expect(cost.walkingMeters).toBe(50)
    expect(cost.stairs).toEqual({ uses: 1, steps: null, ascentMeters: null, descentMeters: null })
    expect(cost.waitingSeconds).toBeNull()
  })
  it.each(['escalator', 'elevator'] as const)('C: explicitly proven %s entrance/flight/exit is one session', type => {
    const f = fixture([type, type, type], [2, 10, 2], [-2, -2, -1, -1])
    const compression: IndoorRouteCompressionContext = { byPathwayId: Object.fromEntries(f.route.edges.map(edge => [edge.id, { facilityId: 'fixture-device' }])) }
    const cost = computeRouteCost(f.route, { ...f, compression, sessionProofs: [proof(0, 2, 'survey/device', [0, 2])] })
    expect(cost[type === 'escalator' ? 'escalatorUses' : 'elevatorUses']).toBe(1)
    expect(cost.equipmentBoardings).toBe(1)
    expect(cost.equipmentInstanceTransfers).toBe(0)
    expect(cost.verticalActions).toEqual({ up: 1, down: 0, unknown: 0 })
    const action = cost.evidence.find(e => e.metric === 'equipment')!
    expect(action.semanticAction!.evidence.edgeIds).toEqual(f.route.edges.map(e => e.id))
    expect(action.semanticAction!.evidence.routeOrder![0].traversals).toHaveLength(3)
    expect(action.sessionProof?.source).toContain('explicit-session-survey')
  })
  it('D: distinct ES instances, same type, two boardings and one transfer', () => {
    const f = fixture(['escalator', 'walk', 'escalator'], [10, 20, 10], [-3, -2, -2, -1])
    const cost = computeRouteCost(f.route, { ...f, sessionProofs: [proof(0, 0, 'survey/A'), proof(2, 2, 'survey/B')] })
    expect([cost.escalatorUses, cost.equipmentBoardings, cost.equipmentInstanceTransfers, cost.equipmentTypeChanges]).toEqual([2, 2, 1, 0])
    expect(cost.unresolvedEquipmentTransitions).toBe(0)
  })
  it('E: different types prove an instance transfer without inventing Facility identity', () => {
    const f = fixture(['escalator', 'elevator'], [10, 20])
    const cost = computeRouteCost(f.route, f)
    expect([cost.equipmentBoardings, cost.equipmentInstanceTransfers, cost.equipmentTypeChanges]).toEqual([2, 1, 1])
  })
  it('F: unverified same-type transition is unresolved, not confirmed zero burden', () => {
    const f = fixture(['escalator', 'walk', 'escalator'], [10, 20, 10])
    const cost = computeRouteCost(f.route, f)
    expect(cost.unresolvedEquipmentTransitions).toBe(1)
    expect(cost.equipmentInstanceTransfers).toBe(0) // confirmed lower bound only
    expect(cost.evidence.some(e => e.reason.includes('transition unresolved'))).toBe(true)
  })
  it.each(['facilityGroupId', 'facilityId'] as const)('F: %s matching alone cannot prove a multi-edge boarding', field => {
    const f = fixture(['elevator', 'elevator'], [2, 10], [-2, -2, -1])
    const compression = { byPathwayId: Object.fromEntries(f.route.edges.map(edge => [edge.id, { [field]: 'nearby-device' }])) }
    const cost = computeRouteCost(f.route, { ...f, compression })
    expect(cost.observedSemanticUses.elevator).toBe(1)
    expect(cost.elevatorUses).toBeNull()
    expect(cost.equipmentBoardings).toBeNull()
    expect(cost.unresolvedEquipmentGroups).toBe(1)
    expect(cost.unresolvedEquipmentTransitions).toBe(1)
  })
  it('G: reuses up/down/unknown resolver with actual traversal levels', () => {
    const f = fixture(['stairs', 'escalator', 'elevator'], [10, 10, 2], [-3, -2, -3, -3])
    expect(computeRouteCost(f.route, f).verticalActions).toEqual({ up: 1, down: 1, unknown: 1 })
  })
  it('H: missing length, direction and identity remain unknown; keeps partial totals', () => {
    const f = fixture(['walk', 'walk', 'elevator', 'walk', 'elevator'], [5, NaN, 3, 4, 3])
    const cost = computeRouteCost(f.route, f)
    expect(cost.walkingMeters).toBeNull()
    expect(cost.totalPathwayMeters).toBeNull()
    expect(cost.knownWalkingMeters).toBe(9)
    expect(cost.knownPathwayMeters).toBe(15)
    expect(cost.verticalActions.unknown).toBe(2)
    expect(cost.unresolvedEquipmentTransitions).toBe(1)
  })
  it('excludes gate lengths and keeps unclassified walking incomplete', () => {
    const f = fixture(['walk', 'fare-gate', 'unknown'], [5, 2, 8])
    const cost = computeRouteCost(f.route, f)
    expect(cost.knownWalkingMeters).toBe(5)
    expect(cost.walkingMeters).toBeNull()
    expect(cost.totalPathwayMeters).toBe(15)
  })
  it('separate visits to an explicitly identical instance remain separate boardings', () => {
    const f = fixture(['escalator', 'walk', 'escalator'], [10, 20, 10])
    const cost = computeRouteCost(f.route, { ...f, sessionProofs: [proof(0, 0, 'survey/A'), proof(2, 2, 'survey/A')] })
    expect(cost.equipmentBoardings).toBe(2)
    expect(cost.equipmentInstanceTransfers).toBe(0)
    expect(cost.unresolvedEquipmentTransitions).toBe(0)
  })
  it('explicit session evidence does not invent unknown flight direction', () => {
    const f = fixture(['escalator', 'escalator', 'escalator'], [2, 10, 2], [-2, -2, undefined, undefined])
    const compression = { byPathwayId: Object.fromEntries(f.route.edges.map(edge => [edge.id, { facilityId: 'device' }])) }
    const cost = computeRouteCost(f.route, { ...f, compression, sessionProofs: [proof(0, 2, 'survey/A', [0])] })
    expect(cost.escalatorUses).toBe(1)
    expect(cost.verticalActions).toEqual({ up: 0, down: 0, unknown: 1 })
  })
  it('documents the legacy decision-point proxy, including a one-way two-choice miss', () => {
    const f = fixture(['walk'], [5])
    const edge = f.route.edges[0]
    f.graph.adjacency.set(edge.fromNodeId, [edge, { ...edge, id: 'choice-2' }])
    expect(computeRouteCost(f.route, f).decisionPoints).toBe(0)
    f.graph.adjacency.get(edge.fromNodeId)!.push({ ...edge, id: 'choice-3' })
    expect(computeRouteCost(f.route, f).decisionPoints).toBe(1)
  })
})

it('measures all 12 selected routes without mutation or connecting cost to selection', () => {
  const diagnostics = outingCoursePresets.map(course => {
    const dataset = loadedOedo2026IndoorDatasets.find(d => d.station.id === course.arrivalStationId)!
    const graph = buildIndoorGraph(dataset.gtfs)
    const compression = buildRegisteredStationMapCompressionContext(dataset.station.id, graph)
    const select = () => findBestElderlyRoute(graph, course.arrivalPlatformAssignments[0].platformId, [course.preferredExitId!].flat(), compression)!
    const selected = select()
    const before = JSON.stringify(selected)
    const cost = computeRouteCost(selected.route, { graph, compression })
    expect(JSON.stringify(selected)).toBe(before)
    expect(JSON.stringify(select())).toBe(before)
    expect(cost.totalPathwayMeters).toBeCloseTo(selected.route.distanceMeters, 8)
    expect(cost.waitingSeconds).toBeNull()
    expect(cost.decisionPoints).toBe(selected.decisionPoints)
    const { evidence: _evidence, ...metrics } = cost
    return { station: dataset.station.name, ...metrics }
  })
  expect(diagnostics).toHaveLength(12)
  console.info('RouteCost diagnostics (null = unresolved, transfers = confirmed lower bound)', JSON.stringify(diagnostics))
})
