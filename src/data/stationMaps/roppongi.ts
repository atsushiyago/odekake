import facility1Raw from './roppongi/Roppongi_Facility_1.geojson?raw'
import facilityB05Raw from './roppongi/Roppongi_Facility_B0.5.geojson?raw'
import facilityB1Raw from './roppongi/Roppongi_Facility_B1.geojson?raw'
import facilityB2Raw from './roppongi/Roppongi_Facility_B2.geojson?raw'
import facilityB4Raw from './roppongi/Roppongi_Facility_B4.geojson?raw'
import facilityB5Raw from './roppongi/Roppongi_Facility_B5.geojson?raw'
import facilityB6Raw from './roppongi/Roppongi_Facility_B6.geojson?raw'
import facilityB7Raw from './roppongi/Roppongi_Facility_B7.geojson?raw'
import floor1Raw from './roppongi/Roppongi_Floor_1.geojson?raw'
import floorB05Raw from './roppongi/Roppongi_Floor_B0.5.geojson?raw'
import floorB1Raw from './roppongi/Roppongi_Floor_B1.geojson?raw'
import floorB2Raw from './roppongi/Roppongi_Floor_B2.geojson?raw'
import floorB4Raw from './roppongi/Roppongi_Floor_B4.geojson?raw'
import floorB5Raw from './roppongi/Roppongi_Floor_B5.geojson?raw'
import floorB6Raw from './roppongi/Roppongi_Floor_B6.geojson?raw'
import floorB7Raw from './roppongi/Roppongi_Floor_B7.geojson?raw'
import space1Raw from './roppongi/Roppongi_Space_1.geojson?raw'
import spaceB05Raw from './roppongi/Roppongi_Space_B0.5.geojson?raw'
import spaceB1Raw from './roppongi/Roppongi_Space_B1.geojson?raw'
import spaceB2Raw from './roppongi/Roppongi_Space_B2.geojson?raw'
import spaceB4Raw from './roppongi/Roppongi_Space_B4.geojson?raw'
import spaceB5Raw from './roppongi/Roppongi_Space_B5.geojson?raw'
import spaceB6Raw from './roppongi/Roppongi_Space_B6.geojson?raw'
import spaceB7Raw from './roppongi/Roppongi_Space_B7.geojson?raw'
import { buildStationMapCompressionOverlay, overlayAsCompressionContext, type StationMapCompressionOverlay, type StationMapGeoJsonCollection } from '../../domain/stationMap'
import type { IndoorGraph, IndoorRouteCompressionContext } from '../../domain/indoorRouting'

const parse = (raw: string) => JSON.parse(raw) as StationMapGeoJsonCollection
const facilities = [facility1Raw, facilityB05Raw, facilityB1Raw, facilityB2Raw, facilityB4Raw, facilityB5Raw, facilityB6Raw, facilityB7Raw].map(parse)
const floors = [floor1Raw, floorB05Raw, floorB1Raw, floorB2Raw, floorB4Raw, floorB5Raw, floorB6Raw, floorB7Raw].map(parse)
const spaces = [space1Raw, spaceB05Raw, spaceB1Raw, spaceB2Raw, spaceB4Raw, spaceB5Raw, spaceB6Raw, spaceB7Raw].map(parse)

export const roppongiStationMapMetadata = {
  datasetUrl: 'https://ckan.hokonavi.go.jp/dataset/mlit_station_oedo_roppongi',
  stationMapResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/dab17927-f6d9-4410-aaec-c5918860324c/resource/e16cd615-a618-4ca6-90d8-18a2d6b9ed8b',
  walkingNetworkResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/dab17927-f6d9-4410-aaec-c5918860324c/resource/0f32c968-826f-49cb-8ec6-f4b135021353',
  crs: 'EPSG:6668',
  retrievedAt: '2026-09-21',
} as const
export const roppongiStationMapGeoJson = { facilities, floors, spaces, sourceUrl: roppongiStationMapMetadata.stationMapResourceUrl }

export function buildRoppongiStationMapOverlay(graph: IndoorGraph): StationMapCompressionOverlay {
  return buildStationMapCompressionOverlay({ graph, spaces, facilities, floors, sourceUrl: roppongiStationMapGeoJson.sourceUrl })
}

export function buildRoppongiStationMapCompressionContext(graph: IndoorGraph): IndoorRouteCompressionContext {
  return { ...overlayAsCompressionContext(buildRoppongiStationMapOverlay(graph)), allowDecisionFreeStairBridges: true }
}
