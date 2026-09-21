import { describe, expect, it } from 'vitest'
import type { ScheduledRailLeg } from '../../domain/itineraryConnection'
import { createStaticGtfsRailJourneyRepository, staticGtfsRailJourneyRepository } from './staticGtfsRailJourneyRepository'

describe('static GTFS rail journey search', () => {
  it('finds the same 07:03 Daimon to Akabanebashi trip through input data', () => {
    expect(staticGtfsRailJourneyRepository.findDirectJourney({ originName: '大門', destinationName: '赤羽橋', departureDate: '2026-09-21', departureTime: '07:00' })).toMatchObject({ ok: true, leg: { tripId: '400613B0', from: { departureTime: '07:03' }, to: { arrivalTime: '07:05' }, headsign: '光が丘' } })
  })

  it('finds the reverse Akabanebashi to Daimon leg from the official feed extraction', () => {
    expect(staticGtfsRailJourneyRepository.findDirectJourney({ originName: '赤羽橋', destinationName: '大門', departureDate: '2026-09-21', departureTime: '07:00' })).toMatchObject({ ok: true, leg: { tripId: '410629A0', directionId: '1', from: { departureTime: '07:04', stopSequence: 18 }, to: { arrivalTime: '07:07', stopSequence: 19 }, headsign: '都庁前' } })
  })

  it('finds both newly supported direct pairs from the extracted official GTFS rows', () => {
    expect(staticGtfsRailJourneyRepository.findDirectJourney({ originName: '大門', destinationName: '六本木', departureDate: '2026-09-21', departureTime: '07:00' })).toMatchObject({ ok: true, leg: { tripId: '400613B0', from: { departureTime: '07:03' }, to: { arrivalTime: '07:09' }, headsign: '光が丘' } })
    expect(staticGtfsRailJourneyRepository.findDirectJourney({ originName: '六本木', destinationName: '国立競技場', departureDate: '2026-09-21', departureTime: '07:00' })).toMatchObject({ ok: true, leg: { tripId: '400611B0', from: { departureTime: '07:01' }, to: { arrivalTime: '07:05' }, headsign: '光が丘' } })
    expect(staticGtfsRailJourneyRepository.findDirectJourney({ originName: '大門', destinationName: '麻布十番', departureDate: '2026-09-21', departureTime: '07:00' })).toMatchObject({ ok: true, leg: { tripId: '400613B0', from: { departureTime: '07:03', stopSequence: 21 }, to: { arrivalTime: '07:07', stopSequence: 23 }, headsign: '光が丘', directionId: '0' } })
  })

  it('finds the Yoyogi→Shinjuku and Higashi-Shinjuku→Shinjuku-Nishiguchi legs', () => {
    expect(staticGtfsRailJourneyRepository.findDirectJourney({ originName: '代々木', destinationName: '新宿', departureDate: '2026-09-21', departureTime: '07:00' })).toMatchObject({ ok: true, leg: { tripId: '400636B0', from: { departureTime: '07:04' }, to: { arrivalTime: '07:05' }, directionId: '0' } })
    expect(staticGtfsRailJourneyRepository.findDirectJourney({ originName: '東新宿', destinationName: '新宿西口', departureDate: '2026-09-21', departureTime: '07:00' })).toMatchObject({ ok: true, leg: { tripId: '410524A0', from: { departureTime: '07:02' }, to: { arrivalTime: '07:05' }, directionId: '1' } })
  })

  it('finds the two remaining course legs from the 20260916 extraction', () => {
    expect(staticGtfsRailJourneyRepository.findDirectJourney({ originName: '新宿西口', destinationName: '上野御徒町', departureDate: '2026-09-21', departureTime: '07:00' })).toMatchObject({ ok: true, leg: { tripId: '400644B0', from: { departureTime: '07:01' }, to: { arrivalTime: '07:18' }, directionId: '0' } })
    expect(staticGtfsRailJourneyRepository.findDirectJourney({ originName: '新宿', destinationName: '都庁前', departureDate: '2026-09-21', departureTime: '07:00' })).toMatchObject({ ok: true, leg: { tripId: '420609B0', from: { departureTime: '07:03' }, to: { arrivalTime: '07:05' }, directionId: '0' } })
  })

  it('does not pretend a weekend or missing station pair is searchable', () => {
    expect(staticGtfsRailJourneyRepository.findDirectJourney({ originName: '大門', destinationName: '赤羽橋', departureDate: '2026-09-20', departureTime: '07:00' })).toEqual({ ok: false, reason: 'weekend-not-supported' })
    expect(staticGtfsRailJourneyRepository.findDirectJourney({ originName: '赤羽橋', destinationName: '国立競技場', departureDate: '2026-09-21', departureTime: '07:00' })).toEqual({ ok: false, reason: 'no-scheduled-trip' })
  })

  it('searches any registered direct pair instead of checking station names in code', () => {
    const syntheticRows: ScheduledRailLeg[] = [
      {
        tripId: 'synthetic-da-ro', routeId: '4', routeName: '都営大江戸線', serviceDay: 'weekday', directionId: '0', headsign: '光が丘',
        from: { stationId: '421', stationName: '大門', departureTime: '07:01', stopSequence: 1 },
        to: { stationId: '424', stationName: '六本木', arrivalTime: '07:09', stopSequence: 2 },
        source: { url: 'test', feedVersion: 'test', retrievedAt: 'test' },
      },
      {
        tripId: 'synthetic-ro-ko', routeId: '4', routeName: '都営大江戸線', serviceDay: 'weekday', directionId: '0', headsign: '光が丘',
        from: { stationId: '424', stationName: '六本木', departureTime: '07:10', stopSequence: 1 },
        to: { stationId: '426', stationName: '国立競技場', arrivalTime: '07:15', stopSequence: 2 },
        source: { url: 'test', feedVersion: 'test', retrievedAt: 'test' },
      },
    ]
    const repository = createStaticGtfsRailJourneyRepository(syntheticRows)
    expect(repository.findDirectJourney({ originName: '大門', destinationName: '六本木', departureDate: '2026-09-21', departureTime: '07:00' })).toMatchObject({ ok: true, leg: { tripId: 'synthetic-da-ro' } })
    expect(repository.findDirectJourney({ originName: '六本木', destinationName: '国立競技場', departureDate: '2026-09-21', departureTime: '07:00' })).toMatchObject({ ok: true, leg: { tripId: 'synthetic-ro-ko' } })
    expect(repository.findDirectJourney({ originName: '国立競技場', destinationName: '六本木', departureDate: '2026-09-21', departureTime: '07:00' })).toEqual({ ok: false, reason: 'no-scheduled-trip' })
  })
})
