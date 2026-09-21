import { describe, expect, it } from 'vitest'
import { akabanebashiFixedWeekdayRailLeg, akabanebashiOfficialPlatformAssignments } from '../data/fixtures/akabanebashi-arrival-itinerary'
import { akabanebashiGtfsPathways } from '../data/fixtures/akabanebashi-gtfs-pathways'
import { buildGtfsStationGuide, buildIndoorGraph } from './indoorRouting'
import { resolveArrivalPlatform } from './itineraryConnection'

describe('fixed itinerary to StationGuide connection', () => {
  it('passes only the officially resolved arrival platform to the GTFS indoor route', () => {
    const arrival = resolveArrivalPlatform(akabanebashiFixedWeekdayRailLeg, '422', akabanebashiOfficialPlatformAssignments)
    expect(arrival.ok).toBe(true)
    if (!arrival.ok) return
    const guide = buildGtfsStationGuide(
      buildIndoorGraph(akabanebashiGtfsPathways),
      { id: '422', name: '赤羽橋', operator: '東京都交通局', line: '大江戸線' },
      { platformId: arrival.connection.platformId, exitNodeId: '422N0012' },
    )
    expect(guide).toMatchObject({ ok: true, guide: { arrivalPlatform: '2番ホーム', exit: '赤羽橋口' } })
  })
})
