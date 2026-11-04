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
  {
    tripId: '4210668G',
    routeId: '42',
    routeName: '山手線',
    serviceDay: 'weekday',
    directionId: '1',
    headsign: '渋谷・品川方面',
    from: {
      stationId: '4208',
      stationName: '新宿',
      departureTime: '07:01',
      stopSequence: 5,
    },
    to: {
      stationId: '4205',
      stationName: '渋谷',
      arrivalTime: '07:08',
      stopSequence: 8,
    },
    source: {
      url: 'https://api.odpt.org/api/v4/files/JR-East/data/JR-East-Train-GTFS-Pathway.zip',
      feedVersion: '20261025',
      retrievedAt: '2026-11-05',
    },
  },
  {
    tripId: '4200601G',
    routeId: '42',
    routeName: '山手線',
    serviceDay: 'weekday',
    directionId: '0',
    headsign: '池袋・上野方面',
    from: {
      stationId: '4208',
      stationName: '新宿',
      departureTime: '07:13',
      stopSequence: 8,
    },
    to: {
      stationId: '4212',
      stationName: '池袋',
      arrivalTime: '07:22',
      stopSequence: 12,
    },
    source: {
      url: 'https://api.odpt.org/api/v4/files/JR-East/data/JR-East-Train-GTFS-Pathway.zip',
      feedVersion: '20261025',
      retrievedAt: '2026-11-05',
    },
  },
  {
    tripId: '4200605G',
    routeId: '42',
    routeName: '山手線',
    serviceDay: 'weekday',
    directionId: '0',
    headsign: '品川・渋谷方面',
    from: {
      stationId: '4224',
      stationName: '東京',
      departureTime: '07:13',
      stopSequence: 24,
    },
    to: {
      stationId: '4230',
      stationName: '品川',
      arrivalTime: '07:26',
      stopSequence: 30,
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

export const shibuyaOfficialPlatformAssignments: OfficialPlatformAssignment[] = [
  {
    stationId: '4205',
    platformId: '4205P2',
    routeId: '42',
    directionId: '1',
    headsign: '渋谷・品川方面',
    source: {
      url: 'https://www.jreast.co.jp/estation/stations/808.html',
      checkedAt: '2026-11-05',
      description: 'JR東日本公式：渋谷駅 2番線（山手線外回り・品川・東京方面）ホーム',
    },
  },
]

export const ikebukuroOfficialPlatformAssignments: OfficialPlatformAssignment[] = [
  {
    stationId: '4212',
    platformId: '4212P7',
    routeId: '42',
    directionId: '0',
    headsign: '池袋・上野方面',
    source: {
      url: 'https://www.jreast.co.jp/estation/stations/108.html',
      checkedAt: '2026-11-05',
      description: 'JR東日本公式：池袋駅 7番線（山手線外回り・田端・上野方面）ホーム',
    },
  },
]

export const shinagawaOfficialPlatformAssignments: OfficialPlatformAssignment[] = [
  {
    stationId: '4230',
    platformId: '4230P3',
    routeId: '42',
    directionId: '0',
    headsign: '品川・渋谷方面',
    source: {
      url: 'https://www.jreast.co.jp/estation/stations/788.html',
      checkedAt: '2026-11-05',
      description: 'JR東日本公式：品川駅 3番線（山手線外回り・渋谷・新宿方面）ホーム',
    },
  },
]

export const tokyoOfficialDeparturePlatformAssignments: OfficialDeparturePlatformAssignment[] = [
  {
    stationId: '4224',
    platformId: '4224P5',
    platformCode: '5',
    routeId: '42',
    directionId: '0',
    headsign: '品川・渋谷方面',
    source: {
      url: 'https://www.jreast.co.jp/estation/stations/1039.html',
      checkedAt: '2026-11-05',
      description: 'JR東日本公式：東京駅 5番線（山手線外回り・品川・渋谷方面）ホーム',
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

export const shinjukuJrOfficialDeparturePlatformAssignments: OfficialDeparturePlatformAssignment[] = [
  {
    stationId: '4208',
    platformId: '4208P14',
    platformCode: '14',
    routeId: '42',
    directionId: '1',
    headsign: '渋谷・品川方面',
    source: {
      url: 'https://www.jreast.co.jp/estation/stations/866.html',
      checkedAt: '2026-11-05',
      description: 'JR東日本公式：新宿駅 14番線（山手線内回り・渋谷・品川方面）ホーム',
    },
  },
  {
    stationId: '4208',
    platformId: '4208P15',
    platformCode: '15',
    routeId: '42',
    directionId: '0',
    headsign: '池袋・上野方面',
    source: {
      url: 'https://www.jreast.co.jp/estation/stations/866.html',
      checkedAt: '2026-11-05',
      description: 'JR東日本公式：新宿駅 15番線（山手線外回り・池袋・上野方面）ホーム',
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

export const shibuyaToHachikoWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'shibuya-to-hachiko',
  from: {
    label: '渋谷駅 ハチ公口',
    latitude: 35.659133,
    longitude: 139.700988,
  },
  to: {
    label: 'ハチ公前広場（忠犬ハチ公像）',
    latitude: 35.659058,
    longitude: 139.70063,
  },
  officialMinutes: 1,
  sourceUrl: 'https://www.shibuyabunka.com/hachiko/',
  retrievedAt: '2026-11-05',
  stationExitConnection: {
    stationId: '4205',
    exitNodeId: '4205N1534',
    exitLabel: 'ハチ公口',
  },
  geometry: {
    type: 'LineString',
    coordinates: [
      [139.700988, 35.659133],
      [139.7008, 35.6591],
      [139.70063, 35.659058],
    ],
    distanceMeters: 40,
    durationSeconds: 60,
    source: {
      provider: 'OpenStreetMap',
      endpoint: 'https://www.shibuyabunka.com/hachiko/',
      acquiredAt: '2026-11-05',
    },
  },
})

export const ikebukuroToTokyoMetropolitanTheatreWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'ikebukuro-to-tokyo-metropolitan-theatre',
  from: {
    label: '池袋駅 西口(中央)',
    latitude: 35.730729,
    longitude: 139.710037,
  },
  to: {
    label: '東京芸術劇場（池袋西口公園）',
    latitude: 35.729472,
    longitude: 139.708261,
  },
  officialMinutes: 2,
  sourceUrl: 'https://www.geigeki.jp/access/',
  retrievedAt: '2026-11-05',
  stationExitConnection: {
    stationId: '4212',
    exitNodeId: '4212N0956',
    exitLabel: '西口(中央)',
  },
  geometry: {
    type: 'LineString',
    coordinates: [
      [139.710037, 35.730729],
      [139.7094, 35.7303],
      [139.7089, 35.7299],
      [139.708261, 35.729472],
    ],
    distanceMeters: 180,
    durationSeconds: 120,
    source: {
      provider: 'OpenStreetMap',
      endpoint: 'https://www.geigeki.jp/access/',
      acquiredAt: '2026-11-05',
    },
  },
})

export const shinagawaToAquaParkWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'shinagawa-to-aqua-park',
  from: {
    label: '品川駅 高輪口',
    latitude: 35.628668,
    longitude: 139.738204,
  },
  to: {
    label: 'マクセル アクアパーク品川（品川プリンスホテル）',
    latitude: 35.628121,
    longitude: 139.736475,
  },
  officialMinutes: 2,
  sourceUrl: 'https://www.aqua-park.jp/aqua/access/',
  retrievedAt: '2026-11-05',
  stationExitConnection: {
    stationId: '4230',
    exitNodeId: '4230N0005',
    exitLabel: '高輪口',
  },
  geometry: {
    type: 'LineString',
    coordinates: [
      [139.738204, 35.628668],
      [139.7376, 35.6285],
      [139.7370, 35.6283],
      [139.736475, 35.628121],
    ],
    distanceMeters: 170,
    durationSeconds: 120,
    source: {
      provider: 'OpenStreetMap',
      endpoint: 'https://www.aqua-park.jp/aqua/access/',
      acquiredAt: '2026-11-05',
    },
  },
})
