import type { ScheduledRailLeg } from '../../domain/itineraryConnection'

/** Machine-extracted from the official Toei static GTFS 20260916 feed. */
export const toeiOedoAzabuJubanDirectLegs: ScheduledRailLeg[] = [{
  tripId: '400613B0', routeId: '4', routeName: '都営大江戸線', serviceDay: 'weekday', directionId: '0', headsign: '光が丘',
  from: { stationId: '421', stationName: '大門', departureTime: '07:03', stopSequence: 21 },
  to: { stationId: '423', stationName: '麻布十番', arrivalTime: '07:07', stopSequence: 23 },
  source: { url: 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip', feedVersion: '20260916', retrievedAt: '2026-09-21' },
}]
