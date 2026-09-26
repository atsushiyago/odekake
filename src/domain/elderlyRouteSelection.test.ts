import { describe, expect, it } from 'vitest'
import { selectBestElderlyRoute, type ElderlyRouteScore } from './elderlyRouteScoring'

// Synthetic scored routes: no real station or equipment identifiers.
function candidate(id: string, distance: number, uses = 1, es = 0, stairs = 0): ElderlyRouteScore {
  const nodes = ['platform', 'exit'].map(id => ({ id, name: id, latitude: 0, longitude: 0, locationType: 3, kind: 'internal' as const }))
  return {
    originId: 'platform', exitId: 'exit', stairs, escalators: es, elevators: uses - es - stairs,
    equipmentChanges: 0, decisionPoints: 0, distanceMeters: distance, equipmentUses: uses,
    ranking: [stairs, 0, 0, distance, uses],
    route: { nodes, distanceMeters: distance, edges: [{ id, fromNodeId: 'platform', toNodeId: 'exit',
      lengthMeters: distance, movementType: 'walk', sourceType: 'gtfs-pathways' }] },
  }
}

function permutations<T>(items: T[]): T[][] {
  return items.length ? items.flatMap((item, index) => permutations(items.filter((_, i) => i !== index)).map(rest => [item, ...rest])) : [[]]
}

describe('candidate-set elderly selection', () => {
  const a = candidate('A', 100, 3)
  const b = candidate('B', 109, 2)
  const c = candidate('C', 118, 1)

  it('A: resolves the old pairwise cycle using one minimum-distance anchor', () => {
    // Reproduce the former distance/usage comparison on this equal-hard-score fixture.
    const oldPair = (x: ElderlyRouteScore, y: ElderlyRouteScore) => Math.abs(x.distanceMeters - y.distanceMeters) <= 10
      ? x.equipmentUses - y.equipmentUses : x.distanceMeters - y.distanceMeters
    expect(oldPair(b, a)).toBeLessThan(0)
    expect(oldPair(c, b)).toBeLessThan(0)
    expect(oldPair(a, c)).toBeLessThan(0)
    expect(selectBestElderlyRoute([a, b, c])).toBe(b)
  })

  it('B: all six permutations select B without mutating the input', () => {
    const orders = permutations([a, b, c])
    expect(orders).toHaveLength(6)
    for (const order of orders) {
      const original = [...order]
      expect(selectBestElderlyRoute(Object.freeze(order))).toBe(b)
      expect(order).toEqual(original)
    }
  })

  it.each([109.9, 110, 110.1])('C: inclusive Dmin + 10m boundary at %s', distance => {
    const other = candidate('boundary', distance, 1)
    expect(selectBestElderlyRoute([other, a])).toBe(distance <= 110 ? other : a)
  })

  it('D: preserves weak ES preference within the fixed distance group', () => {
    const ev = candidate('EV', 100)
    const es = candidate('ES', 105, 1, 1)
    expect(selectBestElderlyRoute([ev, es])).toBe(es)
  })

  it('E: ES preference cannot select an 80m detour', () => {
    const ev = candidate('EV', 100)
    expect(selectBestElderlyRoute([candidate('ES', 180, 1, 1), ev])).toBe(ev)
  })

  it('F: fewer stairs takes precedence over distance', () => {
    const fewer = candidate('fewer-stairs', 180)
    expect(selectBestElderlyRoute([candidate('stairs', 100, 1, 0, 1), fewer])).toBe(fewer)
  })

  it('G: exact ties use directed traversal, independent of input order', () => {
    const forward = candidate('same-pathway', 100)
    const reverse = candidate('same-pathway', 100)
    reverse.originId = 'exit'
    reverse.exitId = 'platform'
    reverse.route.nodes.reverse()
    reverse.route.edges[0] = { ...reverse.route.edges[0], fromNodeId: 'exit', toNodeId: 'platform' }
    const selected = selectBestElderlyRoute([forward, reverse])
    expect(selected).toBe(reverse)
    expect(selectBestElderlyRoute([reverse, forward])).toBe(selected)
    const laterId = candidate('zzz', 100)
    const earlierId = candidate('aaa', 100)
    expect(selectBestElderlyRoute([laterId, earlierId])).toBe(earlierId)
    expect(selectBestElderlyRoute([earlierId, laterId])).toBe(earlierId)
  })

  it('uses equipment changes then decision points as hard priorities before Dmin', () => {
    const best = candidate('best', 200)
    const changes = candidate('changes', 10)
    changes.equipmentChanges = 1
    const branches = candidate('branches', 20)
    branches.decisionPoints = 1
    expect(selectBestElderlyRoute([changes, branches, best])).toBe(best)
  })

  it('returns null for empty/unreachable/invalid candidates', () => {
    const disconnected = candidate('broken', 1)
    disconnected.route.edges[0].toNodeId = 'unreachable'
    expect(selectBestElderlyRoute([])).toBeNull()
    expect(selectBestElderlyRoute([disconnected, candidate('invalid', NaN)])).toBeNull()
    expect(selectBestElderlyRoute([disconnected, a])).toBe(a)
  })
})
