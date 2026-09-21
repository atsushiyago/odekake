import type { OfficialDeparturePlatformAssignment, OfficialPlatformAssignment, ScheduledRailLeg } from '../../domain/itineraryConnection'

/**
 * A fixed weekday example extracted from the official Toei static GTFS feed.
 * stop_times identifies the station/time; it does not contain platform data.
 */
export const akabanebashiFixedWeekdayRailLeg: ScheduledRailLeg = {
  tripId: '400613B0', routeId: '4', routeName: '都営大江戸線', serviceDay: 'weekday', directionId: '0', headsign: '光が丘',
  from: { stationId: '421', stationName: '大門', departureTime: '07:03', stopSequence: 21 },
  to: { stationId: '422', stationName: '赤羽橋', arrivalTime: '07:05', stopSequence: 22 },
  source: { url: 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip', feedVersion: '20260916', retrievedAt: '2026-09-20' },
}

/**
 * The platform number is a separate, literal official facility fact. It is not
 * derived from GTFS. The cited Tokyo Metropolitan Bureau of Transportation PDF
 * labels platform 2 as the Shinjuku / Hikarigaoka direction at Akabanebashi.
 */
export const akabanebashiOfficialPlatformAssignments: OfficialPlatformAssignment[] = [{
  stationId: '422', platformId: '422P2', routeId: '4', directionId: '0', headsign: '光が丘',
  source: {
    url: 'https://www.kotsu.metro.tokyo.jp/subway/kanren/inspection/pdf/inspection202509_04.pdf',
    checkedAt: '2026-09-20',
    description: '東京都交通局公式資料：赤羽橋駅 2番線（新宿・光が丘方面）ホーム',
  },
}]

/** Official departure-side assignment for the reverse Akabanebashi → Daimon leg. */
export const akabanebashiOfficialDeparturePlatformAssignments: OfficialDeparturePlatformAssignment[] = [{
  stationId: '422', platformId: '422P1', platformCode: '1', routeId: '4', directionId: '1', headsign: '都庁前',
  source: {
    url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/akabanebashi/i/solid.png',
    checkedAt: '2026-09-21',
    description: '東京都交通局公式構内図：赤羽橋駅 1番線（大門・両国方面）ホーム',
  },
}]

/** Official departure-side assignment for the fixed Daimon → Akabanebashi leg. */
export const daimonOfficialDeparturePlatformAssignments: OfficialDeparturePlatformAssignment[] = [{
  stationId: '421', platformId: '421P4', platformCode: '4', routeId: '4', directionId: '0', headsign: '光が丘',
  source: {
    url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/daimon/i/solid.png',
    checkedAt: '2026-09-20',
    description: '東京都交通局公式構内図：大江戸線 4 六本木方面（赤羽橋）ホーム',
  },
}]

/** Official arrival-side assignment for the reverse Akabanebashi → Daimon leg. */
export const daimonOfficialPlatformAssignments: OfficialPlatformAssignment[] = [{
  stationId: '421', platformId: '421P3', routeId: '4', directionId: '1', headsign: '都庁前',
  source: {
    url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/daimon/i/solid.png',
    checkedAt: '2026-09-21',
    description: '東京都交通局公式構内図：大門駅 3番線（都庁前方面）ホーム',
  },
}]

/** Official arrival-side assignment for the Daimon → Azabu-juban leg. */
export const azabuJubanOfficialPlatformAssignments: OfficialPlatformAssignment[] = [{
  stationId: '423', platformId: '423P2', routeId: '4', directionId: '0', headsign: '光が丘',
  source: {
    url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/azabu-juban/i/solid.png',
    checkedAt: '2026-09-21',
    description: '東京都交通局公式構内図：麻布十番駅 2番線（六本木・光が丘方面）ホーム',
  },
}]

export const roppongiOfficialPlatformAssignments: OfficialPlatformAssignment[] = [{
  stationId: '424', platformId: '424P2', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/roppongi/i/solid.png', checkedAt: '2026-09-21', description: '東京都交通局公式構内図：六本木駅 2番線（新宿・光が丘方面）ホーム' },
}]

export const roppongiOfficialDeparturePlatformAssignments: OfficialDeparturePlatformAssignment[] = [{
  stationId: '424', platformId: '424P2', platformCode: '2', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/roppongi/i/solid.png', checkedAt: '2026-09-21', description: '東京都交通局公式構内図：六本木駅 2番線（新宿・光が丘方面）ホーム' },
}]

export const kokuritsuKyogijoOfficialPlatformAssignments: OfficialPlatformAssignment[] = [{
  stationId: '426', platformId: '426P2', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/kokuritsu-kyogijo/i/solid.png', checkedAt: '2026-09-21', description: '東京都交通局公式構内図：国立競技場駅 2番線（光が丘方面）ホーム' },
}]

export const roppongiToAoyamaOfficialDeparturePlatformAssignments: OfficialDeparturePlatformAssignment[] = [{
  stationId: '424', platformId: '424P2', platformCode: '2', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/roppongi.html', checkedAt: '2026-09-21', description: '東京都交通局公式 六本木駅構内図：青山一丁目・光が丘方面の2番線' },
}]
export const aoyamaItchomeOfficialPlatformAssignments: OfficialPlatformAssignment[] = [{
  stationId: '425', platformId: '425P2', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/aoyama-itchome.html', checkedAt: '2026-09-21', description: '東京都交通局公式 青山一丁目駅構内図：光が丘方面の2番線' },
}]
export const kokuritsuToYoyogiOfficialDeparturePlatformAssignments: OfficialDeparturePlatformAssignment[] = [{
  stationId: '426', platformId: '426P2', platformCode: '2', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/kokuritsu-kyogijo.html', checkedAt: '2026-09-21', description: '東京都交通局公式 国立競技場駅構内図：光が丘方面の2番線' },
}]
export const yoyogiOfficialPlatformAssignments: OfficialPlatformAssignment[] = [{
  stationId: '427', platformId: '427P2', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/yoyogi.html', checkedAt: '2026-09-21', description: '東京都交通局公式 代々木駅構内図：光が丘方面の2番線' },
}]
export const shinjukuNishiguchiToHigashiOfficialDeparturePlatformAssignments: OfficialDeparturePlatformAssignment[] = [{
  stationId: '402', platformId: '402P2', platformCode: '2', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku-nishiguchi.html', checkedAt: '2026-09-21', description: '東京都交通局公式 新宿西口駅構内図：光が丘方面の2番線' },
}]
export const higashiShinjukuOfficialPlatformAssignments: OfficialPlatformAssignment[] = [{
  stationId: '403', platformId: '403P2', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/higashi-shinjuku.html', checkedAt: '2026-09-21', description: '東京都交通局公式 東新宿駅構内図：光が丘方面の2番線' },
}]
export const yoyogiToShinjukuOfficialDeparturePlatformAssignments: OfficialDeparturePlatformAssignment[] = [{
  stationId: '427', platformId: '427P2', platformCode: '2', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/yoyogi.html', checkedAt: '2026-09-21', description: '東京都交通局公式 代々木駅構内図：光が丘方面の2番線' },
}]
export const shinjukuOfficialPlatformAssignments: OfficialPlatformAssignment[] = [{
  stationId: '428', platformId: '428P7', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku.html', checkedAt: '2026-09-21', description: '東京都交通局公式 新宿駅構内図：光が丘方面の7番線' },
}]

export const shinjukuOfficialDeparturePlatformAssignments: OfficialDeparturePlatformAssignment[] = [{
  stationId: '428', platformId: '428P7', platformCode: '7', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku.html', checkedAt: '2026-09-21', description: '東京都交通局公式 新宿駅構内図：光が丘方面の7番線' },
}]
export const higashiShinjukuToShinjukuNishiguchiOfficialDeparturePlatformAssignments: OfficialDeparturePlatformAssignment[] = [{
  stationId: '403', platformId: '403P1', platformCode: '1', routeId: '4', directionId: '1', headsign: '都庁前',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/higashi-shinjuku.html', checkedAt: '2026-09-21', description: '東京都交通局公式 東新宿駅構内図：都庁前方面の1番線' },
}]
export const shinjukuNishiguchiOfficialPlatformAssignments: OfficialPlatformAssignment[] = [{
  stationId: '402', platformId: '402P1', routeId: '4', directionId: '1', headsign: '都庁前',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku-nishiguchi.html', checkedAt: '2026-09-21', description: '東京都交通局公式 新宿西口駅構内図：都庁前方面の1番線' },
}]

export const uenoOkachimachiOfficialPlatformAssignments: OfficialPlatformAssignment[] = [{
  stationId: '410', platformId: '410P1', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/ueno-okachimachi.html', checkedAt: '2026-09-21', description: '東京都交通局公式 上野御徒町駅構内図：1番線（飯田橋・都庁前方面）' },
}]

export const tochomaeOfficialPlatformAssignments: OfficialPlatformAssignment[] = [{
  stationId: '429', platformId: '429P4', routeId: '4', directionId: '0', headsign: '光が丘',
  source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/timetable/oedo/E28BD.html', checkedAt: '2026-09-21', description: '東京都交通局公式 都庁前駅時刻表：練馬・光が丘方面は全列車4番線' },
}]
