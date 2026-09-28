import { describe, expect, it } from 'vitest'
import { confirmedNodeSeeds, resolveFloorMappings, reevaluate } from './auditGtfsWalkingFloorMapping.mjs'

const fixture = {
  levels: [{ levelId: 'L', levelIndex: -2 }],
  stops: [
    { stopId: 'a', levelId: 'L', stopLat: 35, stopLon: 139 },
    { stopId: 'b', levelId: 'L', stopLat: 35, stopLon: 139.0001 },
    { stopId: 'c', levelId: 'L', stopLat: 35, stopLon: 139.0002 },
  ],
  pathways: [{ fromStopId: 'a', toStopId: 'b', pathwayMode: 1 }, { fromStopId: 'b', toStopId: 'c', pathwayMode: 1 }],
}
const walking = {
  nodes: [
    { id: 'x', floor: -3, latitude: 35, longitude: 139 },
    { id: 'y', floor: -3, latitude: 35, longitude: 139.0001 },
    { id: 'z', floor: -3, latitude: 35, longitude: 139.0002 },
  ],
  links: [
    { startId: 'x', endId: 'y', routeType: 1, direction: 1 },
    { startId: 'y', endId: 'z', routeType: 1, direction: 1 },
  ],
}

describe('floor-independent GTFS/walking audit', () => {
  it('infers a shifted floor from spatial and adjacent-link evidence', () => {
    const seeds = confirmedNodeSeeds(fixture, walking)
    expect(seeds).toHaveLength(3)
    const mapping = resolveFloorMappings(seeds, [-2])
    expect(mapping[0]).toMatchObject({ levelIndex: -2, dominantFloor: -3, status: 'unique' })
    expect(reevaluate(fixture, walking, mapping).map(row => row.classification)).toEqual(['exact', 'exact', 'exact'])
  })

  it('does not resolve a mixed floor, even when one candidate is numerically equal', () => {
    const seeds = [
      { levelIndex: -2, walkingFloor: -3 }, { levelIndex: -2, walkingFloor: -3 },
      { levelIndex: -2, walkingFloor: -2 }, { levelIndex: -2, walkingFloor: -2 },
    ]
    expect(resolveFloorMappings(seeds, [-2])[0].status).toBe('unresolved')
  })

  it('does not use a spatial match without adjacent topology evidence', () => {
    expect(confirmedNodeSeeds({ ...fixture, pathways: [] }, walking)).toHaveLength(0)
  })
})
