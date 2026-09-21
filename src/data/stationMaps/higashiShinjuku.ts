import { buildStationMapCompressionOverlay, overlayAsCompressionContext, type StationMapCompressionOverlay, type StationMapGeoJsonCollection } from '../../domain/stationMap'
import type { IndoorGraph, IndoorRouteCompressionContext } from '../../domain/indoorRouting'
import facilityB1 from './higashiShinjuku/Higashi-shinjuku_Facility_B1.geojson?raw'
import facilityB2 from './higashiShinjuku/Higashi-shinjuku_Facility_B2.geojson?raw'
import facilityB3 from './higashiShinjuku/Higashi-shinjuku_Facility_B3.geojson?raw'
import floorB1 from './higashiShinjuku/Higashi-shinjuku_Floor_B1.geojson?raw'
import floorB2 from './higashiShinjuku/Higashi-shinjuku_Floor_B2.geojson?raw'
import floorB3 from './higashiShinjuku/Higashi-shinjuku_Floor_B3.geojson?raw'
import spaceB1 from './higashiShinjuku/Higashi-shinjuku_Space_B1.geojson?raw'
import spaceB2 from './higashiShinjuku/Higashi-shinjuku_Space_B2.geojson?raw'
import spaceB3 from './higashiShinjuku/Higashi-shinjuku_Space_B3.geojson?raw'
const parse = (raw: string) => JSON.parse(raw) as StationMapGeoJsonCollection
const facilities = [facilityB1, facilityB2, facilityB3].map(parse)
const floors = [floorB1, floorB2, floorB3].map(parse)
const spaces = [spaceB1, spaceB2, spaceB3].map(parse)
export const higashiShinjukuStationMapMetadata = { datasetUrl: 'https://ckan.hokonavi.go.jp/dataset/mlit_station_oedo_higashi-shinjuku', stationMapResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/e45cf561-c947-4d0c-95b5-b4c31207dc08/resource/972012d7-2b6d-4fe4-8f7b-3304f2434c7e', walkingNetworkResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/e45cf561-c947-4d0c-95b5-b4c31207dc08/resource/84a2a4e6-22d8-4fba-b84c-8be8c44fb09b', crs: 'EPSG:6668', retrievedAt: '2026-09-21' } as const
export const higashiShinjukuStationMapGeoJson = { facilities, floors, spaces, sourceUrl: higashiShinjukuStationMapMetadata.stationMapResourceUrl }
export function buildHigashiShinjukuStationMapOverlay(graph: IndoorGraph): StationMapCompressionOverlay { return buildStationMapCompressionOverlay({ graph, spaces, facilities, floors, sourceUrl: higashiShinjukuStationMapGeoJson.sourceUrl }) }
export function buildHigashiShinjukuStationMapCompressionContext(graph: IndoorGraph): IndoorRouteCompressionContext { return overlayAsCompressionContext(buildHigashiShinjukuStationMapOverlay(graph)) }
