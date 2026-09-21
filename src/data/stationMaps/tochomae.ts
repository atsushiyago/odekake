import { buildStationMapCompressionOverlay, overlayAsCompressionContext, type StationMapCompressionOverlay, type StationMapGeoJsonCollection } from '../../domain/stationMap'
import type { IndoorGraph, IndoorRouteCompressionContext } from '../../domain/indoorRouting'
import f1 from './tochomae/Tochomae_1_Facility.geojson?raw'
import fb1 from './tochomae/Tochomae_B1_Facility.geojson?raw'
import fb2 from './tochomae/Tochomae_B2_Facility.geojson?raw'
import fb3 from './tochomae/Tochomae_B3_Facility.geojson?raw'
import fl1 from './tochomae/Tochomae_1_Floor.geojson?raw'
import flb1 from './tochomae/Tochomae_B1_Floor.geojson?raw'
import flb2 from './tochomae/Tochomae_B2_Floor.geojson?raw'
import flb3 from './tochomae/Tochomae_B3_Floor.geojson?raw'
import s1 from './tochomae/Tochomae_1_Space.geojson?raw'
import sb1 from './tochomae/Tochomae_B1_Space.geojson?raw'
import sb2 from './tochomae/Tochomae_B2_Space.geojson?raw'
import sb3 from './tochomae/Tochomae_B3_Space.geojson?raw'

const parse = (raw: string) => JSON.parse(raw) as StationMapGeoJsonCollection
const facilities = [f1, fb1, fb2, fb3].map(parse)
const floors = [fl1, flb1, flb2, flb3].map(parse)
const spaces = [s1, sb1, sb2, sb3].map(parse)

export const tochomaeStationMapMetadata = {
  datasetUrl: 'https://ckan.hokonavi.go.jp/dataset/station_oedo_tochomae',
  stationMapResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/0497448d-15ca-44be-b27b-89d99f83c85d/resource/30a2e7a1-bfdc-45a5-b502-dac80950f936',
  walkingNetworkResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/0497448d-15ca-44be-b27b-89d99f83c85d/resource/34a413dc-2859-4cb8-b460-b0216d646c5d',
  crs: 'EPSG:6668', retrievedAt: '2026-09-21',
} as const

export function buildTochomaeStationMapOverlay(graph: IndoorGraph): StationMapCompressionOverlay {
  return buildStationMapCompressionOverlay({ graph, spaces, facilities, floors, sourceUrl: tochomaeStationMapMetadata.stationMapResourceUrl })
}
export function buildTochomaeStationMapCompressionContext(graph: IndoorGraph): IndoorRouteCompressionContext {
  return overlayAsCompressionContext(buildTochomaeStationMapOverlay(graph))
}
