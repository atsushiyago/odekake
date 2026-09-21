import facilityB1Raw from './azabuJuban/Azabu-juban_Facility_B1.geojson?raw'
import facilityB2Raw from './azabuJuban/Azabu-juban_Facility_B2.geojson?raw'
import facilityB3Raw from './azabuJuban/Azabu-juban_Facility_B3.geojson?raw'
import facilityB4Raw from './azabuJuban/Azabu-juban_Facility_B4.geojson?raw'
import facilityB5Raw from './azabuJuban/Azabu-juban_Facility_B5.geojson?raw'
import facilityB6Raw from './azabuJuban/Azabu-juban_Facility_B6.geojson?raw'
import floorB1Raw from './azabuJuban/Azabu-juban_Floor_B1.geojson?raw'
import floorB2Raw from './azabuJuban/Azabu-juban_Floor_B2.geojson?raw'
import floorB3Raw from './azabuJuban/Azabu-juban_Floor_B3.geojson?raw'
import floorB4Raw from './azabuJuban/Azabu-juban_Floor_B4.geojson?raw'
import floorB5Raw from './azabuJuban/Azabu-juban_Floor_B5.geojson?raw'
import floorB6Raw from './azabuJuban/Azabu-juban_Floor_B6.geojson?raw'
import spaceB1Raw from './azabuJuban/Azabu-juban_Space_B1.geojson?raw'
import spaceB2Raw from './azabuJuban/Azabu-juban_Space_B2.geojson?raw'
import spaceB3Raw from './azabuJuban/Azabu-juban_Space_B3.geojson?raw'
import spaceB4Raw from './azabuJuban/Azabu-juban_Space_B4.geojson?raw'
import spaceB5Raw from './azabuJuban/Azabu-juban_Space_B5.geojson?raw'
import spaceB6Raw from './azabuJuban/Azabu-juban_Space_B6.geojson?raw'
import { buildStationMapCompressionOverlay, overlayAsCompressionContext, type StationMapCompressionOverlay, type StationMapGeoJsonCollection } from '../../domain/stationMap'
import type { IndoorGraph, IndoorRouteCompressionContext } from '../../domain/indoorRouting'

const parse = (raw: string) => JSON.parse(raw) as StationMapGeoJsonCollection
const facilities = [facilityB1Raw, facilityB2Raw, facilityB3Raw, facilityB4Raw, facilityB5Raw, facilityB6Raw].map(parse)
const floors = [floorB1Raw, floorB2Raw, floorB3Raw, floorB4Raw, floorB5Raw, floorB6Raw].map(parse)
const spaces = [spaceB1Raw, spaceB2Raw, spaceB3Raw, spaceB4Raw, spaceB5Raw, spaceB6Raw].map(parse)

export const azabuJubanStationMapMetadata = {
  datasetUrl: 'https://ckan.hokonavi.go.jp/dataset/mlit_station_oedo_azabu-juban',
  stationMapResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/c12b859f-d53a-440c-99f7-7309ff851a8d/resource/5ce2b482-a02b-498f-9ccf-b4f48f0ac363',
  walkingNetworkResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/c12b859f-d53a-440c-99f7-7309ff851a8d/resource/a9d65944-4c99-4e2b-9984-fa82b528abc9',
  crs: 'EPSG:6668',
  retrievedAt: '2026-09-21',
} as const

export const azabuJubanStationMapGeoJson = { facilities, floors, spaces, sourceUrl: azabuJubanStationMapMetadata.stationMapResourceUrl }

export function buildAzabuJubanStationMapOverlay(graph: IndoorGraph): StationMapCompressionOverlay {
  return buildStationMapCompressionOverlay({ graph, spaces, facilities, floors, sourceUrl: azabuJubanStationMapGeoJson.sourceUrl })
}

export function buildAzabuJubanStationMapCompressionContext(graph: IndoorGraph): IndoorRouteCompressionContext {
  return overlayAsCompressionContext(buildAzabuJubanStationMapOverlay(graph))
}
