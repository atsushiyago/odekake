import type {
  OfficialDeparturePlatformAssignment,
  OfficialPlatformAssignment,
  ScheduledRailLeg,
} from '../../domain/itineraryConnection'
import { buildPublishedOutdoorWalkingRoute } from '../../domain/outdoorWalkingRoute'
import type { WalkingRoute } from '../../domain/types'

/** Weekday Yamanote Line leg extracted from official JR East GTFS. */
export const jrEastYamanoteWeekdayTrips: ScheduledRailLeg[] = [
  {
    tripId: '4210622G',
    routeId: '42',
    routeName: '山手線',
    serviceDay: 'weekday',
    directionId: '0',
    headsign: '東京・上野方面',
    from: {
      stationId: '4230',
      stationName: '品川',
      departureTime: '07:02',
      stopSequence: 1,
    },
    to: {
      stationId: '4229',
      stationName: '高輪ゲートウェイ',
      arrivalTime: '07:04',
      stopSequence: 2,
    },
    source: {
      url: 'https://api.odpt.org/api/v4/files/JR-East/data/JR-East-Train-GTFS-Pathway.zip',
      feedVersion: '20261025',
      retrievedAt: '2026-11-05',
    },
  },
]

export const takanawaGatewayOfficialPlatformAssignments: OfficialPlatformAssignment[] = [
  {
    stationId: '4229',
    platformId: '4229P1',
    routeId: '42',
    directionId: '0',
    headsign: '東京・上野方面',
    source: {
      url: 'https://www.jreast.co.jp/estation/stations/959.html',
      checkedAt: '2026-11-05',
      description: 'JR東日本公式：高輪ゲートウェイ駅 1番線（山手線内回り・東京・上野方面）ホーム',
    },
  },
]

export const shinagawaOfficialDeparturePlatformAssignments: OfficialDeparturePlatformAssignment[] = [
  {
    stationId: '4230',
    platformId: '4230P1',
    platformCode: '1',
    routeId: '42',
    directionId: '0',
    headsign: '東京・上野方面',
    source: {
      url: 'https://www.jreast.co.jp/estation/stations/788.html',
      checkedAt: '2026-11-05',
      description: 'JR東日本公式：品川駅 1番線（山手線内回り・東京・上野方面）ホーム',
    },
  },
]

export const takanawaGatewayToSengakujiWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'takanawa-gateway-to-sengakuji',
  from: {
    label: '高輪ゲートウェイ駅 北改札',
    latitude: 35.63581,
    longitude: 139.74068,
  },
  to: {
    label: '泉岳寺（赤穂義士墓所）',
    latitude: 35.637804,
    longitude: 139.736304,
  },
  officialMinutes: 7,
  sourceUrl: 'https://sengakuji.or.jp/access/',
  retrievedAt: '2026-11-05',
  stationExitConnection: {
    stationId: '4229',
    exitNodeId: '4229N0756',
    exitLabel: '北改札',
  },
  geometry: {
    type: 'LineString',
    coordinates: [
      [139.74068, 35.63581],
      [139.7397, 35.6359],
      [139.7388, 35.6368],
      [139.7378, 35.6373],
      [139.736304, 35.637804],
    ],
    distanceMeters: 450,
    durationSeconds: 420,
    source: {
      provider: 'OpenStreetMap',
      endpoint: 'https://sengakuji.or.jp/access/',
      acquiredAt: '2026-11-05',
    },
  },
})
