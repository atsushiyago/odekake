import { buildStationMapCompressionOverlay, overlayAsCompressionContext, type StationMapCompressionOverlay, type StationMapGeoJsonCollection } from '../../domain/stationMap'
import type { IndoorGraph, IndoorRouteCompressionContext } from '../../domain/indoorRouting'
import facility1 from './aoyamaItchome/Aoyama-itchome_Facility_1.geojson?raw'
import facilityB1 from './aoyamaItchome/Aoyama-itchome_Facility_B1.geojson?raw'
import facilityB3 from './aoyamaItchome/Aoyama-itchome_Facility_B3.geojson?raw'
import facilityB4 from './aoyamaItchome/Aoyama-itchome_Facility_B4.geojson?raw'
import facilityB5 from './aoyamaItchome/Aoyama-itchome_Facility_B5.geojson?raw'
import floor1 from './aoyamaItchome/Aoyama-itchome_Floor_1.geojson?raw'
import floorB1 from './aoyamaItchome/Aoyama-itchome_Floor_B1.geojson?raw'
import floorB3 from './aoyamaItchome/Aoyama-itchome_Floor_B3.geojson?raw'
import floorB4 from './aoyamaItchome/Aoyama-itchome_Floor_B4.geojson?raw'
import floorB5 from './aoyamaItchome/Aoyama-itchome_Floor_B5.geojson?raw'
import space1 from './aoyamaItchome/Aoyama-itchome_Space_1.geojson?raw'
import spaceB1 from './aoyamaItchome/Aoyama-itchome_Space_B1.geojson?raw'
import spaceB3 from './aoyamaItchome/Aoyama-itchome_Space_B3.geojson?raw'
import spaceB4 from './aoyamaItchome/Aoyama-itchome_Space_B4.geojson?raw'
import spaceB5 from './aoyamaItchome/Aoyama-itchome_Space_B5.geojson?raw'

const parse = (raw: string) => JSON.parse(raw) as StationMapGeoJsonCollection
const facilities = [facility1, facilityB1, facilityB3, facilityB4, facilityB5].map(parse)
const floors = [floor1, floorB1, floorB3, floorB4, floorB5].map(parse)
const spaces = [space1, spaceB1, spaceB3, spaceB4, spaceB5].map(parse)

export const aoyamaItchomeStationMapMetadata = {
  datasetUrl: 'https://ckan.hokonavi.go.jp/dataset/oedo_aoyama-itchome',
  stationMapResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/ea3daead-46e4-41f8-a18e-e1f65f8835a6/resource/302b2dda-3835-4737-9b93-86d1b3ac4af3',
  walkingNetworkResourceUrl: 'https://ckan.hokonavi.go.jp/dataset/ea3daead-46e4-41f8-a18e-e1f65f8835a6/resource/5b825bb9-886a-4f38-a1a9-1595497660b6',
  crs: 'EPSG:6668', retrievedAt: '2026-09-21',
} as const

export function buildAoyamaItchomeStationMapOverlay(graph: IndoorGraph): StationMapCompressionOverlay {
  return buildStationMapCompressionOverlay({ graph, spaces, facilities, floors, sourceUrl: aoyamaItchomeStationMapMetadata.stationMapResourceUrl })
}

export function buildAoyamaItchomeStationMapCompressionContext(graph: IndoorGraph): IndoorRouteCompressionContext {
  // The official Aoyama-itchome station map shows the 1-exit stairwell as a
  // continuous stair facility with intermediate landings. The generic
  // compressor may therefore apply its bounded same-facility landing rule;
  // it still requires non-branching topology, direction safety and complete
  // provenance, and does not identify any pathway by station-specific ID.
  return { ...overlayAsCompressionContext(buildAoyamaItchomeStationMapOverlay(graph)), allowExtendedSameFacilityStairLandings: true }
}
