import manifest from './fixtures/verified-pathway-crosswalk.json'
import type { IndoorGraph } from '../domain/indoorRouting'
import type { PathwayEnrichment } from '../domain/types'
import type { StationMapGeoJsonCollection } from '../domain/stationMap'
import { parseWalkingNetworkGeoJson, type WalkingNetworkFeatureCollection } from '../domain/walkingNetworkGeoJson'
import { resolveWalkingNetworkFacilities } from '../domain/walkingNetworkFacilityMatching'

// Registry content is data, not a station-specific behavior switch. Raw files
// are used only to enrich audited GTFS Pathways, never to build the route.
const rawGeoJson = import.meta.glob('./stationMaps/**/*.geojson', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
type ManifestStation = { feedVersion: string; stationMapDirectory: string; pathways: Record<string, { walkingLinkId: string; gtfsMode: number; fromStopId: string; toStopId: string; walkingFromNodeId: string; walkingToNodeId: string; fromWalkingFloor: number; toWalkingFloor: number }> }
const stations = manifest.stations as Record<string, ManifestStation>
const cache = new WeakMap<IndoorGraph, ReadonlyMap<string, PathwayEnrichment>>()
const expectedRouteType = new Map([[1, 1], [2, 6], [3, 2], [4, 5], [5, 4]])

const parse = (raw: string) => JSON.parse(raw) as StationMapGeoJsonCollection
const unique = (values: Array<string | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value)))]

/** Audit-approved Pathways only; any missing/stale source yields an empty sidecar. */
export function buildVerifiedPathwayEnrichments(
  graph: IndoorGraph,
  resolveFacilities: typeof resolveWalkingNetworkFacilities = resolveWalkingNetworkFacilities,
): ReadonlyMap<string, PathwayEnrichment> {
  const registration = stations[graph.stationId]
  if (!registration || registration.feedVersion !== graph.source.feedVersion) return new Map()
  const cached = cache.get(graph)
  if (cached && resolveFacilities === resolveWalkingNetworkFacilities) return cached
  const result = new Map<string, PathwayEnrichment>()
  try {
    const prefix = `./stationMaps/${registration.stationMapDirectory}/`
    const entries = Object.entries(rawGeoJson).filter(([path]) => path.startsWith(prefix))
    const nodeRaw = entries.find(([path]) => path.endsWith('/node.geojson'))?.[1]
    const linkRaw = entries.find(([path]) => path.endsWith('/link.geojson'))?.[1]
    if (!nodeRaw || !linkRaw) return result
    const collection = (pattern: RegExp) => entries.filter(([path]) => pattern.test(path)).map(([, raw]) => parse(raw))
    const parsed = parseWalkingNetworkGeoJson({
      source: { name: 'ほこナビDP walking network', url: '', license: '', feedVersion: '', retrievedAt: '' },
      stationId: graph.stationId, stationName: graph.stationName,
      nodes: parse(nodeRaw) as WalkingNetworkFeatureCollection,
      links: parse(linkRaw) as WalkingNetworkFeatureCollection,
    })
    const links = new Map(parsed.data.links.map(link => [link.id, link]))
    const graphEdges = new Map(graph.edges.map(edge => [edge.id, edge]))
    let matches: ReturnType<typeof resolveWalkingNetworkFacilities> | undefined
    try {
      matches = resolveFacilities({ ...parsed.data, linkGeometryById: parsed.linkGeometryById,
        facilities: collection(/Facility(?:_|\.)[^/]*\.geojson$/i),
        spaces: collection(/Space(?:_|\.)[^/]*\.geojson$/i),
        floors: collection(/Floor(?:_|\.)[^/]*\.geojson$/i),
      })
    } catch {
      // StationMap failure must not remove either GTFS route or verified walking link.
    }
    const escalators = new Map(matches?.escalators.map(match => [match.linkId, match]) ?? [])
    const elevatorComponents = (matches?.elevators ?? []).map(match => ({ match,
      nodes: new Set(match.componentId.replace(/^elevator-component:/, '').split('|')) }))
    for (const [pathwayId, audited] of Object.entries(registration.pathways)) {
      const edge = graphEdges.get(pathwayId), link = links.get(audited.walkingLinkId)
      if (!edge || edge.sourceType !== 'gtfs-pathways' || !link || link.routeType !== expectedRouteType.get(audited.gtfsMode)) continue
      if (!((edge.fromNodeId === audited.fromStopId && edge.toNodeId === audited.toStopId)
        || (edge.fromNodeId === audited.toStopId && edge.toNodeId === audited.fromStopId))) continue
      const base: PathwayEnrichment = { pathwayId, verified: true, walkingLinkId: link.id, walkingDirection: link.direction,
        pathwayMode: audited.gtfsMode, routeType: link.routeType, fromStopId: audited.fromStopId, toStopId: audited.toStopId,
        walkingFromNodeId: audited.walkingFromNodeId, walkingToNodeId: audited.walkingToNodeId,
        fromWalkingFloor: audited.fromWalkingFloor, toWalkingFloor: audited.toWalkingFloor }
      if (link.routeType === 5) {
        const match = escalators.get(link.id)
        result.set(pathwayId, { ...base, facilityKind: 'escalator',
          ...(match ? { spaceId: match.spaceId, facilityId: match.facilityId, matchMethod: match.method } : { facilityId: null, matchMethod: 'unmatched' }) })
      } else if (link.routeType === 4) {
        const floorMatches = elevatorComponents.filter(item => item.nodes.has(link.startNodeId) && item.nodes.has(link.endNodeId))
          .map(item => item.match).sort((a, b) => a.floor - b.floor)
        const spaces = unique(floorMatches.map(match => match.spaceId))
        const facilities = unique(floorMatches.map(match => match.facilityId ?? undefined))
        result.set(pathwayId, { ...base, facilityKind: 'elevator',
          spaceId: spaces.length === 1 ? spaces[0] : undefined,
          facilityId: facilities.length === 1 && floorMatches.every(match => match.facilityId === facilities[0]) ? facilities[0] : null,
          matchMethod: floorMatches.length && floorMatches.every(match => match.method === 'contained') ? 'contained' : 'unmatched',
          floorMatches: floorMatches.map(match => ({ floor: match.floor, spaceId: match.spaceId, facilityId: match.facilityId, method: match.method })),
        })
      } else result.set(pathwayId, base)
    }
  } catch {
    // An unreadable optional overlay is never a routing failure.
  }
  if (resolveFacilities === resolveWalkingNetworkFacilities) cache.set(graph, result)
  return result
}
