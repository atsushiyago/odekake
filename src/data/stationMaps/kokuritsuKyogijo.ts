import facility1Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_1_Facility.geojson?raw'
import floor1Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_1_Floor.geojson?raw'
import space1Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_1_Space.geojson?raw'
import facilityB05Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_B0.5_Facility.geojson?raw'
import floorB05Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_B0.5_Floor.geojson?raw'
import spaceB05Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_B0.5_Space.geojson?raw'
import facilityB1Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_B1_Facility.geojson?raw'
import floorB1Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_B1_Floor.geojson?raw'
import spaceB1Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_B1_Space.geojson?raw'
import facilityB2Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_B2_Facility.geojson?raw'
import floorB2Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_B2_Floor.geojson?raw'
import spaceB2Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_B2_Space.geojson?raw'
import facilityB3Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_B3_Facility.geojson?raw'
import floorB3Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_B3_Floor.geojson?raw'
import spaceB3Raw from './kokuritsu-kyogijo/Kokuritsu-kyogijo_B3_Space.geojson?raw'
import { buildStationMapCompressionOverlay, overlayAsCompressionContext, type StationMapCompressionOverlay, type StationMapGeoJsonCollection } from '../../domain/stationMap'
import type { IndoorGraph, IndoorRouteCompressionContext } from '../../domain/indoorRouting'

const parse = (raw: string) => JSON.parse(raw) as StationMapGeoJsonCollection
const facilities = [facility1Raw, facilityB05Raw, facilityB1Raw, facilityB2Raw, facilityB3Raw].map(parse)
const floors = [floor1Raw, floorB05Raw, floorB1Raw, floorB2Raw, floorB3Raw].map(parse)
const spaces = [space1Raw, spaceB05Raw, spaceB1Raw, spaceB2Raw, spaceB3Raw].map(parse)

export const kokuritsuKyogijoStationMapMetadata = {
  datasetUrl: 'https://ckan.hokonavi.go.jp/dataset/station_oedo_kokuritsu-kyogijo',
  stationMapResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/1108976a-8642-452e-8d2e-ed2ca6a71f71/resource/c103d9fe-cd30-4e59-bdaf-d54c7e9ede76',
  walkingNetworkResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/1108976a-8642-452e-8d2e-ed2ca6a71f71/resource/3e8e93e6-9782-47fb-99e3-e625826019a4',
  retrievedAt: '2026-09-21',
  crs: 'EPSG:6668',
} as const

export const kokuritsuKyogijoStationMapGeoJson = { facilities, floors, spaces, sourceUrl: kokuritsuKyogijoStationMapMetadata.stationMapResourceUrl }

export function buildKokuritsuKyogijoStationMapOverlay(graph: IndoorGraph): StationMapCompressionOverlay {
  return buildStationMapCompressionOverlay({ graph, spaces, facilities, floors, sourceUrl: kokuritsuKyogijoStationMapGeoJson.sourceUrl })
}

export function buildKokuritsuKyogijoStationMapCompressionContext(graph: IndoorGraph): IndoorRouteCompressionContext {
  return overlayAsCompressionContext(buildKokuritsuKyogijoStationMapOverlay(graph))
}
