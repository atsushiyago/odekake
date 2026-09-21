import type { IndoorEdge, IndoorGraph, IndoorMovementType, IndoorNode, IndoorSource } from './indoorRouting'

/** Fields retained from the published pedestrian-network CSV. No GTFS IDs are inferred here. */
export interface RawWalkingNetworkNode {
  id: string; latitude: number; longitude: number; floor?: string; inOut?: 1 | 2 | 3; connection?: string
}
export interface RawWalkingNetworkLink {
  id: string; startNodeId: string; endNodeId: string; distanceMeters: number
  routeType: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 99; direction: 1 | 2 | 3 | 99
}
export interface RawWalkingNetworkStationData {
  source: IndoorSource; stationId: string; stationName: string; nodes: RawWalkingNetworkNode[]; links: RawWalkingNetworkLink[]
}
export interface WalkingNetworkBuildResult {
  graph: IndoorGraph; danglingLinkIds: string[]; skippedUnknownDirectionLinkIds: string[]
}

const routeMovementTypes: Record<RawWalkingNetworkLink['routeType'], IndoorMovementType> = {
  1: 'walk', 2: 'moving-walkway', 3: 'rail-crossing', 4: 'elevator', 5: 'escalator', 6: 'stairs', 7: 'slope', 99: 'unknown'
}

function levelIndex(floor: string | undefined) {
  if (floor === undefined || floor.trim() === '') return undefined
  const parsed = Number(floor)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Normalizes a walking-space network into the same graph shape as GTFS-Pathways.
 * This intentionally creates no links to GTFS stops: a published ID crosswalk is required first.
 */
export function buildWalkingNetworkGraph(raw: RawWalkingNetworkStationData): WalkingNetworkBuildResult {
  const nodes = new Map<string, IndoorNode>(raw.nodes.map(node => [node.id, {
    id: node.id, latitude: node.latitude, longitude: node.longitude, levelIndex: levelIndex(node.floor), locationType: 3, kind: 'internal'
  }]))
  const edges: IndoorEdge[] = []
  const danglingLinkIds: string[] = []
  const skippedUnknownDirectionLinkIds: string[] = []
  for (const link of raw.links) {
    if (!nodes.has(link.startNodeId) || !nodes.has(link.endNodeId)) { danglingLinkIds.push(link.id); continue }
    // `99` means direction is unknown. It is not safe to invent a traversal direction.
    if (link.direction === 99) { skippedUnknownDirectionLinkIds.push(link.id); continue }
    const edge = { id: link.id, lengthMeters: link.distanceMeters, movementType: routeMovementTypes[link.routeType], sourceType: 'walking-network' as const }
    if (link.direction !== 3) edges.push({ ...edge, fromNodeId: link.startNodeId, toNodeId: link.endNodeId })
    if (link.direction === 1 || link.direction === 3) edges.push({ ...edge, fromNodeId: link.endNodeId, toNodeId: link.startNodeId })
  }
  const adjacency = new Map([...nodes.keys()].map(id => [id, [] as IndoorEdge[]]))
  edges.forEach(edge => adjacency.get(edge.fromNodeId)?.push(edge))
  return { graph: { source: raw.source, stationId: raw.stationId, stationName: raw.stationName, nodes, edges, adjacency }, danglingLinkIds, skippedUnknownDirectionLinkIds }
}
