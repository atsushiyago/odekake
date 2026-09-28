import type { StationMapGeoJsonCollection, StationMapGeoJsonFeature } from './stationMap'
import type { RawWalkingNetworkLink, RawWalkingNetworkNode } from './walkingNetwork'
import { buildWalkingNetworkGraph, type WalkingNetworkBuildResult } from './walkingNetwork'
import type { RawWalkingNetworkStationData } from './walkingNetwork'

export type FacilityMatchMethod = 'contained' | 'intersection' | 'nearby' | 'unmatched'
export interface FacilityMatchDiagnostics {
  candidateSpaceCount: number
  nearestDistanceMeters?: number
  secondNearestDistanceMeters?: number
}
export interface ElevatorFacilityMatch extends FacilityMatchDiagnostics {
  componentId: string
  floor: number
  spaceId?: string
  facilityId: string | null
  method: FacilityMatchMethod
}
export interface EscalatorFacilityMatch extends FacilityMatchDiagnostics {
  linkId: string
  fromFloor: number
  toFloor: number
  direction: number
  spaceId?: string
  facilityId: string | null
  method: FacilityMatchMethod
}

const NEARBY_LIMIT_METERS = 2
const NEARBY_MIN_MARGIN_METERS = 0.5
const ELEVATOR_AREA = 'B022'
const ESCALATOR_AREA = 'B023'
const ELEVATOR_FACILITY = 'F012'
const ESCALATOR_FACILITY = 'F013'
type Point = [number, number]
type Ring = Point[]
type Polygon = Ring[]

const polygons = (feature: StationMapGeoJsonFeature): Polygon[] => {
  if (feature.geometry.type === 'Polygon') return [feature.geometry.coordinates as Polygon]
  if (feature.geometry.type === 'MultiPolygon') return feature.geometry.coordinates as Polygon[]
  return []
}
const point = (feature: StationMapGeoJsonFeature): Point | undefined => {
  const coords = feature.geometry.coordinates
  return feature.geometry.type === 'Point' && Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number'
    ? [coords[0], coords[1]] : undefined
}
const inRing = ([x, y]: Point, ring: Ring) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (onSegment([x, y], [xi, yi], [xj, yj])) return true
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const onSegment = (p: Point, a: Point, b: Point) => {
  const cross = (p[1] - a[1]) * (b[0] - a[0]) - (p[0] - a[0]) * (b[1] - a[1])
  if (Math.abs(cross) > 1e-12) return false
  return p[0] >= Math.min(a[0], b[0]) - 1e-12 && p[0] <= Math.max(a[0], b[0]) + 1e-12 && p[1] >= Math.min(a[1], b[1]) - 1e-12 && p[1] <= Math.max(a[1], b[1]) + 1e-12
}
const inPolygon = (p: Point, polygon: Polygon) => polygon.length > 0 && inRing(p, polygon[0]) && polygon.slice(1).every(ring => !inRing(p, ring))
const inGeometry = (p: Point, feature: StationMapGeoJsonFeature) => polygons(feature).some(poly => inPolygon(p, poly))
const cross = (a: Point, b: Point, c: Point) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
const segmentsIntersect = (a: Point, b: Point, c: Point, d: Point) => {
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b)
  if (Math.abs(abC) < 1e-12 && onSegment(c, a, b)) return true
  if (Math.abs(abD) < 1e-12 && onSegment(d, a, b)) return true
  if (Math.abs(cdA) < 1e-12 && onSegment(a, c, d)) return true
  if (Math.abs(cdB) < 1e-12 && onSegment(b, c, d)) return true
  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0)
}
const lineIntersects = (line: Point[], feature: StationMapGeoJsonFeature) => polygons(feature).some(poly => {
  if (line.some(p => inPolygon(p, poly))) return true
  const boundaries = poly.flatMap(ring => ring.map((p, i) => [p, ring[(i + 1) % ring.length]] as const))
  return line.slice(1).some((p, i) => boundaries.some(([a, b]) => segmentsIntersect(line[i], p, a, b)))
})

// Local equirectangular projection is used only for meter distances over a station-scale area.
const projectMeters = (p: Point, origin: Point): Point => {
  const radians = Math.PI / 180
  return [(p[0] - origin[0]) * radians * 6371008.8 * Math.cos(origin[1] * radians), (p[1] - origin[1]) * radians * 6371008.8]
}
const pointSegmentDistanceMeters = (p: Point, a: Point, b: Point) => {
  const origin = p, pp = projectMeters(p, origin), aa = projectMeters(a, origin), bb = projectMeters(b, origin)
  const dx = bb[0] - aa[0], dy = bb[1] - aa[1], length2 = dx * dx + dy * dy
  const t = length2 ? Math.max(0, Math.min(1, ((pp[0] - aa[0]) * dx + (pp[1] - aa[1]) * dy) / length2)) : 0
  return Math.hypot(pp[0] - aa[0] - t * dx, pp[1] - aa[1] - t * dy)
}
const distanceToPolygonMeters = (p: Point, feature: StationMapGeoJsonFeature) => {
  if (inGeometry(p, feature)) return 0
  return Math.min(...polygons(feature).flatMap(poly => poly.flatMap(ring => ring.map((a, i) => pointSegmentDistanceMeters(p, a, ring[(i + 1) % ring.length])))))
}
const featureId = (feature: StationMapGeoJsonFeature) => String(feature.properties?.id ?? '') || undefined
const floorOrdinalById = (floors: StationMapGeoJsonCollection[]) => new Map(floors.flatMap(c => c.features).map(f => [String(f.properties?.id ?? ''), Number(f.properties?.ordinal)] as const).filter(([id, n]) => id && Number.isFinite(n)))
const sameFloorSpaces = (spaces: StationMapGeoJsonCollection[], ordinalById: Map<string, number>, category: string, floor: number) =>
  spaces.flatMap(c => c.features).filter(f => f.properties?.category === category && ordinalById.get(String(f.properties?.floor_id ?? '')) === floor)
const facilityInSpace = (facilityCollections: StationMapGeoJsonCollection[], space: StationMapGeoJsonFeature, category: string) => {
  const floorId = String(space.properties?.floor_id ?? '')
  const matches = facilityCollections.flatMap(c => c.features).filter(f => f.properties?.category === category && String(f.properties?.floor_id ?? '') === floorId)
    .filter(f => { const p = point(f); return p !== undefined && inGeometry(p, space) })
  return matches.length === 1 ? featureId(matches[0]) ?? null : null
}

/** Resolves each connected route_type=4 component independently on every floor it serves. */
export function resolveElevatorFacility(input: {
  nodes: RawWalkingNetworkNode[]; links: RawWalkingNetworkLink[]; spaces: StationMapGeoJsonCollection[]
  facilities: StationMapGeoJsonCollection[]; floors: StationMapGeoJsonCollection[]
}): ElevatorFacilityMatch[] {
  const elevatorLinks = input.links.filter(link => link.routeType === 4)
  const parent = new Map<string, string>()
  const find = (id: string): string => { const p = parent.get(id) ?? id; if (p === id) { parent.set(id, id); return id } const root = find(p); parent.set(id, root); return root }
  for (const link of elevatorLinks) { const a = find(link.startNodeId), b = find(link.endNodeId); if (a !== b) parent.set(b, a) }
  const components = new Map<string, Set<string>>()
  for (const link of elevatorLinks) { const root = find(link.startNodeId); const set = components.get(root) ?? new Set<string>(); set.add(link.startNodeId); set.add(link.endNodeId); components.set(root, set) }
  const nodeById = new Map(input.nodes.map(n => [n.id, n]))
  const ordinalById = floorOrdinalById(input.floors)
  const results: ElevatorFacilityMatch[] = []
  for (const nodeSet of components.values()) {
    const byFloor = new Map<number, RawWalkingNetworkNode[]>()
    for (const id of nodeSet) { const n = nodeById.get(id); const floor = n?.floor === undefined ? undefined : Number(n.floor); if (n && Number.isFinite(floor)) { const set = byFloor.get(floor!) ?? []; set.push(n); byFloor.set(floor!, set) } }
    const componentId = `elevator-component:${[...nodeSet].sort().join('|')}`
    for (const [floor, nodes] of byFloor) {
      const candidates = sameFloorSpaces(input.spaces, ordinalById, ELEVATOR_AREA, floor).filter(space => nodes.some(n => inGeometry([n.longitude, n.latitude], space)))
      const chosen = candidates.length === 1 ? candidates[0] : undefined
      results.push({ componentId, floor, candidateSpaceCount: candidates.length, ...(chosen && featureId(chosen) ? { spaceId: featureId(chosen) } : {}), facilityId: chosen ? facilityInSpace(input.facilities, chosen, ELEVATOR_FACILITY) : null, method: chosen ? 'contained' : 'unmatched' })
    }
  }
  return results
}

/** Resolves route_type=5 links geometrically; a failed match never removes a routing link. */
export function resolveEscalatorFacility(input: {
  nodes: RawWalkingNetworkNode[]; links: RawWalkingNetworkLink[]; linkGeometryById: ReadonlyMap<string, Point[]>
  spaces: StationMapGeoJsonCollection[]; facilities: StationMapGeoJsonCollection[]; floors: StationMapGeoJsonCollection[]
}): EscalatorFacilityMatch[] {
  const nodeById = new Map(input.nodes.map(n => [n.id, n]))
  const ordinalById = floorOrdinalById(input.floors)
  const results: EscalatorFacilityMatch[] = []
  for (const link of input.links.filter(item => item.routeType === 5)) {
    const from = nodeById.get(link.startNodeId), to = nodeById.get(link.endNodeId)
    if (!from || !to) continue
    const fromFloor = Number(from.floor), toFloor = Number(to.floor)
    const line = input.linkGeometryById.get(link.id) ?? []
    const candidateRecords = input.spaces.flatMap(c => c.features).filter(space => space.properties?.category === ESCALATOR_AREA)
      .map(space => ({ space, floor: ordinalById.get(String(space.properties?.floor_id ?? '')) }))
      .filter(item => item.floor === fromFloor || item.floor === toFloor)
      .map(item => ({ ...item, endpoint: item.floor === fromFloor ? [from.longitude, from.latitude] as Point : [to.longitude, to.latitude] as Point }))
    const intersections = line.length >= 2 ? candidateRecords.filter(item => lineIntersects(line, item.space)) : []
    let chosen: typeof candidateRecords[number] | undefined
    let method: FacilityMatchMethod = 'unmatched'
    let ranked: Array<{ item: typeof candidateRecords[number]; distance: number }> = []
    if (intersections.length) {
      ranked = intersections.map(item => ({ item, distance: distanceToPolygonMeters(item.endpoint, item.space) })).sort((a, b) => a.distance - b.distance)
      if (ranked.length === 1 || ranked[1].distance - ranked[0].distance > Number.EPSILON) { chosen = ranked[0].item; method = 'intersection' }
    } else {
      ranked = candidateRecords.map(item => ({ item, distance: distanceToPolygonMeters(item.endpoint, item.space) })).sort((a, b) => a.distance - b.distance)
      const nearest = ranked[0]?.distance, second = ranked[1]?.distance
      if (nearest !== undefined && nearest <= NEARBY_LIMIT_METERS && (second === undefined || second - nearest >= NEARBY_MIN_MARGIN_METERS)) { chosen = ranked[0].item; method = 'nearby' }
    }
    results.push({ linkId: link.id, fromFloor, toFloor, direction: link.direction, ...(chosen && featureId(chosen.space) ? { spaceId: featureId(chosen.space) } : {}), facilityId: chosen ? facilityInSpace(input.facilities, chosen.space, ESCALATOR_FACILITY) : null, method, candidateSpaceCount: method === 'intersection' ? intersections.length : candidateRecords.length, ...(ranked[0] ? { nearestDistanceMeters: ranked[0].distance } : {}), ...(ranked[1] ? { secondNearestDistanceMeters: ranked[1].distance } : {}) })
  }
  return results
}

/** Combines optional map matches with the walking graph; graph construction is never conditional on a match. */
export function resolveWalkingNetworkFacilities(input: {
  nodes: RawWalkingNetworkNode[]; links: RawWalkingNetworkLink[]; linkGeometryById: ReadonlyMap<string, Point[]>
  spaces: StationMapGeoJsonCollection[]; facilities: StationMapGeoJsonCollection[]; floors: StationMapGeoJsonCollection[]
}) {
  return {
    elevators: resolveElevatorFacility(input),
    escalators: resolveEscalatorFacility(input),
  }
}

/** Build the route graph first, then attach optional map matches as sidecar metadata. */
export function buildWalkingNetworkRoutingData(input: {
  data: RawWalkingNetworkStationData; linkGeometryById: ReadonlyMap<string, Point[]>
  spaces: StationMapGeoJsonCollection[]; facilities: StationMapGeoJsonCollection[]; floors: StationMapGeoJsonCollection[]
}): WalkingNetworkBuildResult & { facilityMatches: { elevators: ElevatorFacilityMatch[]; escalators: EscalatorFacilityMatch[] } } {
  const result = buildWalkingNetworkGraph(input.data)
  const facilityMatches = resolveWalkingNetworkFacilities({ ...input.data, linkGeometryById: input.linkGeometryById, spaces: input.spaces, facilities: input.facilities, floors: input.floors })
  return { ...result, facilityMatches }
}
