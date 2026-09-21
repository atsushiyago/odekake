import { describe, expect, it } from 'vitest'
import { akabanebashiFixedWeekdayRailLeg, akabanebashiOfficialPlatformAssignments, daimonOfficialDeparturePlatformAssignments } from '../data/fixtures/akabanebashi-arrival-itinerary'
import { resolveArrivalPlatform, resolveDeparturePlatform } from './itineraryConnection'

describe('resolveArrivalPlatform', () => {
  it('uses a separately sourced official platform assignment instead of inferring a platform from GTFS', () => {
    const result = resolveArrivalPlatform(akabanebashiFixedWeekdayRailLeg, '422', akabanebashiOfficialPlatformAssignments)
    expect(result).toMatchObject({ ok: true, connection: { platformId: '422P2', leg: { tripId: '400613B0', from: { stationId: '421', departureTime: '07:03' }, to: { stationId: '422', arrivalTime: '07:05' } } } })
  })

  it('returns no result when the official platform assignment is absent', () => {
    expect(resolveArrivalPlatform(akabanebashiFixedWeekdayRailLeg, '422', [])).toEqual({ ok: false, reason: 'no-official-platform-assignment' })
  })
})

describe('resolveDeparturePlatform', () => {
  it('matches the fixed leg to the official Daimon platform assignment', () => {
    expect(resolveDeparturePlatform(akabanebashiFixedWeekdayRailLeg, '421', daimonOfficialDeparturePlatformAssignments)).toMatchObject({ ok: true, assignment: { platformId: '421P4', platformCode: '4', source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/daimon/i/solid.png' } } })
  })

  it('does not infer a departure platform when direction does not match', () => {
    expect(resolveDeparturePlatform({ ...akabanebashiFixedWeekdayRailLeg, headsign: '都庁前' }, '421', daimonOfficialDeparturePlatformAssignments)).toEqual({ ok: false, reason: 'no-official-platform-assignment' })
  })
})
