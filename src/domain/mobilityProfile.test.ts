import { describe, expect, it } from 'vitest'
import { MOBILITY_PROFILES, selectBestRoute, type ElderlyRouteScore, type MobilityRouteCandidate } from './elderlyRouteScoring'
import { computeRouteCost } from './routeCost'
import type { IndoorGraph, IndoorMovementType, IndoorRoute } from './indoorRouting'

function routeCandidate(key: string, equipment: IndoorMovementType[], distance: number, stairs = 0, decisions = 0): MobilityRouteCandidate {
  const nodeCount = equipment.length + 1
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({ id: `${key}-node-${i}`, name: `${key}-${i}`,
    latitude: 0, longitude: i * 0.00001, locationType: 3, kind: 'internal' as const,
    levelIndex: equipment[i - 1] === 'stairs' || equipment[i - 1] === 'escalator' || equipment[i - 1] === 'elevator' ? -i : undefined }))
  const lengths = equipment.map((_, i) => i === 0 ? distance : 0)
  const edges = equipment.map((movementType, i) => ({ id: `${key}-edge-${i}`, fromNodeId: nodes[i].id,
    toNodeId: nodes[i + 1].id, lengthMeters: lengths[i], movementType, sourceType: 'gtfs-pathways' as const }))
  const route: IndoorRoute = { nodes, edges, distanceMeters: distance }
  const graph: IndoorGraph = { stationId: `fixture-${key}`, stationName: 'Synthetic', nodes: new Map(nodes.map(n => [n.id, n])), edges,
    adjacency: new Map(nodes.map((node, index) => [node.id, [...edges.filter(edge => edge.fromNodeId === node.id),
      ...Array.from({ length: decisions && index === 0 ? decisions : 0 }, (_, branch) => ({ ...edges[0], id: `${key}-branch-${branch}` }))]])),
    source: { name: 'test', url: 'https://example.invalid', license: 'test', feedVersion: 'test', retrievedAt: 'test' } }
  const steps = equipment.filter(type => ['stairs', 'escalator', 'elevator'].includes(type))
  const counts = { stairs: steps.filter(type => type === 'stairs').length, escalators: steps.filter(type => type === 'escalator').length, elevators: steps.filter(type => type === 'elevator').length }
  const changes = steps.slice(1).reduce((sum, type, i) => sum + Number(type !== steps[i]), 0)
  const score: ElderlyRouteScore = { originId: nodes[0].id, exitId: nodes.at(-1)!.id, route, ...counts,
    equipmentChanges: changes, decisionPoints: decisions, distanceMeters: distance, equipmentUses: steps.length,
    ranking: [stairs, changes, decisions, distance, steps.length] }
  return { score, cost: computeRouteCost(route, { graph }) }
}

function profileCandidates(evDistance = 100, esDistance = 105) {
  return [routeCandidate('ev', ['elevator'], evDistance), routeCandidate('es', ['escalator'], esDistance)]
}

describe('generic mobility-profile route selection', () => {
  it('A: profiles select EV/ES preference within the global distance-equivalent group', () => {
    const candidates = profileCandidates()
    expect(selectBestRoute(candidates, MOBILITY_PROFILES['escalator-preferred']).selected?.score).toBe(candidates[1].score)
    expect(selectBestRoute(candidates, MOBILITY_PROFILES['elevator-preferred']).selected?.score).toBe(candidates[0].score)
    // Balanced keeps the established neutral-use/ES weak tie-break behavior.
    expect(selectBestRoute(candidates, MOBILITY_PROFILES.balanced).selected?.score).toBe(candidates[1].score)
  })
  it('B: preference never selects an 80m detour', () => {
    const candidates = profileCandidates(100, 180)
    expect(selectBestRoute(candidates, MOBILITY_PROFILES['escalator-preferred']).selected?.score).toBe(candidates[0].score)
  })
  it('C: zero stairs outranks a shorter route with stairs for every profile', () => {
    const candidates = [routeCandidate('ev-no-stairs', ['elevator'], 120), routeCandidate('es-stairs', ['escalator', 'stairs'], 100, 1)]
    for (const profile of Object.values(MOBILITY_PROFILES)) expect(selectBestRoute(candidates, profile).selected?.score).toBe(candidates[0].score)
  })
  it('D: RouteCost boarding/transfer burden is considered before equipment preference', () => {
    const one = routeCandidate('one-session', ['escalator'], 110)
    const two = routeCandidate('two-sessions', ['escalator', 'walk', 'escalator'], 105)
    // Supply source-backed evidence that the two ES traversals are distinct devices.
    two.cost = { ...two.cost, equipmentBoardings: 2, equipmentInstanceTransfers: 1, unresolvedEquipmentTransitions: 0 }
    expect(one.cost.equipmentBoardings).toBe(1)
    expect(selectBestRoute([two, one], MOBILITY_PROFILES['escalator-preferred']).selected?.score).toBe(one.score)
  })
  it('E: fewer decision points takes precedence for every profile', () => {
    const candidates = [routeCandidate('one-decision', ['escalator'], 100, 0, 1), routeCandidate('many-decisions', ['escalator'], 101, 0, 5)]
    for (const profile of Object.values(MOBILITY_PROFILES)) expect(selectBestRoute(candidates, profile).selected?.score).toBe(candidates[0].score)
  })
  it('F: unresolved identity is not treated as zero burden or a preferred device', () => {
    const known = routeCandidate('known', ['elevator'], 100)
    const uncertain = routeCandidate('uncertain', ['escalator', 'walk', 'escalator'], 100)
    uncertain.cost = { ...uncertain.cost, escalatorUses: null, equipmentBoardings: null, unresolvedEquipmentGroups: 1, unresolvedEquipmentTransitions: 1 }
    expect(selectBestRoute([uncertain, known], MOBILITY_PROFILES['escalator-preferred']).selected?.score).toBe(known.score)
  })
  it('G: every candidate permutation has the same selection for each profile', () => {
    const candidates = [routeCandidate('a', ['elevator'], 100), routeCandidate('b', ['escalator'], 105), routeCandidate('c', ['stairs'], 110)]
    const orders = [candidates, [candidates[0], candidates[2], candidates[1]], [candidates[1], candidates[0], candidates[2]],
      [candidates[1], candidates[2], candidates[0]], [candidates[2], candidates[0], candidates[1]], [candidates[2], candidates[1], candidates[0]]]
    for (const profile of Object.values(MOBILITY_PROFILES)) {
      const expected = selectBestRoute(candidates, profile).selected?.score
      for (const order of orders) expect(selectBestRoute(order, profile).selected?.score).toBe(expected)
    }
  })
  it('H: profile calls are independent of call order and return a reason per candidate', () => {
    const candidates = profileCandidates()
    const esFirst = selectBestRoute(candidates, MOBILITY_PROFILES['escalator-preferred']).selected?.score
    selectBestRoute(candidates, MOBILITY_PROFILES['elevator-preferred'])
    const balanced = selectBestRoute(candidates, MOBILITY_PROFILES.balanced).selected?.score
    expect(selectBestRoute(candidates, MOBILITY_PROFILES['escalator-preferred']).selected?.score).toBe(esFirst)
    expect(selectBestRoute(candidates, MOBILITY_PROFILES.balanced).selected?.score).toBe(balanced)
    expect(selectBestRoute(candidates, MOBILITY_PROFILES['elevator-preferred']).candidates.every(candidate => candidate.reason.length > 0)).toBe(true)
  })
})
