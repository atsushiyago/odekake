import { describe, expect, it } from 'vitest'
import { extractGtfsPathwaysStation, type GtfsPathwaysFeed } from './gtfsPathwaysAdapter'

describe('GTFS-Pathways station extractor', () => {
  it('uses parent_station descendants rather than coordinate proximity', () => {
    const feed: GtfsPathwaysFeed = {
      source: { name: 'test', url: 'https://example.invalid', license: 'test', feedVersion: 'test', retrievedAt: '2026-09-20' },
      levels: [{ levelId: 'B1', levelIndex: '-1' }],
      stops: [
        { stopId: 'station', stopName: 'Station', stopLat: '35', stopLon: '139', locationType: '1' },
        { stopId: 'platform', stopLat: '35', stopLon: '139', locationType: '0', parentStation: 'station', levelId: 'B1' },
        { stopId: 'boarding', stopLat: '35', stopLon: '139', locationType: '4', parentStation: 'platform', levelId: 'B1' },
        { stopId: 'exit', stopLat: '35', stopLon: '139', locationType: '2', parentStation: 'station' },
        { stopId: 'nearby-other-station', stopLat: '35.000001', stopLon: '139.000001', locationType: '0' }
      ],
      pathways: [
        { pathwayId: 'valid', fromStopId: 'boarding', toStopId: 'exit', pathwayMode: '1', isBidirectional: '1', length: '12.5' },
        { pathwayId: 'outside', fromStopId: 'boarding', toStopId: 'nearby-other-station', pathwayMode: '1', isBidirectional: '1', length: '1' }
      ]
    }
    const result = extractGtfsPathwaysStation(feed, { id: 'station', name: 'Station' })
    expect(result.stops.map(stop => stop.id)).toEqual(['station', 'platform', 'boarding', 'exit'])
    expect(result.stops.find(stop => stop.id === 'boarding')?.parentPlatformId).toBe('platform')
    expect(result.pathways.map(pathway => pathway.id)).toEqual(['valid'])
  })
})
