import { buildPublishedOutdoorWalkingRoute } from '../../domain/outdoorWalkingRoute'
import type { WalkingRoute } from '../../domain/types'
import roppongiRouteJson from '../outdoorRoutes/roppongi-exit7-to-national-art-center.geojson?raw'
import kokuritsuRouteJson from '../outdoorRoutes/kokuritsu-a2-to-stadium.geojson?raw'
import daimonKyuShibaRikyuRouteJson from '../outdoorRoutes/daimon-b2-to-kyu-shiba-rikyu.geojson?raw'
import azabuJubanPatioRouteJson from '../outdoorRoutes/azabu-juban-exit7-to-patio-juban.geojson?raw'
import aoyamaRouteJson from '../outdoorRoutes/aoyama-itchome-exit1-to-jingu-gaien.geojson?raw'
import yoyogiRouteJson from '../outdoorRoutes/yoyogi-a2-to-meiji-jingu-yoyogi-gate.geojson?raw'
import higashiShinjukuRouteJson from '../outdoorRoutes/higashi-shinjuku-a2-to-bunka-center.geojson?raw'
import shinjukuHotelRouteJson from '../outdoorRoutes/shinjuku-a1-to-southern-tower.geojson?raw'
import omoideYokochoRouteJson from '../outdoorRoutes/shinjuku-nishiguchi-d3-to-omoide-yokocho.geojson?raw'
import uenoA7RouteJson from '../outdoorRoutes/ueno-okachimachi-a7-to-ameyoko.geojson?raw'
import tochomaeA4RouteJson from '../outdoorRoutes/tochomae-a4-to-tocho-first-building.geojson?raw'

type RoutedGeoJson = { routes: Array<{ geometry: { type: 'LineString'; coordinates: Array<[number, number]> }; distance: number; duration: number }> }
const routeGeometry = (raw: string) => {
  const route = (JSON.parse(raw) as RoutedGeoJson).routes[0]
  return { type: route.geometry.type, coordinates: route.geometry.coordinates, distanceMeters: route.distance, durationSeconds: route.duration, source: { provider: 'OpenStreetMap routing.openstreetmap.de routed-foot', endpoint: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving', acquiredAt: '2026-09-21' } } as const
}

export const roppongiExit7ToNationalArtCenterWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'roppongi-exit7-to-national-art-center',
  from: { label: '六本木駅 7出口', latitude: 35.664555, longitude: 139.731115 },
  to: { label: '国立新美術館', latitude: 35.66519, longitude: 139.72636 },
  officialMinutes: 4,
  sourceUrl: 'https://www.nact.jp/information/access/',
  retrievedAt: '2026-09-21',
  stationExitConnection: { stationId: '424', exitNodeId: '424N0053', exitLabel: '7' },
  geometry: routeGeometry(roppongiRouteJson),
})

export const kokuritsuA2ToStadiumWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'kokuritsu-a2-to-stadium',
  from: { label: '国立競技場駅 A2出口', latitude: 35.679704, longitude: 139.714318 },
  to: { label: '国立競技場', latitude: 35.677784, longitude: 139.713608 },
  officialMinutes: 1,
  sourceUrl: 'https://jns-e.com/access/',
  retrievedAt: '2026-09-21',
  stationExitConnection: { stationId: '426', exitNodeId: '426N0139', exitLabel: 'A2' },
  geometry: routeGeometry(kokuritsuRouteJson),
})

export const daimonB2ToKyuShibaRikyuWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'daimon-b2-to-kyu-shiba-rikyu',
  from: { label: '大門駅 B2出口', latitude: 35.656496, longitude: 139.756834 },
  to: { label: '旧芝離宮恩賜庭園', latitude: 35.65545, longitude: 139.756697 },
  officialMinutes: 3,
  sourceUrl: 'https://www.tokyo-park.or.jp/park/kyu-shiba-rikyu/',
  retrievedAt: '2026-09-21',
  stationExitConnection: { stationId: '421', exitNodeId: '421N0015', exitLabel: 'B2' },
  geometry: routeGeometry(daimonKyuShibaRikyuRouteJson),
})

export const azabuJubanExit7ToPatioJubanWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'azabu-juban-exit7-to-patio-juban',
  from: { label: '麻布十番駅 7出口', latitude: 35.656863, longitude: 139.735146 },
  to: { label: 'パティオ十番（きみちゃん像）', latitude: 35.65517, longitude: 139.73512 },
  officialMinutes: 7,
  sourceUrl: 'https://www.azabujuban.or.jp/about/',
  retrievedAt: '2026-09-21',
  stationExitConnection: { stationId: '423', exitNodeId: '423N0063', exitLabel: '7' },
  geometry: routeGeometry(azabuJubanPatioRouteJson),
})

export const aoyamaItchomeExit1ToJinguGaienWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'aoyama-itchome-exit1-to-jingu-gaien',
  from: { label: '青山一丁目駅 1出口', latitude: 35.672862, longitude: 139.723773 },
  to: { label: '明治神宮外苑いちょう並木', latitude: 35.672401, longitude: 139.720975 },
  officialMinutes: 5,
  sourceUrl: 'https://www.meijijingugaien.jp/pdf/pamphlet.pdf',
  retrievedAt: '2026-09-21',
  stationExitConnection: { stationId: '425', exitNodeId: '425N0123', exitLabel: '1' },
  geometry: routeGeometry(aoyamaRouteJson),
})

export const yoyogiA2ToMeijiJinguYoyogiGateWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'yoyogi-a2-to-meiji-jingu-yoyogi-gate',
  from: { label: '代々木駅 A2出口', latitude: 35.683032, longitude: 139.701891 },
  to: { label: '明治神宮・代々木口', latitude: 35.682642, longitude: 139.701892 },
  officialMinutes: 2,
  sourceUrl: 'https://www.meijijingu.or.jp/access/',
  retrievedAt: '2026-09-21',
  stationExitConnection: { stationId: '427', exitNodeId: '427N0084', exitLabel: 'A2' },
  geometry: routeGeometry(yoyogiRouteJson),
})

export const higashiShinjukuA2ToBunkaCenterWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'higashi-shinjuku-a2-to-bunka-center',
  from: { label: '東新宿駅 A2出口', latitude: 35.69801, longitude: 139.708025 },
  to: { label: '新宿文化センター', latitude: 35.695443, longitude: 139.70945 },
  officialMinutes: 7,
  sourceUrl: 'https://www.regasu-shinjuku.or.jp/bunka-center/traffic-access/',
  retrievedAt: '2026-09-21',
  stationExitConnection: { stationId: '403', exitNodeId: '403N0019', exitLabel: 'A2' },
  geometry: routeGeometry(higashiShinjukuRouteJson),
})

export const shinjukuA1ToSouthernTowerWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'shinjuku-a1-to-southern-tower', from: { label: '新宿駅 A1出口', latitude: 35.686914, longitude: 139.699431 }, to: { label: '小田急ホテルセンチュリーサザンタワー', latitude: 35.686442, longitude: 139.700367 }, officialMinutes: 1,
  sourceUrl: 'https://www.southerntower.co.jp/access/', retrievedAt: '2026-09-21', stationExitConnection: { stationId: '428', exitNodeId: '428N0193', exitLabel: 'A1' }, geometry: routeGeometry(shinjukuHotelRouteJson),
})

export const shinjukuNishiguchiD3ToOmoideYokochoWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'shinjuku-nishiguchi-d3-to-omoide-yokocho', from: { label: '新宿西口駅 D3出口', latitude: 35.693327, longitude: 139.699273 }, to: { label: '新宿西口 思い出横丁', latitude: 35.693093, longitude: 139.699502 }, officialMinutes: 2,
  sourceUrl: 'https://shinjuku-omoide.com/access', retrievedAt: '2026-09-21', stationExitConnection: { stationId: '402', exitNodeId: '402N0002', exitLabel: 'D3' }, geometry: routeGeometry(omoideYokochoRouteJson),
})

export const uenoOkachimachiA7ToAmeyokoWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'ueno-okachimachi-a7-to-ameyoko',
  from: { label: '上野御徒町駅 A7出口', latitude: 35.708018, longitude: 139.775417 },
  to: { label: 'アメ横入口', latitude: 35.7100241, longitude: 139.7745414 },
  routingMinutes: 4,
  sourceUrl: 'https://www.ameyoko.net/access/', retrievedAt: '2026-09-21',
  stationExitConnection: { stationId: '410', exitNodeId: '410N0016', exitLabel: 'A7' },
  geometry: routeGeometry(uenoA7RouteJson),
})

export const tochomaeA4ToTokyoMetropolitanGovernmentWalkingRoute: WalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'tochomae-a4-to-tocho-first-building',
  from: { label: '都庁前駅 A4出口', latitude: 35.690192, longitude: 139.691341 },
  to: { label: '東京都庁第一本庁舎1階 展望室専用エレベーター入口付近', latitude: 35.6902989, longitude: 139.6915456 },
  routingMinutes: 2,
  sourceUrl: 'https://www.zaimu.metro.tokyo.lg.jp/tochousha/goannai/tenbou', retrievedAt: '2026-09-21',
  stationExitConnection: { stationId: '429', exitNodeId: '429N0093', exitLabel: 'A4' },
  geometry: routeGeometry(tochomaeA4RouteJson),
})
