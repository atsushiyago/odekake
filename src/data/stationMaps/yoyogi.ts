import { buildStationMapCompressionOverlay, overlayAsCompressionContext, type StationMapCompressionOverlay, type StationMapGeoJsonCollection } from '../../domain/stationMap'
import type { IndoorGraph, IndoorRouteCompressionContext } from '../../domain/indoorRouting'
import facilityB05 from './yoyogi/Yoyogi_Facility_B0.5.geojson?raw'
import facilityB1 from './yoyogi/Yoyogi_Facility_B1.geojson?raw'
import facilityB2 from './yoyogi/Yoyogi_Facility_B2.geojson?raw'
import facilityB3 from './yoyogi/Yoyogi_Facility_B3.geojson?raw'
import floorB05 from './yoyogi/Yoyogi_Floor_B0.5.geojson?raw'
import floorB1 from './yoyogi/Yoyogi_Floor_B1.geojson?raw'
import floorB2 from './yoyogi/Yoyogi_Floor_B2.geojson?raw'
import floorB3 from './yoyogi/Yoyogi_Floor_B3.geojson?raw'
import spaceB05 from './yoyogi/Yoyogi_Space_B0.5.geojson?raw'
import spaceB1 from './yoyogi/Yoyogi_Space_B1.geojson?raw'
import spaceB2 from './yoyogi/Yoyogi_Space_B2.geojson?raw'
import spaceB3 from './yoyogi/Yoyogi_Space_B3.geojson?raw'

const parse = (raw: string) => JSON.parse(raw) as StationMapGeoJsonCollection
const facilities = [facilityB05, facilityB1, facilityB2, facilityB3].map(parse)
const floors = [floorB05, floorB1, floorB2, floorB3].map(parse)
const spaces = [spaceB05, spaceB1, spaceB2, spaceB3].map(parse)
export const yoyogiStationMapMetadata = { datasetUrl: 'https://ckan.hokonavi.go.jp/dataset/mlit_station_oedo_yoyogi', stationMapResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/573faa86-9665-43e9-8435-4940f1749cd5/resource/83b704c0-f009-4034-b1ac-854be697e509', walkingNetworkResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/573faa86-9665-43e9-8435-4940f1749cd5/resource/0f8640e1-8d05-40e4-8be5-8302e8bc03aa', crs: 'EPSG:6668', retrievedAt: '2026-09-21' } as const
export const yoyogiStationMapGeoJson = { facilities, floors, spaces, sourceUrl: yoyogiStationMapMetadata.stationMapResourceUrl }
export function buildYoyogiStationMapOverlay(graph: IndoorGraph): StationMapCompressionOverlay { return buildStationMapCompressionOverlay({ graph, spaces, facilities, floors, sourceUrl: yoyogiStationMapGeoJson.sourceUrl }) }
export function buildYoyogiStationMapCompressionContext(graph: IndoorGraph): IndoorRouteCompressionContext { return overlayAsCompressionContext(buildYoyogiStationMapOverlay(graph)) }
