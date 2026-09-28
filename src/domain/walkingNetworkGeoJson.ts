import type { IndoorSource } from './indoorRouting'
import type { RawWalkingNetworkLink, RawWalkingNetworkNode, RawWalkingNetworkStationData } from './walkingNetwork'

export interface WalkingNetworkFeature { type: 'Feature'; geometry: { type: 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon'; coordinates: unknown }; properties?: Record<string, unknown> }
export interface WalkingNetworkFeatureCollection { type: 'FeatureCollection'; features: WalkingNetworkFeature[] }
export interface ParsedWalkingNetworkGeoJson {
  data: RawWalkingNetworkStationData
  linkGeometryById: ReadonlyMap<string, Array<[number, number]>>
}

const finite = (value: unknown): number | undefined => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** Converts the published Point/LineString resources without changing their graph identities. */
export function parseWalkingNetworkGeoJson(input: {
  source: IndoorSource; stationId: string; stationName: string
  nodes: WalkingNetworkFeatureCollection; links: WalkingNetworkFeatureCollection
}): ParsedWalkingNetworkGeoJson {
  const nodes: RawWalkingNetworkNode[] = input.nodes.features.flatMap(feature => {
    const p = feature.properties ?? {}, coords = feature.geometry.coordinates
    const id = String(p.node_id ?? '')
    const latitude = finite(p.lat), longitude = finite(p.lon), floor = p.floor === undefined ? undefined : String(p.floor)
    if (!id || latitude === undefined || longitude === undefined || feature.geometry.type !== 'Point') return []
    const inOut = finite(p.in_out)
    return [{ id, latitude, longitude, ...(floor !== undefined ? { floor } : {}), ...(inOut === 1 || inOut === 2 || inOut === 3 ? { inOut } : {}) }]
  })
  const linkGeometryById = new Map<string, Array<[number, number]>>()
  const links: RawWalkingNetworkLink[] = input.links.features.flatMap(feature => {
    const p = feature.properties ?? {}, id = String(p.link_id ?? '')
    const routeType = finite(p.route_type), direction = finite(p.direction), distanceMeters = finite(p.distance)
    const startNodeId = String(p.start_id ?? ''), endNodeId = String(p.end_id ?? '')
    if (!id || !startNodeId || !endNodeId || distanceMeters === undefined || ![1, 2, 3, 4, 5, 6, 7, 99].includes(routeType ?? -1) || ![1, 2, 3, 99].includes(direction ?? -1)) return []
    const coords = feature.geometry.coordinates
    if (feature.geometry.type === 'LineString' && Array.isArray(coords)) {
      const line = coords.flatMap(value => Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number' ? [[value[0], value[1]] as [number, number]] : [])
      if (line.length >= 2) linkGeometryById.set(id, line)
    }
    return [{ id, startNodeId, endNodeId, distanceMeters, routeType: routeType as RawWalkingNetworkLink['routeType'], direction: direction as RawWalkingNetworkLink['direction'] }]
  })
  return { data: { source: input.source, stationId: input.stationId, stationName: input.stationName, nodes, links }, linkGeometryById }
}
