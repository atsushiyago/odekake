import facilityB1Raw from './akabanebashi/Akabanebashi_Facility_B1.geojson?raw'
import facilityB2Raw from './akabanebashi/Akabanebashi_Facility_B2.geojson?raw'
import floorB1Raw from './akabanebashi/Akabanebashi_Floor_B1.geojson?raw'
import floorB2Raw from './akabanebashi/Akabanebashi_Floor_B2.geojson?raw'
import spaceB1Raw from './akabanebashi/Akabanebashi_Space_B1.geojson?raw'
import spaceB2Raw from './akabanebashi/Akabanebashi_Space_B2.geojson?raw'
import { buildStationMapCompressionOverlay, overlayAsCompressionContext, type StationMapCompressionOverlay, type StationMapGeoJsonCollection } from '../../domain/stationMap'
import type { IndoorGraph, IndoorRouteCompressionContext } from '../../domain/indoorRouting'

const parse = (raw: string) => JSON.parse(raw) as StationMapGeoJsonCollection
const facilities = [parse(facilityB1Raw), parse(facilityB2Raw)]
const floors = [parse(floorB1Raw), parse(floorB2Raw)]
const spaces = [parse(spaceB1Raw), parse(spaceB2Raw)]

export const akabanebashiStationMapGeoJson = { facilities, floors, spaces }

export function buildAkabanebashiStationMapOverlay(graph: IndoorGraph): StationMapCompressionOverlay {
  return buildStationMapCompressionOverlay({
    graph, spaces, facilities, floors,
    sourceUrl: 'src/data/stationMaps/akabanebashi/Akabanebashi_{Facility,Floor,Space}_{B1,B2}.geojson',
  })
}

export function buildAkabanebashiStationMapCompressionContext(graph: IndoorGraph): IndoorRouteCompressionContext {
  return overlayAsCompressionContext(buildAkabanebashiStationMapOverlay(graph))
}
