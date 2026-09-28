import type { FacilityMappingEvidence, IndoorGraph, IndoorMovementType, IndoorRouteCompressionContext, IndoorSource } from './indoorRouting.ts'

export type IndoorMapFacilityCategory = 'F011' | 'F012' | 'F013'
export interface RawStationMapFloor { id: string; ordinal: number; name: string }
export interface RawStationMapFacility {
  id: string; category: IndoorMapFacilityCategory; floorId: string; latitude: number; longitude: number
}
export interface RawStationMapData {
  source: IndoorSource; stationId: string; stationName: string; specification: string; specificationUrl: string
  floors: RawStationMapFloor[]; facilities: RawStationMapFacility[]
}
export interface StationMapFacility extends RawStationMapFacility { floorName: string; movementType: Extract<IndoorMovementType, 'stairs' | 'elevator' | 'escalator'> }

/**
 * Optional result of overlaying a GTFS pathway geometry with published Space / Facility GeoJSON.
 * Routing never depends on this: it may only make display compression safer.  An adapter may
 * populate it after it has actually intersected the two published geometries.
 */
export interface StationMapCompressionOverlay {
  sourceUrl: string
  byPathwayId: Record<string, { spaceId?: string; facilityId?: string; facilityGroupId?: string; facilityMapping?: FacilityMappingEvidence }>
  officialFloorsByLevelIndex?: Record<number, { label: string; sourceUrl: string }>
}

export interface StationMapGeoJsonFeature {
  type: 'Feature'; geometry: { type: 'Point' | 'Polygon' | 'MultiPolygon'; coordinates: unknown }
  properties?: Record<string, unknown>
}
export interface StationMapGeoJsonCollection { type: 'FeatureCollection'; features: StationMapGeoJsonFeature[] }

const categoryForMovement: Partial<Record<IndoorMovementType, IndoorMapFacilityCategory>> = { stairs: 'F011', elevator: 'F012', escalator: 'F013' }
const asPoint = (coordinates: unknown): [number, number] | undefined => Array.isArray(coordinates) && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number' ? [coordinates[0], coordinates[1]] : undefined
const polygonGroups = (geometry: StationMapGeoJsonFeature['geometry']): number[][][][] => {
  if (geometry.type === 'Polygon') return [geometry.coordinates as number[][][]]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as number[][][][]
  return []
}
const pointInRing = (point: [number, number], ring: number[][]) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    const intersects = (yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}
const pointInGeometry = (point: [number, number], geometry: StationMapGeoJsonFeature['geometry']) => polygonGroups(geometry).some(rings => rings.length > 0 && pointInRing(point, rings[0]) && rings.slice(1).every(hole => !pointInRing(point, hole)))
const distanceMeters = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 90000, (a[1] - b[1]) * 111000)

/**
 * Builds a display-only pathway overlay from published GeoJSON. It uses only
 * coordinates supplied by both sources; it never creates graph edges.
 */
export function buildStationMapCompressionOverlay(input: {
  graph: IndoorGraph; spaces: StationMapGeoJsonCollection[]; facilities: StationMapGeoJsonCollection[]; floors?: StationMapGeoJsonCollection[]
  sourceUrl: string; facilityMatchRadiusMeters?: number
}): StationMapCompressionOverlay {
  const floorOrdinalById = new Map<string, number>()
  const officialFloorsByLevelIndex: Record<number, { label: string; sourceUrl: string }> = {}
  for (const collection of input.floors ?? []) for (const feature of collection.features) {
    const id = String(feature.properties?.id ?? '')
    const ordinal = Number(feature.properties?.ordinal)
    if (id && Number.isFinite(ordinal)) floorOrdinalById.set(id, ordinal)
    const name = String(feature.properties?.name ?? '').trim()
    if (Number.isFinite(ordinal) && name) officialFloorsByLevelIndex[ordinal] ??= { label: name, sourceUrl: input.sourceUrl }
  }
  const spaceFeatures = input.spaces.flatMap(collection => collection.features).filter(feature => feature.geometry.type !== 'Point')
  const facilityFeatures = input.facilities.flatMap(collection => collection.features).map(feature => ({ feature, point: asPoint(feature.geometry.coordinates), category: String(feature.properties?.category ?? '') })).filter(item => item.point && categoryForMovement)
  // Facilities are often represented once per floor.  Group same-category
  // points that coincide horizontally so an elevator's entrance, shaft and
  // landing are treated as one physical facility without station-specific IDs.
  const facilityGroups: Array<{ category: string; point: [number, number]; id: string }> = []
  const groupFor = (item: typeof facilityFeatures[number]) => {
    const existing = facilityGroups.find(group => group.category === item.category && distanceMeters(group.point, item.point!) <= 3)
    if (existing) return existing.id
    const id = `facility-group:${item.category}:${String(item.feature.properties?.id ?? facilityGroups.length)}`
    facilityGroups.push({ category: item.category, point: item.point!, id })
    return id
  }
  const byPathwayId: StationMapCompressionOverlay['byPathwayId'] = {}
  for (const edge of input.graph.edges) {
    const from = input.graph.nodes.get(edge.fromNodeId), to = input.graph.nodes.get(edge.toNodeId)
    if (!from || !to) continue
    const endpoints: [number, number][] = [[from.longitude, from.latitude], [to.longitude, to.latitude]]
    const midpoint: [number, number] = [(from.longitude + to.longitude) / 2, (from.latitude + to.latitude) / 2]
    const edgeLevels = new Set([from.levelIndex, to.levelIndex].filter((level): level is number => level !== undefined))
    const spacesContaining = spaceFeatures.filter(feature => {
      const floorId = String(feature.properties?.floor_id ?? '')
      const ordinal = floorOrdinalById.get(floorId)
      // GTFS may describe landings with half-levels (for example -0.5). Treat
      // those as spatially adjacent to the nearest published floor, but never
      // infer a floor name for user-facing text.
      const levelMatches = ordinal === undefined || !edgeLevels.size || [...edgeLevels].some(level => Math.abs(level - ordinal) <= 0.6)
      return levelMatches && (pointInGeometry(midpoint, feature.geometry) || endpoints.some(point => pointInGeometry(point, feature.geometry)))
    })
    const chosenSpace = spacesContaining.sort((a, b) => String(a.properties?.id ?? '').localeCompare(String(b.properties?.id ?? '')))[0]
    const category = categoryForMovement[edge.movementType]
    let chosenFacility: typeof facilityFeatures[number] | undefined
    if (category) {
      const candidates = facilityFeatures.filter(item => item.category === category).map(item => ({ ...item, distance: Math.min(...endpoints.map(point => distanceMeters(point, item.point!)), distanceMeters(midpoint, item.point!)) })).filter(item => item.distance <= (input.facilityMatchRadiusMeters ?? 15)).sort((a, b) => a.distance - b.distance)
      chosenFacility = candidates[0]
    }
    if (chosenSpace || chosenFacility) byPathwayId[edge.id] = {
      spaceId: chosenSpace ? String(chosenSpace.properties?.id ?? '') || undefined : undefined,
      facilityId: chosenFacility ? String(chosenFacility.feature.properties?.id ?? '') || undefined : undefined,
      facilityGroupId: chosenFacility ? groupFor(chosenFacility) : undefined,
      // Current pathway-to-point association is nearest-feature matching. Preserve
      // that provenance for display compression, but never promote it to physical
      // equipment identity proof.
      ...(chosenFacility ? { facilityMapping: { method: 'nearest', identityStrength: 'supporting', sourceUrl: input.sourceUrl } as const } : {}),
    }
  }
  return { sourceUrl: input.sourceUrl, byPathwayId, officialFloorsByLevelIndex }
}

export const overlayAsCompressionContext = (overlay: StationMapCompressionOverlay): IndoorRouteCompressionContext => ({ byPathwayId: overlay.byPathwayId, officialFloorsByLevelIndex: overlay.officialFloorsByLevelIndex })

// This mapping is valid only for the pinned 2019-03 GSI specification referenced by the dataset.
const facilityMovementTypes: Record<IndoorMapFacilityCategory, StationMapFacility['movementType']> = { F011: 'stairs', F012: 'elevator', F013: 'escalator' }

/** Normalizes named facilities for display/inspection. It deliberately does not create routing edges. */
export function normalizeStationMapFacilities(raw: RawStationMapData): StationMapFacility[] {
  const floors = new Map(raw.floors.map(floor => [floor.id, floor.name]))
  return raw.facilities.map(facility => ({ ...facility, floorName: floors.get(facility.floorId) ?? '階不明', movementType: facilityMovementTypes[facility.category] }))
}
