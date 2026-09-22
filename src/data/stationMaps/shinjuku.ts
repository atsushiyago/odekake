import { buildStationMapCompressionOverlay, overlayAsCompressionContext, type StationMapCompressionOverlay, type StationMapGeoJsonCollection } from '../../domain/stationMap'
import type { IndoorGraph, IndoorRouteCompressionContext } from '../../domain/indoorRouting'
import f1 from './shinjuku/Shinjuku_1_Facility.geojson?raw'; import fB1 from './shinjuku/Shinjuku_B1_Facility.geojson?raw'; import fB2 from './shinjuku/Shinjuku_B2_Facility.geojson?raw'; import fB3 from './shinjuku/Shinjuku_B3_Facility.geojson?raw'; import fB5 from './shinjuku/Shinjuku_B5_Facility.geojson?raw'; import fB6 from './shinjuku/Shinjuku_B6_Facility.geojson?raw'
import fl1 from './shinjuku/Shinjuku_1_Floor.geojson?raw'; import flB1 from './shinjuku/Shinjuku_B1_Floor.geojson?raw'; import flB2 from './shinjuku/Shinjuku_B2_Floor.geojson?raw'; import flB3 from './shinjuku/Shinjuku_B3_Floor.geojson?raw'; import flB5 from './shinjuku/Shinjuku_B5_Floor.geojson?raw'; import flB6 from './shinjuku/Shinjuku_B6_Floor.geojson?raw'
import s1 from './shinjuku/Shinjuku_1_Space.geojson?raw'; import sB1 from './shinjuku/Shinjuku_B1_Space.geojson?raw'; import sB2 from './shinjuku/Shinjuku_B2_Space.geojson?raw'; import sB3 from './shinjuku/Shinjuku_B3_Space.geojson?raw'; import sB5 from './shinjuku/Shinjuku_B5_Space.geojson?raw'; import sB6 from './shinjuku/Shinjuku_B6_Space.geojson?raw'
const parse = (raw: string) => JSON.parse(raw) as StationMapGeoJsonCollection
const facilities = [f1, fB1, fB2, fB3, fB5, fB6].map(parse); const floors = [fl1, flB1, flB2, flB3, flB5, flB6].map(parse); const spaces = [s1, sB1, sB2, sB3, sB5, sB6].map(parse)
export const shinjukuStationMapMetadata = { datasetUrl: 'https://ckan.hokonavi.go.jp/dataset/station_oedo_shinjuku', stationMapResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/2d8ff84b-f110-41ad-b5e5-7b8ec9c6cb45/resource/9c5ecc7b-a6e4-4d92-978c-9b66ca642172', walkingNetworkResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/2d8ff84b-f110-41ad-b5e5-7b8ec9c6cb45/resource/d4519a9a-917a-4de8-9104-83e21246c04c', crs: 'EPSG:6668', retrievedAt: '2026-09-21' } as const
export function buildShinjukuStationMapOverlay(graph: IndoorGraph): StationMapCompressionOverlay {
  const overlay = buildStationMapCompressionOverlay({ graph, spaces, facilities, floors, sourceUrl: shinjukuStationMapMetadata.stationMapResourceUrl })
  // The published Oedo station diagram labels the Oedo platform as B7 and the
  // Minds Tower-side gate as B3, while the station-map ordinal layer is offset
  // by one at this station. Keep that source correction in station metadata;
  // the routing/presentation layer remains station-agnostic.
  return {
    ...overlay,
    officialFloorsByLevelIndex: {
      ...overlay.officialFloorsByLevelIndex,
      [-6]: { label: '地下7階', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku.html' },
      [-2]: { label: '地下3階', sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/kanren/inspection/pdf/inspection202509_04.pdf' },
    },
  }
}
export function buildShinjukuStationMapCompressionContext(graph: IndoorGraph): IndoorRouteCompressionContext { return overlayAsCompressionContext(buildShinjukuStationMapOverlay(graph)) }
