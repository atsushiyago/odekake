import type { ScheduledRailLeg } from '../../domain/itineraryConnection'

/**
 * Machine-extracted from the official Toei static GTFS 20260916 feed.
 * This reverse-direction row is kept separately because the earlier generated
 * direct-leg index covered only the outward (direction_id=0) sample set.
 */
export const toeiOedoReverseExtractedDirectLegs: ScheduledRailLeg[] = [{
  tripId: '410629A0', routeId: '4', routeName: '都営大江戸線', serviceDay: 'weekday', directionId: '1', headsign: '都庁前',
  from: { stationId: '422', stationName: '赤羽橋', departureTime: '07:04', stopSequence: 18 },
  to: { stationId: '421', stationName: '大門', arrivalTime: '07:07', stopSequence: 19 },
  source: { url: 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip', feedVersion: '20260916', retrievedAt: '2026-09-21' },
}]
