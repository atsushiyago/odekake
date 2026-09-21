import { buildStationMapCompressionOverlay, overlayAsCompressionContext, type StationMapCompressionOverlay, type StationMapGeoJsonCollection } from '../../domain/stationMap'
import type { IndoorGraph, IndoorRouteCompressionContext } from '../../domain/indoorRouting'
import f05 from './uenoOkachimachi/Ueno-okachimachi_Facility_B0.5.geojson?raw'
import f1 from './uenoOkachimachi/Ueno-okachimachi_Facility_B1.geojson?raw'
import f2 from './uenoOkachimachi/Ueno-okachimachi_Facility_B2.geojson?raw'
import fl05 from './uenoOkachimachi/Ueno-okachimachi_Floor_B0.5.geojson?raw'
import fl1 from './uenoOkachimachi/Ueno-okachimachi_Floor_B1.geojson?raw'
import fl2 from './uenoOkachimachi/Ueno-okachimachi_Floor_B2.geojson?raw'
import s05 from './uenoOkachimachi/Ueno-okachimachi_Space_B0.5.geojson?raw'
import s1 from './uenoOkachimachi/Ueno-okachimachi_Space_B1.geojson?raw'
import s2 from './uenoOkachimachi/Ueno-okachimachi_Space_B2.geojson?raw'

const parse = (raw: string) => JSON.parse(raw) as StationMapGeoJsonCollection
const facilities = [f05, f1, f2].map(parse)
const floors = [fl05, fl1, fl2].map(parse)
const spaces = [s05, s1, s2].map(parse)

export const uenoOkachimachiStationMapMetadata = {
  datasetUrl: 'https://ckan.hokonavi.go.jp/dataset/mlit_station_oedo_ueno-okachimachi',
  stationMapResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/2e382ada-db20-4aa8-a48c-3cb8673c7db2/resource/eadff356-e66c-49ed-b467-a450c6453a12',
  walkingNetworkResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/2e382ada-db20-4aa8-a48c-3cb8673c7db2/resource/6a7fe02a-fec1-459e-9e44-846992ba6692',
  crs: 'EPSG:6668', retrievedAt: '2026-09-21',
} as const

export function buildUenoOkachimachiStationMapOverlay(graph: IndoorGraph): StationMapCompressionOverlay {
  return buildStationMapCompressionOverlay({ graph, spaces, facilities, floors, sourceUrl: uenoOkachimachiStationMapMetadata.stationMapResourceUrl })
}
export function buildUenoOkachimachiStationMapCompressionContext(graph: IndoorGraph): IndoorRouteCompressionContext {
  return { ...overlayAsCompressionContext(buildUenoOkachimachiStationMapOverlay(graph)), allowSemanticConsensusVerticalRestoration: true, allowDecisionFreeStairTurns: true }
}
