import { describe, expect, it } from 'vitest'
import { auditPathways, matchNodes, verifyPathway } from './auditGtfsWalkingPathwayCrosswalk.mjs'

const fixture = {
  levels: [{ levelId: 'L', levelIndex: -2 }],
  stops: [
    { stopId: 'a', levelId: 'L', stopLat: 35, stopLon: 139 },
    { stopId: 'b', levelId: 'L', stopLat: 35, stopLon: 139.0001 },
  ],
  pathways: [{ pathwayId: 'p', fromStopId: 'a', toStopId: 'b', pathwayMode: 4, isBidirectional: '0' }],
}
const walking = {
  nodes: [
    { id: 'x', floor: -3, latitude: 35, longitude: 139 },
    { id: 'y', floor: -3, latitude: 35, longitude: 139.0001 },
  ],
  links: [{ id: 'w', startId: 'x', endId: 'y', routeType: 5, direction: 2 }],
}
const mappings = [{ levelIndex: -2, dominantFloor: -3, status: 'unique' }]

describe('Pathway-level verified crosswalk', () => {
  it('verifies a shifted floor and same-type directed link without numeric equality', () => {
    const result = auditPathways(fixture, walking, mappings)
    expect(result.verified).toBe(1)
    expect(result.pathways[0]).toMatchObject({ walkingLinkId: 'w', fromFloor: -3, toFloor: -3 })
  })

  it('requires a resolved floor and unique endpoint node matches', () => {
    expect(auditPathways(fixture, walking, [{ ...mappings[0], status: 'unresolved' }]).pathways[0].reason).toBe('floor_unresolved')
    const tooFar = { ...walking, nodes: walking.nodes.map(node => ({ ...node, longitude: node.longitude + 0.01 })) }
    expect(auditPathways(fixture, tooFar, mappings).pathways[0].reason).toBe('node_unmatched')
    const ambiguous = { ...walking, nodes: [...walking.nodes, { ...walking.nodes[0], id: 'x2' }] }
    expect(auditPathways(fixture, ambiguous, mappings).pathways[0].reason).toBe('node_ambiguous')
  })

  it('separates missing, multiple, mismatched-mode, and mismatched-direction links', () => {
    expect(auditPathways(fixture, { ...walking, links: [] }, mappings).pathways[0].reason).toBe('no_walking_link')
    expect(auditPathways(fixture, { ...walking, links: [...walking.links, { ...walking.links[0], id: 'w2' }] }, mappings).pathways[0].reason).toBe('multiple_walking_links')
    expect(auditPathways(fixture, { ...walking, links: [{ ...walking.links[0], routeType: 4 }] }, mappings).pathways[0].reason).toBe('mode_mismatch')
    expect(auditPathways(fixture, { ...walking, links: [{ ...walking.links[0], direction: 3 }] }, mappings).pathways[0].reason).toBe('direction_mismatch')
    expect(auditPathways({ ...fixture, pathways: [{ ...fixture.pathways[0], isBidirectional: '1' }] }, walking, mappings).pathways[0].reason).toBe('direction_mismatch')
  })

  it('does not conflate two GTFS endpoints claiming one walking node', () => {
    const duplicated = { ...fixture, stops: [{ ...fixture.stops[0] }, { ...fixture.stops[0], stopId: 'b' }] }
    const nodes = matchNodes(duplicated, walking, mappings)
    expect(nodes.get('a').status).toBe('node_ambiguous')
    expect(verifyPathway(fixture.pathways[0], nodes, new Map()).reason).toBe('node_ambiguous')
  })
})
