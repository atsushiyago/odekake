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
