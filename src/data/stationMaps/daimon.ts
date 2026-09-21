import facilityB1Raw from './daimon/Daimon_Facility_B1.geojson?raw'
import facilityB2Raw from './daimon/Daimon_Facility_B2.geojson?raw'
import facilityB3Raw from './daimon/Daimon_Facility_B3.geojson?raw'
import facilityB4Raw from './daimon/Daimon_Facility_B4.geojson?raw'
import facilityB5Raw from './daimon/Daimon_Facility_B5.geojson?raw'
import floorB1Raw from './daimon/Daimon_Floor_B1.geojson?raw'
import floorB2Raw from './daimon/Daimon_Floor_B2.geojson?raw'
import floorB3Raw from './daimon/Daimon_Floor_B3.geojson?raw'
import floorB4Raw from './daimon/Daimon_Floor_B4.geojson?raw'
import floorB5Raw from './daimon/Daimon_Floor_B5.geojson?raw'
import spaceB1Raw from './daimon/Daimon_Space_B1.geojson?raw'
import spaceB2Raw from './daimon/Daimon_Space_B2.geojson?raw'
import spaceB3Raw from './daimon/Daimon_Space_B3.geojson?raw'
import spaceB4Raw from './daimon/Daimon_Space_B4.geojson?raw'
import spaceB5Raw from './daimon/Daimon_Space_B5.geojson?raw'
import { buildStationMapCompressionOverlay, overlayAsCompressionContext, type StationMapCompressionOverlay, type StationMapGeoJsonCollection } from '../../domain/stationMap'
import type { IndoorGraph, IndoorRouteCompressionContext } from '../../domain/indoorRouting'

const parse = (raw: string) => JSON.parse(raw) as StationMapGeoJsonCollection
const facilities = [facilityB1Raw, facilityB2Raw, facilityB3Raw, facilityB4Raw, facilityB5Raw].map(parse)
const floors = [floorB1Raw, floorB2Raw, floorB3Raw, floorB4Raw, floorB5Raw].map(parse)
const spaces = [spaceB1Raw, spaceB2Raw, spaceB3Raw, spaceB4Raw, spaceB5Raw].map(parse)

export const daimonStationMapMetadata = {
  datasetUrl: 'https://ckan.hokonavi.go.jp/dataset/station_oedo_daimon',
  stationMapResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/a00afe74-d687-42d0-9ca3-65b111249063/resource/c8f3b4b6-0186-4986-acf8-e454c821e0cb',
  walkingNetworkResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/a00afe74-d687-42d0-9ca3-65b111249063/resource/f4af3c4d-7a15-4036-ae36-3133c1206d81',
  crs: 'EPSG:6668',
  retrievedAt: '2026-09-21',
} as const

export const daimonStationMapGeoJson = { facilities, floors, spaces, sourceUrl: daimonStationMapMetadata.stationMapResourceUrl }

export function buildDaimonStationMapOverlay(graph: IndoorGraph): StationMapCompressionOverlay {
  return buildStationMapCompressionOverlay({ graph, spaces, facilities, floors, sourceUrl: daimonStationMapGeoJson.sourceUrl })
}

export function buildDaimonStationMapCompressionContext(graph: IndoorGraph): IndoorRouteCompressionContext {
  return overlayAsCompressionContext(buildDaimonStationMapOverlay(graph))
}
