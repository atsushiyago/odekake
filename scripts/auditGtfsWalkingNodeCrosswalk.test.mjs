import { describe, expect, it } from 'vitest'
import { auditStation, haversineMeters, spatialClass, topologyVerdict } from './auditGtfsWalkingNodeCrosswalk.mjs'

describe('GTFS–walking node crosswalk audit', () => {
  it('uses meter distances and keeps the exact/strong thresholds explicit', () => {
    expect(haversineMeters({ latitude: 35, longitude: 139 }, { latitude: 35.001, longitude: 139 })).toBeCloseTo(111.195, 1)
    expect(spatialClass(0.5, 1)).toBe('exact')
    expect(spatialClass(1.5, 2)).toBe('strong')
    expect(spatialClass(0.1, 0.4)).toBe('ambiguous')
    expect(spatialClass(5.01, 20)).toBe('unmatched')
  })

  it('compares equipment semantics using each source’s distinct mode codes', () => {
    expect(topologyVerdict([4], [5])).toBe('vertical-compatible')
    expect(topologyVerdict([5], [4])).toBe('vertical-compatible')
    expect(topologyVerdict([2], [6])).toBe('vertical-compatible')
    expect(topologyVerdict([5], [5])).toBe('vertical-conflict')
    expect(topologyVerdict([6], [1])).toBe('gate-or-exit-not-comparable')
  })

  it('filters by floor and records topology without promoting a near node to route truth', () => {
    const fixture = {
      station: { id: 'fictional', name: '架空駅' },
      levels: [{ levelId: 'lower', levelIndex: '-2' }],
      stops: [{ stopId: 'g', stopName: '設備入口', stopLat: '35', stopLon: '139', locationType: '3', parentStation: 'fictional', levelId: 'lower' },
        { stopId: 'h', stopName: '設備出口', stopLat: '35.001', stopLon: '139', locationType: '3', parentStation: 'fictional', levelId: 'lower' }],
      pathways: [{ pathwayId: 'p', fromStopId: 'g', toStopId: 'h', pathwayMode: '4', isBidirectional: '1' }],
    }
    const walking = {
      completeness: 'full', files: {},
      nodes: [{ id: 'same-floor', latitude: 35, longitude: 139, floor: -2, inOut: 3 },
        { id: 'different-floor', latitude: 35, longitude: 139, floor: -1, inOut: 3 },
        { id: 'far', latitude: 35.001, longitude: 139, floor: -2, inOut: 3 }],
      links: [{ id: 'es', startId: 'same-floor', endId: 'far', routeType: 5, direction: 1 }],
    }
    const result = auditStation(fixture, walking, 'fictional')
    const row = result.stops[0]
    expect(row.nearestWalking).toMatchObject({ nodeId: 'same-floor', floor: -2, routeTypes: [5] })
    expect(row.nearestDistanceMeters).toBe(0)
    expect(row.candidateCountWithin2m).toBe(1)
    expect(row.topologyVerdict).toBe('vertical-compatible')
    expect(row.spatialClass).toBe('exact')
    expect(row.adjacentPathwayEvidence).toMatchObject({ sameWalkingLink: 1, sameEquipmentType: 1, sourceDirectionCompatible: 1 })
    expect(result.pathwayEvidence.bidirectionalCompatible).toBe(1)
  })
})
