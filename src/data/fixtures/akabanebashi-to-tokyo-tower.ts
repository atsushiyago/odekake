import { buildPublishedOutdoorWalkingRoute } from '../../domain/outdoorWalkingRoute'
import routeGeoJsonText from '../outdoorRoutes/akabanebashi-to-tokyo-tower.geojson?raw'

const routeGeoJson = JSON.parse(routeGeoJsonText) as { features: Array<{ geometry: { type: 'LineString'; coordinates: Array<[number, number]> }; properties: { source: string; endpoint: string; acquiredAt: string; distanceMeters?: number; durationSeconds?: number } }> }
const routeFeature = routeGeoJson.features[0]

/**
 * Tokyo Tower publishes these access instructions for the Akabanebashi exit.
 * The page supplies five minutes but no machine-readable geometry. The separately
 * acquired fixed GeoJSON is retained as map-only evidence; the official five-minute
 * estimate and wording remain authoritative for the printed instructions.
 */
export const akabanebashiToTokyoTowerWalkingRoute = buildPublishedOutdoorWalkingRoute({
  id: 'akabanebashi-exit-to-tokyo-tower',
  from: { label: '赤羽橋駅 赤羽橋口', latitude: 35.654787, longitude: 139.744901 },
  to: { label: '東京タワー（フットタウン）', latitude: 35.658581, longitude: 139.745433 },
  officialMinutes: 5,
  directions: [
    '赤羽橋口を出たら、正面の横断歩道を渡る。',
    '渡り終えたら、右側の横断歩道を渡る。ガソリンスタンドがある側へ進む。',
    'ガソリンスタンドを左にして、歩道をまっすぐ進む。',
    '左側に公園の木が見える歩道を進み、交差点で左へ進む。',
    '少し進むと東京タワーに着く。',
  ],
  sourceUrl: 'https://en.tokyotower.co.jp/access/railroad/',
  retrievedAt: '2026-09-20',
  stationExitConnection: { stationId: '422', exitNodeId: '422N0012', exitLabel: '赤羽橋口' },
  geometry: {
    type: routeFeature.geometry.type,
    coordinates: routeFeature.geometry.coordinates,
    source: { provider: routeFeature.properties.source, endpoint: routeFeature.properties.endpoint, acquiredAt: routeFeature.properties.acquiredAt },
    distanceMeters: routeFeature.properties.distanceMeters,
    durationSeconds: routeFeature.properties.durationSeconds,
  },
})
