import type { ScheduledRailLeg } from '../../domain/itineraryConnection'

/** Machine-extracted from Toei static GTFS feed version 20260916 (weekday, first service after 07:00). */
export const toeiOedoAddedDirectLegs: ScheduledRailLeg[] = [
  {
    tripId: '400644B0', routeId: '4', routeName: '都営大江戸線', serviceDay: 'weekday', directionId: '0', headsign: '光が丘',
    from: { stationId: '402', stationName: '新宿西口', departureTime: '07:01', stopSequence: 2 }, to: { stationId: '410', stationName: '上野御徒町', arrivalTime: '07:18', stopSequence: 10 },
    source: { url: 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip', feedVersion: '20260916', retrievedAt: '2026-09-21' },
  },
  {
    tripId: '420609B0', routeId: '4', routeName: '都営大江戸線', serviceDay: 'weekday', directionId: '0', headsign: '光が丘',
    from: { stationId: '428', stationName: '新宿', departureTime: '07:03', stopSequence: 14 }, to: { stationId: '429', stationName: '都庁前', arrivalTime: '07:05', stopSequence: 15 },
    source: { url: 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip', feedVersion: '20260916', retrievedAt: '2026-09-21' },
  },
  {
    tripId: '400611B0', routeId: '4', routeName: '都営大江戸線', serviceDay: 'weekday', directionId: '0', headsign: '光が丘',
    from: { stationId: '424', stationName: '六本木', departureTime: '07:01', stopSequence: 24 }, to: { stationId: '425', stationName: '青山一丁目', arrivalTime: '07:03', stopSequence: 25 },
    source: { url: 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip', feedVersion: '20260916', retrievedAt: '2026-09-21' },
  },
  {
    tripId: '400636B0', routeId: '4', routeName: '都営大江戸線', serviceDay: 'weekday', directionId: '0', headsign: '光が丘',
    from: { stationId: '426', stationName: '国立競技場', departureTime: '07:01', stopSequence: 12 }, to: { stationId: '427', stationName: '代々木', arrivalTime: '07:04', stopSequence: 13 },
    source: { url: 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip', feedVersion: '20260916', retrievedAt: '2026-09-21' },
  },
  {
    tripId: '400644B0', routeId: '4', routeName: '都営大江戸線', serviceDay: 'weekday', directionId: '0', headsign: '光が丘',
    from: { stationId: '402', stationName: '新宿西口', departureTime: '07:01', stopSequence: 2 }, to: { stationId: '403', stationName: '東新宿', arrivalTime: '07:03', stopSequence: 3 },
    source: { url: 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip', feedVersion: '20260916', retrievedAt: '2026-09-21' },
  },
  {
    tripId: '400636B0', routeId: '4', routeName: '都営大江戸線', serviceDay: 'weekday', directionId: '0', headsign: '光が丘',
    from: { stationId: '427', stationName: '代々木', departureTime: '07:04', stopSequence: 13 }, to: { stationId: '428', stationName: '新宿', arrivalTime: '07:05', stopSequence: 14 },
    source: { url: 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip', feedVersion: '20260916', retrievedAt: '2026-09-21' },
  },
  {
    tripId: '410524A0', routeId: '4', routeName: '都営大江戸線', serviceDay: 'weekday', directionId: '1', headsign: '都庁前',
    from: { stationId: '403', stationName: '東新宿', departureTime: '07:02', stopSequence: 37 }, to: { stationId: '402', stationName: '新宿西口', arrivalTime: '07:05', stopSequence: 38 },
    source: { url: 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip', feedVersion: '20260916', retrievedAt: '2026-09-21' },
  },
]
