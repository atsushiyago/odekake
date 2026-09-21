import { describe, expect, it } from 'vitest'
import { deriveIndoorDirections, type IndoorGraph, type IndoorRoute } from './indoorRouting'

function graphFor(next: { id: string; latitude: number; longitude: number }, context?: Record<string, { spaceId?: string; facilityId?: string }>) {
  const nodes = new Map([
    ['a', { id: 'a', latitude: 35, longitude: 139, locationType: 3, kind: 'internal' as const }],
    ['b', { id: 'b', latitude: 35, longitude: 139.0001, locationType: 3, kind: 'internal' as const }],
    ['c', { id: next.id, latitude: next.latitude, longitude: next.longitude, locationType: 3, kind: 'internal' as const }],
    ['branch', { id: 'branch', latitude: 35.0001, longitude: 139.0001, locationType: 3, kind: 'internal' as const }],
  ])
  const edges = [
    { id: 'e1', fromNodeId: 'a', toNodeId: 'b', lengthMeters: 12, movementType: 'walk' as const, sourceType: 'gtfs-pathways' as const },
    { id: 'e2', fromNodeId: 'b', toNodeId: next.id, lengthMeters: 12, movementType: 'walk' as const, sourceType: 'gtfs-pathways' as const },
    { id: 'branch-edge', fromNodeId: 'b', toNodeId: 'branch', lengthMeters: 12, movementType: 'walk' as const, sourceType: 'gtfs-pathways' as const },
  ]
  const adjacency = new Map<string, typeof edges>([['a', [edges[0]]], ['b', [edges[1], edges[2]]], ['c', []], ['branch', []]])
  return { source: { name: 'test', url: 'https://example.test', license: 'test', feedVersion: '1', retrievedAt: '2026-09-20' }, stationId: 'test', stationName: 'test', nodes, edges, adjacency, context: context ? { byPathwayId: context } : undefined }
}

function route(g: ReturnType<typeof graphFor>): IndoorRoute { return { nodes: [g.nodes.get('a')!, g.nodes.get('b')!, g.nodes.get('c')!], edges: g.edges.slice(0, 2), distanceMeters: 24 } }

describe('deriveIndoorDirections', () => {
  it('reports a clear left turn with provenance', () => {
    const g = graphFor({ id: 'c', latitude: 35.0001, longitude: 139.0001 })
    const decision = deriveIndoorDirections(g, route(g)).get('e2')
    expect(decision?.result).toBe('left')
    expect(decision?.previousNodeId).toBe('a')
    expect(decision?.currentNodeId).toBe('b')
    expect(decision?.nextNodeId).toBe('c')
  })

  it.each([
    ['right', 34.9999, 139.0001],
    ['straight', 35, 139.0002],
  ] as const)('classifies a clear %s geometry', (expected, latitude, longitude) => {
    const g = graphFor({ id: 'c', latitude, longitude })
    expect(deriveIndoorDirections(g, route(g)).get('e2')?.result).toBe(expected)
  })

  it('omits a tiny geometry change and same-space turns', () => {
    const tiny = graphFor({ id: 'c', latitude: 35.000001, longitude: 139.0001 })
    expect(deriveIndoorDirections(tiny, route(tiny)).get('e2')?.result).toBeUndefined()
    const same = graphFor({ id: 'c', latitude: 35.0001, longitude: 139.0001 }, { e1: { spaceId: 'S1' }, e2: { spaceId: 'S1' } })
    expect(deriveIndoorDirections(same, route(same), same.context).get('e2')?.reason).toBe('same space')
  })
})
