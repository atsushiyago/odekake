import type { GuideStep, StationGuide, StationRef } from './types.ts'

export type PathwayMode = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type RoutePreference = 'shortest' | 'avoid-stairs' | 'elevator-priority' | 'escalator-priority' | 'wheelchair-accessible'
export type IndoorMovementType = 'walk' | 'stairs' | 'moving-walkway' | 'escalator' | 'elevator' | 'fare-gate' | 'exit-gate' | 'slope' | 'rail-crossing' | 'unknown'
export type VerticalDirection = 'up' | 'down' | 'unknown'
type VerticalDirectionEvidence = 'complete' | 'incomplete' | 'neutral-connector'

export interface IndoorSource { name: string; url: string; license: string; feedVersion: string; retrievedAt: string }
export interface RawGtfsStop {
  id: string; name?: string; latitude: number; longitude: number; locationType: number
  levelIndex?: number; platformCode?: string; parentPlatformId?: string
}
export interface RawGtfsPathway { id: string; fromStopId: string; toStopId: string; mode: PathwayMode; isBidirectional: boolean; lengthMeters: number }
export interface RawGtfsPathwaysStationData {
  source: IndoorSource; stationId: string; stationName: string; levels: number[]
  stops: RawGtfsStop[]; pathways: RawGtfsPathway[]
}
export interface IndoorNode extends RawGtfsStop { kind: 'platform' | 'entrance-exit' | 'boarding-area' | 'internal' | 'station' | 'other' }
/** Provider-neutral graph edge. `sourceType` preserves the original source semantics. */
export interface IndoorEdge {
  id: string; fromNodeId: string; toNodeId: string; lengthMeters: number; movementType: IndoorMovementType
  sourceType: 'gtfs-pathways' | 'walking-network'
}
export interface IndoorGraph { source: IndoorSource; stationId: string; stationName: string; nodes: Map<string, IndoorNode>; edges: IndoorEdge[]; adjacency: Map<string, IndoorEdge[]> }
export interface IndoorRoute { nodes: IndoorNode[]; edges: IndoorEdge[]; distanceMeters: number }
export interface IndoorRouteStep { type: IndoorMovementType; distanceMeters: number; verticalDirection?: 'up' | 'down'; /** Complete only when all vertical edges agree; verified nonvertical connectors are neutral, never directional evidence. */ verticalDirectionEvidence?: VerticalDirectionEvidence; evidence: { edgeIds: string[]; fromNodeId: string; toNodeId: string; fromLevelIndex?: number; toLevelIndex?: number; mapLocations?: Array<{ pathwayId: string; spaceId?: string; facilityId?: string; facilityGroupId?: string }> } }

const verticalMovementTypes = new Set<IndoorMovementType>(['stairs', 'escalator', 'elevator'])

/** Resolves relative traversal direction only; it never formats a level as a floor name. */
export function resolveVerticalDirection(startLevel: number | undefined, endLevel: number | undefined): VerticalDirection {
  if (startLevel === undefined || endLevel === undefined || !Number.isFinite(startLevel) || !Number.isFinite(endLevel) || startLevel === endLevel) return 'unknown'
  return endLevel > startLevel ? 'up' : 'down'
}

/** Candidate consensus is valid only when every candidate resolves and agrees. */
export function resolveVerticalDirectionConsensus(directions: VerticalDirection[]): VerticalDirection {
  if (!directions.length || directions.some(direction => direction === 'unknown')) return 'unknown'
  return directions.every(direction => direction === directions[0]) ? directions[0] : 'unknown'
}
/** Optional, published-map-derived evidence used only to make step compression safer. */
export interface IndoorRouteCompressionContext {
  byPathwayId: Record<string, { spaceId?: string; facilityId?: string; facilityGroupId?: string }>
  /** Official Floor metadata keyed by the GTFS level it explicitly corroborates. */
  officialFloorsByLevelIndex?: Record<number, { label: string; sourceUrl: string }>
  /** Nodes proven not to offer an outgoing branch in the source graph. */
  nonBranchingNodeIds?: ReadonlySet<string>
  /** Trial-only generic rule for same-direction stairs across a short landing. */
  allowDecisionFreeStairBridges?: boolean
  /** Published map proof may allow a short, non-branching stair landing to turn between flights. */
  allowDecisionFreeStairTurns?: boolean
  /** Published-map proof may allow the audited 6 m same-facility landing rule. */
  allowExtendedSameFacilityStairLandings?: boolean
  /** Opt-in for restoring a vertical action proven identical across all boarding-area candidates. */
  allowSemanticConsensusVerticalRestoration?: boolean
}

function officialFloorForLevel(context: IndoorRouteCompressionContext | undefined, levelIndex: number | undefined) {
  return levelIndex === undefined ? undefined : context?.officialFloorsByLevelIndex?.[levelIndex]
}

function officialGateFloor(graph: IndoorGraph, edge: IndoorEdge | undefined, context: IndoorRouteCompressionContext | undefined) {
  const node = edge ? graph.nodes.get(edge.fromNodeId) : undefined
  const floor = officialFloorForLevel(context, node?.levelIndex)
  return floor && node?.levelIndex !== undefined ? { ...floor, levelIndex: node.levelIndex } : undefined
}

/** A walkway this short is treated as a landing/connector only when topology also proves it has no branch. */
export const SHORT_CONNECTOR_WALKWAY_MAX_METERS = 3
/** A published facility overlay may prove a slightly longer flat landing is
 * still inside one continuous stairwell. Ordinary corridors retain the 3 m
 * limit above. */
export const SAME_FACILITY_STAIR_LANDING_MAX_METERS = 6
/** A stairwell may turn at a landing; turns approaching a U-turn remain a
 * separate decision unless the published map proves a continuous stairwell. */
export const SAME_FACILITY_STAIR_LANDING_MAX_ANGLE_DEGREES = 135
/** A bridge is only humanly continuous when the path direction changes by no more than this. */
export const DECISION_FREE_BRIDGE_MAX_ANGLE_DEGREES = 18

/** Conservative thresholds for human-facing direction labels. */
export const INDOOR_DIRECTION_THRESHOLDS = {
  minSegmentLengthMeters: 4,
  straightMaxAngleDegrees: 18,
  turnMinAngleDegrees: 45,
  turnMaxAngleDegrees: 135,
  uTurnMinAngleDegrees: 150,
} as const

export interface IndoorDirectionDecision {
  edgeId: string
  previousNodeId: string
  currentNodeId: string
  nextNodeId: string
  angleDegrees: number
  result?: 'left' | 'right' | 'straight'
  reason: string
}

/** Directional wording immediately after a fare gate, only when geometry is decisive. */
export function deriveFareGateExitDirection(graph: IndoorGraph, before: GuideStep | undefined, gate: GuideStep | undefined, after: GuideStep | undefined): IndoorDirectionDecision | undefined {
  if (!before || !gate || !after) return undefined
  const previousNodeId = before.evidence?.fromNodeId
  const currentNodeId = gate.evidence?.toNodeId
  const nextNodeId = after.evidence?.toNodeId
  const gateFromNodeId = gate.evidence?.fromNodeId
  if (!previousNodeId || !currentNodeId || !nextNodeId || !gateFromNodeId || before.facility || after.facility || gate.facility !== 'gate') return undefined
  const previous = graph.nodes.get(previousNodeId), current = graph.nodes.get(gateFromNodeId), next = graph.nodes.get(nextNodeId), gateExit = graph.nodes.get(currentNodeId)
  if (!previous || !current || !next || !gateExit || current.levelIndex !== gateExit.levelIndex) return undefined
  if ((before.evidence?.distanceMeters ?? 0) < INDOOR_DIRECTION_THRESHOLDS.minSegmentLengthMeters || (after.evidence?.distanceMeters ?? 0) < INDOOR_DIRECTION_THRESHOLDS.minSegmentLengthMeters) return undefined
  if ((graph.adjacency.get(gateExit.id)?.length ?? 0) > 2) return undefined
  const incoming = localVector(previous, current), outgoing = localVector(gateExit, next)
  const incomingLength = Math.hypot(incoming.x, incoming.y), outgoingLength = Math.hypot(outgoing.x, outgoing.y)
  if (incomingLength < INDOOR_DIRECTION_THRESHOLDS.minSegmentLengthMeters || outgoingLength < INDOOR_DIRECTION_THRESHOLDS.minSegmentLengthMeters) return undefined
  const angleDegrees = (Math.atan2(incoming.x * outgoing.y - incoming.y * outgoing.x, incoming.x * outgoing.x + incoming.y * outgoing.y) * 180) / Math.PI
  const magnitude = Math.abs(angleDegrees)
  if (magnitude < INDOOR_DIRECTION_THRESHOLDS.turnMinAngleDegrees || magnitude > INDOOR_DIRECTION_THRESHOLDS.turnMaxAngleDegrees) return undefined
  return { edgeId: gate.evidence?.edgeIds?.[0] ?? 'gate', previousNodeId, currentNodeId: gateFromNodeId, nextNodeId, angleDegrees, result: angleDegrees > 0 ? 'left' : 'right', reason: 'gate-adjacent geometry with non-branching exit' }
}
/** A reviewer-selected exact alighting point. This is never inferred from a platform. */
export interface VerifiedIndoorRouteAnchor {
  stationId: string; platformId: string; boardingAreaId: string; exitNodeId: string
  verifiedBy: string; verifiedAt: string; evidenceUrl: string
}
/** Human-reviewed wording required to turn a valid route into a printable StationGuide. */
export interface VerifiedStationGuideDetails {
  arrivalPlatformLabel: string; gateLabel: string; exitLabel: string; safeAlternative: string
}
export type RoutePreferenceSupport = { supported: true } | { supported: false; reason: string }
export type VerifiedRouteFailureReason = 'invalid-review-record' | 'station-mismatch' | 'origin-not-on-platform' | 'target-is-not-exit' | 'no-directed-route'
export type VerifiedRouteResolution =
  | { ok: true; route: IndoorRoute }
  | { ok: false; reason: VerifiedRouteFailureReason }
export type StationGuideBuildResult =
  | { ok: true; guide: StationGuide }
  | { ok: false; reason: 'invalid-guide-details' | VerifiedRouteFailureReason }
export type GtfsStationGuideBuildResult =
  | { ok: true; guide: StationGuide }
  | { ok: false; reason: 'station-mismatch' | 'target-is-not-exit' | 'no-platform-origins' | 'no-common-route' }
export interface IndoorGraphAudit {
  platforms: IndoorNode[]; entrancesAndExits: IndoorNode[]; danglingPathwayIds: string[]
  platformsWithoutRoutableOrigin: IndoorNode[]; platformsWithoutExitRoute: IndoorNode[]
}

const nodeKinds: Record<number, IndoorNode['kind']> = { 0: 'platform', 1: 'station', 2: 'entrance-exit', 3: 'internal', 4: 'boarding-area' }
const pathwayMovementTypes: Record<PathwayMode, IndoorMovementType> = { 1: 'walk', 2: 'stairs', 3: 'moving-walkway', 4: 'escalator', 5: 'elevator', 6: 'fare-gate', 7: 'exit-gate' }
const kindFor = (type: number): IndoorNode['kind'] => nodeKinds[type] ?? 'other'
export const movementTypeForGtfsPathway = (mode: PathwayMode): IndoorMovementType => pathwayMovementTypes[mode]

export function buildIndoorGraph(raw: RawGtfsPathwaysStationData): IndoorGraph {
  const nodes = new Map(raw.stops.map(stop => [stop.id, { ...stop, kind: kindFor(stop.locationType) }]))
  const edges: IndoorEdge[] = []
  for (const path of raw.pathways) {
    if (!nodes.has(path.fromStopId) || !nodes.has(path.toStopId)) continue
    const edge = { id: path.id, lengthMeters: path.lengthMeters, movementType: movementTypeForGtfsPathway(path.mode), sourceType: 'gtfs-pathways' as const }
    edges.push({ ...edge, fromNodeId: path.fromStopId, toNodeId: path.toStopId })
    if (path.isBidirectional) edges.push({ ...edge, fromNodeId: path.toStopId, toNodeId: path.fromStopId })
  }
  const adjacency = new Map([...nodes.keys()].map(id => [id, [] as IndoorEdge[]]))
  edges.forEach(edge => adjacency.get(edge.fromNodeId)?.push(edge))
  return { source: raw.source, stationId: raw.stationId, stationName: raw.stationName, nodes, edges, adjacency }
}

function cost(edge: IndoorEdge, preference: RoutePreference) {
  if (preference === 'avoid-stairs' && edge.movementType === 'stairs') return Number.POSITIVE_INFINITY
  if (preference === 'elevator-priority' && edge.movementType === 'elevator') return edge.lengthMeters * 0.1
  if (preference === 'escalator-priority' && edge.movementType === 'escalator') return edge.lengthMeters * 0.1
  return edge.lengthMeters
}

/** Wheelchair suitability cannot be inferred from pathway_mode or the presence of an elevator. */
export function routePreferenceSupport(preference: RoutePreference): RoutePreferenceSupport {
  if (preference === 'wheelchair-accessible') return { supported: false, reason: '車椅子対応には幅員・段差・勾配・エレベーターの利用可否などの確認済みデータが必要です。' }
  return { supported: true }
}

/** Metadata validity only. Whether the evidence is substantively sufficient remains a human review task. */
export function isValidVerifiedIndoorRouteAnchor(anchor: VerifiedIndoorRouteAnchor) {
  const hasIdentifiers = [anchor.stationId, anchor.platformId, anchor.boardingAreaId, anchor.exitNodeId, anchor.verifiedBy].every(value => value.trim().length > 0)
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(anchor.verifiedAt) ? new Date(`${anchor.verifiedAt}T00:00:00.000Z`) : undefined
  const hasDate = parsedDate !== undefined && !Number.isNaN(parsedDate.valueOf()) && parsedDate.toISOString().slice(0, 10) === anchor.verifiedAt
  try { const url = new URL(anchor.evidenceUrl); return hasIdentifiers && hasDate && url.protocol === 'https:' } catch { return false }
}

/** Dijkstra over only the directed edges actually supplied by the feed. */
export function findIndoorRoute(graph: IndoorGraph, fromNodeId: string, toNodeId: string, preference: RoutePreference = 'shortest'): IndoorRoute | null {
  if (!routePreferenceSupport(preference).supported) return null
  if (!graph.nodes.has(fromNodeId) || !graph.nodes.has(toNodeId)) return null
  const distances = new Map([[fromNodeId, 0]]), previous = new Map<string, IndoorEdge>(), pending = new Set(graph.nodes.keys())
  while (pending.size) {
    let current: string | undefined
    for (const node of pending) if (distances.has(node) && (!current || distances.get(node)! < distances.get(current)!)) current = node
    if (!current || current === toNodeId) break
    pending.delete(current)
    for (const edge of graph.adjacency.get(current) ?? []) {
      if (!pending.has(edge.toNodeId)) continue
      const next = distances.get(current)! + cost(edge, preference)
      if (next < (distances.get(edge.toNodeId) ?? Number.POSITIVE_INFINITY)) { distances.set(edge.toNodeId, next); previous.set(edge.toNodeId, edge) }
    }
  }
  if (!previous.has(toNodeId) && fromNodeId !== toNodeId) return null
  const edges: IndoorEdge[] = []
  for (let node = toNodeId; node !== fromNodeId;) { const edge = previous.get(node); if (!edge) return null; edges.unshift(edge); node = edge.fromNodeId }
  return { edges, nodes: [graph.nodes.get(fromNodeId)!, ...edges.map(edge => graph.nodes.get(edge.toNodeId)!)], distanceMeters: edges.reduce((sum, edge) => sum + edge.lengthMeters, 0) }
}

/** A route may be printed only if an actual directed graph path reaches an entrance/exit. */
export function auditIndoorGraph(raw: RawGtfsPathwaysStationData, graph: IndoorGraph): IndoorGraphAudit {
  const platforms = [...graph.nodes.values()].filter(node => node.kind === 'platform')
  const entrancesAndExits = [...graph.nodes.values()].filter(node => node.kind === 'entrance-exit')
  const danglingPathwayIds = raw.pathways.filter(path => !graph.nodes.has(path.fromStopId) || !graph.nodes.has(path.toStopId)).map(path => path.id)
  const platformsWithoutRoutableOrigin = platforms.filter(platform => platformOriginNodes(graph, platform.id).length === 0)
  const platformsWithoutExitRoute = platforms.filter(platform => !platformOriginNodes(graph, platform.id).every(origin => entrancesAndExits.some(exit => findIndoorRoute(graph, origin.id, exit.id))))
  return { platforms, entrancesAndExits, danglingPathwayIds, platformsWithoutRoutableOrigin, platformsWithoutExitRoute }
}

/** GTFS defines a boarding area as a precise board/alight location whose parent is a platform. */
export function platformOriginNodes(graph: IndoorGraph, platformId: string) {
  const boardingAreas = [...graph.nodes.values()].filter(node => node.kind === 'boarding-area' && node.parentPlatformId === platformId)
  return boardingAreas.length ? boardingAreas : graph.nodes.get(platformId) ? [graph.nodes.get(platformId)!] : []
}

export function findRoutesFromPlatform(graph: IndoorGraph, platformId: string, toNodeId: string, preference: RoutePreference = 'shortest') {
  return platformOriginNodes(graph, platformId).flatMap(origin => {
    const route = findIndoorRoute(graph, origin.id, toNodeId, preference)
    return route ? [{ origin, route }] : []
  })
}

export interface PlatformGateLevelConsensus {
  platformLevel: number
  gateLevel: number
  direction: 'up' | 'down'
  candidateCount: number
}

/**
 * Compares only the platform-to-first-fare-gate level transition. Equipment
 * type and precise boarding-area identity are deliberately ignored.
 */
export function findPlatformGateLevelConsensus(graph: IndoorGraph, platformId: string, exitNodeIds: string[]): PlatformGateLevelConsensus | null {
  const candidates = exitNodeIds.flatMap(exitNodeId => findRoutesFromPlatform(graph, platformId, exitNodeId, 'shortest'))
  const transitions = candidates.flatMap(candidate => {
    const gateIndex = candidate.route.edges.findIndex(edge => edge.movementType === 'fare-gate')
    if (gateIndex < 0) return []
    const platformLevel = candidate.route.nodes[0]?.levelIndex
    const gateLevel = candidate.route.nodes[gateIndex]?.levelIndex
    const direction = resolveVerticalDirection(platformLevel, gateLevel)
    if (direction === 'unknown') return []
    return [{ platformLevel: platformLevel!, gateLevel: gateLevel!, direction }]
  })
  if (!candidates.length || transitions.length !== candidates.length) return null
  const first = transitions[0]
  if (resolveVerticalDirectionConsensus(transitions.map(transition => transition.direction)) === 'unknown' || !transitions.every(transition => transition.platformLevel === first.platformLevel && transition.gateLevel === first.gateLevel)) return null
  return { ...first, candidateCount: candidates.length }
}

/**
 * Resolves only a human-reviewed exact boarding area. A platform alone is deliberately insufficient:
 * GTFS pathways can contain several valid alighting points with different routes.
 */
export function resolveVerifiedIndoorRoute(graph: IndoorGraph, anchor: VerifiedIndoorRouteAnchor, preference: RoutePreference = 'shortest'): VerifiedRouteResolution {
  if (!isValidVerifiedIndoorRouteAnchor(anchor)) return { ok: false, reason: 'invalid-review-record' }
  if (anchor.stationId !== graph.stationId) return { ok: false, reason: 'station-mismatch' }
  if (!platformOriginNodes(graph, anchor.platformId).some(node => node.id === anchor.boardingAreaId)) return { ok: false, reason: 'origin-not-on-platform' }
  if (graph.nodes.get(anchor.exitNodeId)?.kind !== 'entrance-exit') return { ok: false, reason: 'target-is-not-exit' }
  const route = findIndoorRoute(graph, anchor.boardingAreaId, anchor.exitNodeId, preference)
  return route ? { ok: true, route } : { ok: false, reason: 'no-directed-route' }
}

/** Returns only the identical final edge sequence shared by every candidate route. */
export function commonRouteSuffix(routes: IndoorRoute[]) {
  if (!routes.length) return [] as IndoorEdge[]
  let suffix = routes[0].edges
  for (const route of routes.slice(1)) {
    let shared = 0
    while (shared < suffix.length && shared < route.edges.length && suffix.at(-1 - shared)?.id === route.edges.at(-1 - shared)?.id) shared += 1
    suffix = shared === 0 ? [] : suffix.slice(-shared)
  }
  return suffix
}

export function toIndoorRouteSteps(route: IndoorRoute, context?: IndoorRouteCompressionContext): IndoorRouteStep[] {
  return route.edges.map(edge => {
    const from = route.nodes.find(node => node.id === edge.fromNodeId), to = route.nodes.find(node => node.id === edge.toNodeId)
    const direction = verticalMovementTypes.has(edge.movementType) ? resolveVerticalDirection(from?.levelIndex, to?.levelIndex) : 'unknown'
    const verticalDirection = direction === 'unknown' ? undefined : direction
    const location = context?.byPathwayId[edge.id]
    return { type: edge.movementType, distanceMeters: edge.lengthMeters, verticalDirection, verticalDirectionEvidence: verticalMovementTypes.has(edge.movementType) ? direction === 'unknown' ? 'incomplete' : 'complete' : undefined, evidence: { edgeIds: [edge.id], fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId, fromLevelIndex: from?.levelIndex, toLevelIndex: to?.levelIndex, mapLocations: location ? [{ pathwayId: edge.id, ...location }] : undefined } }
  })
}

/**
 * Makes a concise paper-oriented sequence without discarding a facility transition.
 * A map overlay may additionally prove that short walkway links are inside one facility.
 */
export function compactIndoorRouteSteps(route: IndoorRoute, context?: IndoorRouteCompressionContext): IndoorRouteStep[] {
  const rawSteps = toIndoorRouteSteps(route, context)
  const hasSameMappedElevatorGroup = (left: IndoorRouteStep, right: IndoorRouteStep) => {
    const leftLocation = context?.byPathwayId[left.evidence.edgeIds[0]]
    const rightLocation = context?.byPathwayId[right.evidence.edgeIds[0]]
    return Boolean(
      (leftLocation?.facilityGroupId && leftLocation.facilityGroupId === rightLocation?.facilityGroupId)
      || (leftLocation?.facilityId && leftLocation.facilityId === rightLocation?.facilityId),
    )
  }
  const isNeutralEquipmentConnector = (connector: IndoorRouteStep, previous: IndoorRouteStep | undefined, next: IndoorRouteStep | undefined) => {
    if (connector.type !== 'elevator' || connector.verticalDirectionEvidence !== 'incomplete') return false
    const fromLevel = connector.evidence.fromLevelIndex, toLevel = connector.evidence.toLevelIndex
    if (fromLevel === undefined || toLevel === undefined || fromLevel !== toLevel) return false
    if (!connector.evidence.mapLocations?.length) return false

    // A boundary connector needs one directly adjacent, direction-known EV
    // flight in the same explicitly mapped Facility. A connector between two
    // flights must be proven against both; proximity-derived Facility groups
    // alone do not establish that separate lifts are one device.
    const adjacent = [
      previous && { step: previous, connects: previous.evidence.toNodeId === connector.evidence.fromNodeId },
      next && { step: next, connects: connector.evidence.toNodeId === next.evidence.fromNodeId },
    ].filter((entry): entry is { step: IndoorRouteStep; connects: boolean } => Boolean(entry))
    if (adjacent.some(({ step, connects }) => verticalMovementTypes.has(step.type) && (step.type !== 'elevator' || !connects))) return false
    const elevatorNeighbors = adjacent.filter(({ step }) => step.type === 'elevator')
    if (!elevatorNeighbors.length || elevatorNeighbors.some(({ connects }) => !connects)) return false
    // A neighboring EV edge with known equal endpoint levels is another
    // connector, not the vertical flight that gives this boundary its scope.
    // Missing levels may still describe a vertical edge, but never contribute
    // direction evidence; the group merge below will therefore remain unknown.
    const possibleVerticalNeighbors = elevatorNeighbors.filter(({ step }) =>
      step.evidence.fromLevelIndex === undefined
      || step.evidence.toLevelIndex === undefined
      || step.evidence.fromLevelIndex !== step.evidence.toLevelIndex,
    )
    if (!possibleVerticalNeighbors.length) return false

    const connectorFacilityId = context?.byPathwayId[connector.evidence.edgeIds[0]]?.facilityId
    if (!connectorFacilityId) return false
    for (const { step } of elevatorNeighbors) {
      const movementLocation = context?.byPathwayId[step.evidence.edgeIds[0]]
      if (!step.evidence.mapLocations?.length || movementLocation?.facilityId !== connectorFacilityId) return false
    }
    const nonBranching = context?.nonBranchingNodeIds
    return Boolean(nonBranching?.has(connector.evidence.fromNodeId) && nonBranching.has(connector.evidence.toNodeId))
  }
  const routeSteps = rawSteps.map((step, index) => {
    const verifiedSameLevelElevatorConnector = isNeutralEquipmentConnector(step, rawSteps[index - 1], rawSteps[index + 1])
    return verifiedSameLevelElevatorConnector ? { ...step, verticalDirectionEvidence: 'neutral-connector' as const } : step
  })
  const merge = (target: IndoorRouteStep, source: IndoorRouteStep) => {
    target.distanceMeters += source.distanceMeters
    // Verified neutral connectors do not establish direction. Every actual
    // vertical edge must have complete evidence and agree with the whole group.
    if (verticalMovementTypes.has(source.type)) {
      const targetNeutral = target.verticalDirectionEvidence === 'neutral-connector'
      const sourceNeutral = source.verticalDirectionEvidence === 'neutral-connector'
      const complete = (targetNeutral || target.verticalDirectionEvidence === 'complete')
        && (sourceNeutral || source.verticalDirectionEvidence === 'complete')
        && (targetNeutral || sourceNeutral || target.verticalDirection === source.verticalDirection)
      const direction = targetNeutral ? source.verticalDirection : target.verticalDirection
      target.verticalDirectionEvidence = complete
        ? targetNeutral && sourceNeutral ? 'neutral-connector' : 'complete'
        : 'incomplete'
      target.verticalDirection = complete && !targetNeutral ? target.verticalDirection : complete ? direction : undefined
    }
    target.evidence = { edgeIds: [...target.evidence.edgeIds, ...source.evidence.edgeIds], fromNodeId: target.evidence.fromNodeId, toNodeId: source.evidence.toNodeId, fromLevelIndex: target.evidence.fromLevelIndex, toLevelIndex: source.evidence.toLevelIndex, mapLocations: [...(target.evidence.mapLocations ?? []), ...(source.evidence.mapLocations ?? [])] }
  }
  const location = (step: IndoorRouteStep) => context?.byPathwayId[step.evidence.edgeIds[0]] ?? step.evidence.mapLocations?.find(location => location.pathwayId === step.evidence.edgeIds[0])
  const nodeById = new Map(route.nodes.map(node => [node.id, node]))
  const bridgeAngle = (prior: IndoorRouteStep, bridge: IndoorRouteStep[], current: IndoorRouteStep) => {
    const firstWalk = bridge[0], lastWalk = bridge.at(-1)
    const before = nodeById.get(prior.evidence.toNodeId)
    const middle = lastWalk ? nodeById.get(lastWalk.evidence.toNodeId) : undefined
    const after = nodeById.get(current.evidence.toNodeId)
    if (!before || !middle || !after) return undefined
    const incoming = localVector(before, nodeById.get(firstWalk.evidence.toNodeId) ?? before)
    const outgoing = localVector(middle, after)
    const incomingLength = Math.hypot(incoming.x, incoming.y), outgoingLength = Math.hypot(outgoing.x, outgoing.y)
    if (!incomingLength || !outgoingLength) return undefined
    return Math.abs((Math.atan2(incoming.x * outgoing.y - incoming.y * outgoing.x, incoming.x * outgoing.x + incoming.y * outgoing.y) * 180) / Math.PI)
  }
  const isSameVerifiedFacility = (left: IndoorRouteStep, right: IndoorRouteStep) => {
    const leftLocation = location(left), rightLocation = location(right)
    return Boolean(
      (leftLocation?.facilityGroupId && leftLocation.facilityGroupId === rightLocation?.facilityGroupId)
      || (leftLocation?.facilityId && leftLocation.facilityId === rightLocation?.facilityId),
    )
  }
  const canBridgeWalkway = (steps: IndoorRouteStep[], current: IndoorRouteStep) => {
    if (current.type === 'walk' || current.type === 'fare-gate' || current.type === 'exit-gate') return false
    let priorIndex = steps.length - 1
    while (priorIndex >= 0 && steps[priorIndex].type === 'walk') priorIndex -= 1
    const prior = steps[priorIndex]
    const bridge = steps.slice(priorIndex + 1)
    if (!prior || !bridge.length || prior.type !== current.type) return false
    const decisionFreeStairBridge = context?.allowDecisionFreeStairBridges === true
      && prior.type === 'stairs'
      && current.type === 'stairs'
      && new Set([prior.verticalDirection, current.verticalDirection].filter((direction): direction is 'up' | 'down' => direction !== undefined)).size <= 1
      && bridge.every(step => step.type === 'walk')
    const bridgeSpace = location(bridge[0])?.spaceId
    const sameSpace = Boolean(bridgeSpace && bridge.every(step => location(step)?.spaceId === bridgeSpace) && location(prior)?.spaceId === bridgeSpace && location(current)?.spaceId === bridgeSpace)
    const nonBranchingNodeIds = context?.nonBranchingNodeIds
    const bridgeDistance = bridge.reduce((sum, step) => sum + step.distanceMeters, 0)
    const noMeaningfulBranch = bridge.every(step => nonBranchingNodeIds?.has(step.evidence.fromNodeId) && nonBranchingNodeIds.has(step.evidence.toNodeId))
    // A different facility is acceptable only when the published map proves a
    // single Space, or when an explicit map-context proof (Roppongi's
    // walking-network-backed case) opts into the cross-facility rule.
    const sameSpaceStairBridge = sameSpace && prior.type === 'stairs' && current.type === 'stairs'
    if (!isSameVerifiedFacility(prior, current) && !sameSpaceStairBridge && !decisionFreeStairBridge) return false
    const angle = bridgeAngle(prior, bridge, current)
    if (angle === undefined) return false
    const decisionFreeStairTurn = context?.allowDecisionFreeStairTurns === true
      && prior.type === 'stairs'
      && current.type === 'stairs'
      && sameSpace
      && bridgeDistance <= SHORT_CONNECTOR_WALKWAY_MAX_METERS
      && noMeaningfulBranch
    const stairLandingAngle = (context?.allowExtendedSameFacilityStairLandings === true && prior.type === 'stairs' && current.type === 'stairs' && isSameVerifiedFacility(prior, current)) || decisionFreeStairTurn
      ? SAME_FACILITY_STAIR_LANDING_MAX_ANGLE_DEGREES
      : DECISION_FREE_BRIDGE_MAX_ANGLE_DEGREES
    if (angle > stairLandingAngle) return false
    const shortNoBranch = bridgeDistance <= SHORT_CONNECTOR_WALKWAY_MAX_METERS && noMeaningfulBranch
    const sameFacilityLanding = context?.allowExtendedSameFacilityStairLandings === true
      && isSameVerifiedFacility(prior, current)
      && prior.type === 'stairs'
      && current.type === 'stairs'
      && bridgeDistance <= SAME_FACILITY_STAIR_LANDING_MAX_METERS
      && noMeaningfulBranch
    return sameSpace || shortNoBranch || sameFacilityLanding
  }
  const compacted = routeSteps.reduce<IndoorRouteStep[]>((steps, step) => {
    const previous = steps.at(-1)
    const isContinuousWalk = previous?.type === 'walk' && step.type === 'walk' && previous.evidence.toNodeId === step.evidence.fromNodeId
    const isContinuousVerifiedFacility = previous && previous.type === step.type && previous.type !== 'fare-gate' && previous.type !== 'exit-gate' && previous.evidence.toNodeId === step.evidence.fromNodeId && isSameVerifiedFacility(previous, step)
    if (isContinuousWalk || isContinuousVerifiedFacility) { merge(previous!, step); return steps }
    if (canBridgeWalkway(steps, step)) {
      let priorIndex = steps.length - 1
      while (priorIndex >= 0 && steps[priorIndex].type === 'walk') priorIndex -= 1
      const prior = steps[priorIndex]
      const bridge = steps.splice(priorIndex + 1)
      bridge.forEach(walk => merge(prior, walk))
      merge(prior, step)
      return steps
    }
    steps.push(step)
    return steps
  }, [])

  // A same-level elevator connector is absorbed only inside a mapped continuous
  // equipment group. Distance alone never establishes equipment identity.
  const absorbSameLevelElevatorConnector = (steps: IndoorRouteStep[]) => {
    const result: IndoorRouteStep[] = []
    const appendEvidence = (target: IndoorRouteStep, source: IndoorRouteStep, fromTarget: boolean) => {
      target.distanceMeters += source.distanceMeters
      target.evidence = {
        edgeIds: fromTarget ? [...source.evidence.edgeIds, ...target.evidence.edgeIds] : [...target.evidence.edgeIds, ...source.evidence.edgeIds],
        fromNodeId: fromTarget ? source.evidence.fromNodeId : target.evidence.fromNodeId,
        toNodeId: fromTarget ? target.evidence.toNodeId : source.evidence.toNodeId,
        fromLevelIndex: fromTarget ? source.evidence.fromLevelIndex : target.evidence.fromLevelIndex,
        toLevelIndex: fromTarget ? target.evidence.toLevelIndex : source.evidence.toLevelIndex,
        mapLocations: fromTarget ? [...(source.evidence.mapLocations ?? []), ...(target.evidence.mapLocations ?? [])] : [...(target.evidence.mapLocations ?? []), ...(source.evidence.mapLocations ?? [])],
      }
    }
    const isSafeConnector = (connector: IndoorRouteStep, movement: IndoorRouteStep) => {
      if (connector.type !== 'elevator' || movement.type !== 'elevator') return false
      if (connector.verticalDirectionEvidence !== 'neutral-connector') return false
      if (connector.verticalDirection !== undefined || movement.verticalDirection === undefined) return false
      if (connector.evidence.fromLevelIndex === undefined || connector.evidence.fromLevelIndex !== connector.evidence.toLevelIndex) return false
      if (connector.evidence.toNodeId !== movement.evidence.fromNodeId) return false
      if (!context?.nonBranchingNodeIds?.has(connector.evidence.toNodeId)) return false
      if (!hasSameMappedElevatorGroup(connector, movement)) return false
      // Require published map evidence for both links. This absorbs only a
      // connector already proven neutral between vertical actions above.
      if (!connector.evidence.mapLocations?.length || !movement.evidence.mapLocations?.length) return false
      return true
    }
    steps.forEach(step => {
      const previous = result.at(-1)
      if (previous && isSafeConnector(previous, step)) {
        appendEvidence(step, previous, true)
        result[result.length - 1] = step
        return
      }
      if (previous && isSafeConnector(step, previous)) {
        appendEvidence(previous, step, false)
        return
      }
      result.push(step)
    })
    return result
  }
  return absorbSameLevelElevatorConnector(compacted)
}

const facilityForStep = (type: IndoorRouteStep['type']): GuideStep['facility'] | undefined => ({ stairs: 'stairs', escalator: 'escalator', elevator: 'elevator', 'fare-gate': 'gate', 'exit-gate': 'exit' } as Partial<Record<IndoorRouteStep['type'], GuideStep['facility']>>)[type]

function localVector(from: IndoorNode, to: IndoorNode) {
  const latitudeRadians = (from.latitude * Math.PI) / 180
  const metersPerDegree = 111_320
  return {
    x: (to.longitude - from.longitude) * Math.cos(latitudeRadians) * metersPerDegree,
    y: (to.latitude - from.latitude) * metersPerDegree,
  }
}

/**
 * Finds only geometry-backed turns at plausible decision points. It deliberately
 * returns provenance even when a decision is omitted, so a UI/debugger can show
 * why a tempting but unsafe direction label was not printed.
 */
export function deriveIndoorDirections(graph: IndoorGraph, route: IndoorRoute, context?: IndoorRouteCompressionContext) {
  const decisions = new Map<string, IndoorDirectionDecision>()
  for (let index = 1; index < route.edges.length; index += 1) {
    const previousEdge = route.edges[index - 1]
    const nextEdge = route.edges[index]
    const previous = graph.nodes.get(previousEdge.fromNodeId)
    const current = graph.nodes.get(previousEdge.toNodeId)
    const next = graph.nodes.get(nextEdge.toNodeId)
    if (!previous || !current || !next) continue
    const base = { edgeId: nextEdge.id, previousNodeId: previous.id, currentNodeId: current.id, nextNodeId: next.id, angleDegrees: 0 }
    const reject = (reason: string, angleDegrees = 0) => decisions.set(nextEdge.id, { ...base, angleDegrees, reason })
    if (previousEdge.movementType !== 'walk' || nextEdge.movementType !== 'walk') { reject('non-walk transition'); continue }
    if (previousEdge.lengthMeters < INDOOR_DIRECTION_THRESHOLDS.minSegmentLengthMeters || nextEdge.lengthMeters < INDOOR_DIRECTION_THRESHOLDS.minSegmentLengthMeters) { reject('segment too short'); continue }
    const previousLocation = context?.byPathwayId[previousEdge.id]
    const nextLocation = context?.byPathwayId[nextEdge.id]
    if (previousLocation?.facilityId && previousLocation.facilityId === nextLocation?.facilityId) { reject('same facility'); continue }
    if (previousLocation?.spaceId && previousLocation.spaceId === nextLocation?.spaceId) { reject('same space'); continue }
    const alternatives = (graph.adjacency.get(current.id) ?? []).filter(edge => edge.id !== previousEdge.id)
    if (alternatives.length < 2) { reject('no graph branch'); continue }
    const incoming = localVector(previous, current)
    const outgoing = localVector(current, next)
    const incomingLength = Math.hypot(incoming.x, incoming.y)
    const outgoingLength = Math.hypot(outgoing.x, outgoing.y)
    if (incomingLength < INDOOR_DIRECTION_THRESHOLDS.minSegmentLengthMeters || outgoingLength < INDOOR_DIRECTION_THRESHOLDS.minSegmentLengthMeters) { reject('coordinate segment too short'); continue }
    const cross = incoming.x * outgoing.y - incoming.y * outgoing.x
    const dot = incoming.x * outgoing.x + incoming.y * outgoing.y
    const angleDegrees = (Math.atan2(cross, dot) * 180) / Math.PI
    const magnitude = Math.abs(angleDegrees)
    if (magnitude >= INDOOR_DIRECTION_THRESHOLDS.uTurnMinAngleDegrees) { reject('u-turn omitted', angleDegrees); continue }
    if (magnitude <= INDOOR_DIRECTION_THRESHOLDS.straightMaxAngleDegrees) { decisions.set(nextEdge.id, { ...base, angleDegrees, result: 'straight', reason: 'clear branch and straight geometry' }); continue }
    if (magnitude >= INDOOR_DIRECTION_THRESHOLDS.turnMinAngleDegrees && magnitude <= INDOOR_DIRECTION_THRESHOLDS.turnMaxAngleDegrees) { decisions.set(nextEdge.id, { ...base, angleDegrees, result: angleDegrees > 0 ? 'left' : 'right', reason: 'clear branch and turn geometry' }); continue }
    reject('angle in safety margin', angleDegrees)
  }
  return decisions
}

const directionInstruction: Record<NonNullable<IndoorDirectionDecision['result']>, string> = { left: '左へ進む', right: '右へ進む', straight: 'まっすぐ進む' }

export function routeTopologyContext(graph: IndoorGraph, route: IndoorRoute, context?: IndoorRouteCompressionContext): IndoorRouteCompressionContext {
  const nonBranchingNodeIds = new Set(route.nodes.filter(node => (graph.adjacency.get(node.id)?.length ?? 0) <= 2).map(node => node.id))
  // A published station-map context opts into the generic audited rule. The
  // rule itself still enforces length, topology, direction, and event guards.
  return { byPathwayId: context?.byPathwayId ?? {}, officialFloorsByLevelIndex: context?.officialFloorsByLevelIndex, nonBranchingNodeIds, allowDecisionFreeStairBridges: context?.allowDecisionFreeStairBridges, allowDecisionFreeStairTurns: context?.allowDecisionFreeStairTurns, allowExtendedSameFacilityStairLandings: context?.allowExtendedSameFacilityStairLandings, allowSemanticConsensusVerticalRestoration: context?.allowSemanticConsensusVerticalRestoration }
}

/**
 * Restores only vertical semantic actions that every boarding-area candidate
 * performs before the common suffix.  Edge IDs may differ; the proof is the
 * identical movement type/direction/level transition sequence.  This is
 * deliberately opt-in because the common-suffix guide remains the safe
 * default when the source topology contains choices.
 */
function semanticConsensusVerticalPrefix(graph: IndoorGraph, candidates: Array<{ route: IndoorRoute }>, commonLength: number, context?: IndoorRouteCompressionContext): GuideStep[] {
  if (!context?.allowSemanticConsensusVerticalRestoration || !candidates.length) return []
  const verticalTypes = new Set<IndoorRouteStep['type']>(['stairs', 'escalator', 'elevator'])
  const semantic = candidates.map(candidate => {
    const prefixEdges = candidate.route.edges.slice(0, Math.max(0, candidate.route.edges.length - commonLength))
    if (!prefixEdges.length) return [] as IndoorRouteStep[]
    const prefix: IndoorRoute = { edges: prefixEdges, nodes: [graph.nodes.get(prefixEdges[0].fromNodeId)!, ...prefixEdges.map(edge => graph.nodes.get(edge.toNodeId)!)], distanceMeters: prefixEdges.reduce((sum, edge) => sum + edge.lengthMeters, 0) }
    const vertical = compactIndoorRouteSteps(prefix, routeTopologyContext(graph, prefix, context)).filter(step => verticalTypes.has(step.type))
    // Normalize a continuous same-type/same-direction climb across intermediate
    // half-levels. The raw edge provenance remains fully concatenated.
    return vertical.reduce<IndoorRouteStep[]>((steps, step) => {
      const previous = steps.at(-1)
      if (previous && previous.type === step.type && previous.verticalDirection === step.verticalDirection) {
        const complete = previous.verticalDirectionEvidence === 'complete' && step.verticalDirectionEvidence === 'complete'
        previous.verticalDirectionEvidence = complete ? 'complete' : 'incomplete'
        if (!complete) previous.verticalDirection = undefined
        previous.distanceMeters += step.distanceMeters
        previous.evidence.edgeIds.push(...step.evidence.edgeIds)
        previous.evidence.toNodeId = step.evidence.toNodeId
        previous.evidence.toLevelIndex = step.evidence.toLevelIndex
        previous.evidence.mapLocations = [...(previous.evidence.mapLocations ?? []), ...(step.evidence.mapLocations ?? [])]
        return steps
      }
      steps.push({ ...step, evidence: { ...step.evidence, edgeIds: [...step.evidence.edgeIds], mapLocations: step.evidence.mapLocations ? [...step.evidence.mapLocations] : undefined } })
      return steps
    }, [])
  })
  if (!semantic.every(steps => steps.length > 0)) return []
  const signature = (step: IndoorRouteStep) => `${step.type}:${step.verticalDirection ?? 'unknown'}:${step.evidence.fromLevelIndex ?? '?'}>${step.evidence.toLevelIndex ?? '?'}`
  const signatures = semantic.map(steps => steps.map(signature).join('|'))
  if (!signatures.every(value => value === signatures[0])) return []
  return semantic[0].map((step, index) => ({
    id: `gtfs-consensus-vertical-${index + 1}`,
    instruction: formatIndoorStep(step),
    facility: facilityForStep(step.type),
    evidence: {
      source: 'gtfs-pathways' as const,
      sourceUrl: graph.source.url,
      edgeIds: [...new Set(semantic.flatMap(steps => steps[index]?.evidence.edgeIds ?? []))],
      fromNodeId: step.evidence.fromNodeId,
      toNodeId: step.evidence.toNodeId,
      fromLevelIndex: step.evidence.fromLevelIndex,
      toLevelIndex: step.evidence.toLevelIndex,
      distanceMeters: step.distanceMeters,
      candidateCoverage: { matchingOrigins: candidates.length, totalOrigins: candidates.length, allRoutesHaveEvent: true },
      mapLocations: semantic.flatMap(steps => steps[index]?.evidence.mapLocations ?? []),
    },
  }))
}

/**
 * Produces a printable guide only from a route with a valid reviewed anchor and reviewed labels.
 * It does not invent station names, gate names, landmarks, or turn directions.
 */
export function buildVerifiedStationGuide(graph: IndoorGraph, station: StationRef, anchor: VerifiedIndoorRouteAnchor, details: VerifiedStationGuideDetails, preference: RoutePreference = 'shortest'): StationGuideBuildResult {
  if (![details.arrivalPlatformLabel, details.gateLabel, details.exitLabel, details.safeAlternative].every(value => value.trim().length > 0)) return { ok: false, reason: 'invalid-guide-details' }
  const resolved = resolveVerifiedIndoorRoute(graph, anchor, preference)
  if (!resolved.ok) return resolved
  const steps: GuideStep[] = compactIndoorRouteSteps(resolved.route, routeTopologyContext(graph, resolved.route)).map((step, index) => ({ id: `route-${index + 1}`, instruction: formatIndoorStep(step), facility: facilityForStep(step.type), evidence: { source: 'gtfs-pathways', sourceUrl: anchor.evidenceUrl, edgeIds: step.evidence.edgeIds, fromNodeId: step.evidence.fromNodeId, toNodeId: step.evidence.toNodeId, fromLevelIndex: step.evidence.fromLevelIndex, toLevelIndex: step.evidence.toLevelIndex, distanceMeters: step.distanceMeters, mapLocations: step.evidence.mapLocations } }))
  steps.push({ id: 'reviewed-exit', instruction: `${details.exitLabel}へ進む。`, facility: 'exit', evidence: { source: 'manual-review', sourceUrl: anchor.evidenceUrl } })
  return {
    ok: true,
    guide: {
      id: `verified-indoor-${anchor.stationId}-${anchor.boardingAreaId}-${anchor.exitNodeId}`,
      station, arrivalPlatform: details.arrivalPlatformLabel, gate: details.gateLabel, exit: details.exitLabel,
      steps, officialSourceUrl: anchor.evidenceUrl, verifiedAt: anchor.verifiedAt, confidence: 'verified', verifiedBy: anchor.verifiedBy, safeAlternative: details.safeAlternative,
      dataSource: { type: 'gtfs-pathways', feedVersion: graph.source.feedVersion, retrievedAt: graph.source.retrievedAt, humanReviewed: true, scope: 'reviewed-exact-origin' }
    }
  }
}

/**
 * Builds only the GTFS-factual part of an indoor guide. It keeps the identical
 * route suffix and also retains fare-gate events observed before that suffix.
 * The latter are factual but may not apply to every precise boarding area, so
 * their candidate coverage is preserved as provenance rather than guessed away.
 */
export function buildGtfsStationGuide(graph: IndoorGraph, station: StationRef, target: { platformId: string; exitNodeId: string | string[] }, preference: RoutePreference = 'shortest', compressionContext?: IndoorRouteCompressionContext): GtfsStationGuideBuildResult {
  if (station.id !== graph.stationId) return { ok: false, reason: 'station-mismatch' }
  const platform = graph.nodes.get(target.platformId)
  if (platform?.kind !== 'platform') return { ok: false, reason: 'no-platform-origins' }
  const exitCandidates = (Array.isArray(target.exitNodeId) ? target.exitNodeId : [target.exitNodeId])
    .map(id => ({ id, node: graph.nodes.get(id) }))
    .filter((item): item is { id: string; node: IndoorNode } => item.node?.kind === 'entrance-exit')
  const selected = exitCandidates
    .map(item => ({ ...item, routes: findRoutesFromPlatform(graph, target.platformId, item.id, preference) }))
    .filter(item => item.routes.length > 0)
    .sort((a, b) => Math.min(...a.routes.map(route => route.route.distanceMeters)) - Math.min(...b.routes.map(route => route.route.distanceMeters)))[0]
  if (!selected) return { ok: false, reason: 'no-platform-origins' }
  const exitNodeId = selected.id
  const exit = selected.node
  if (exit?.kind !== 'entrance-exit') return { ok: false, reason: 'target-is-not-exit' }
  const candidates = selected.routes
  if (!candidates.length) return { ok: false, reason: 'no-platform-origins' }
  const commonEdges = commonRouteSuffix(candidates.map(candidate => candidate.route))
  if (!commonEdges.length) return { ok: false, reason: 'no-common-route' }
  const route: IndoorRoute = { edges: commonEdges, nodes: [graph.nodes.get(commonEdges[0].fromNodeId)!, ...commonEdges.map(edge => graph.nodes.get(edge.toNodeId)!)], distanceMeters: commonEdges.reduce((sum, edge) => sum + edge.lengthMeters, 0) }
  const commonIds = new Set(commonEdges.map(edge => edge.id))
  const fareGateCounts = candidates.map(candidate => candidate.route.edges.filter(edge => edge.movementType === 'fare-gate').length)
  const allRoutesHaveFareGate = fareGateCounts.every(count => count > 0)
  const aggregateFareGateCount = fareGateCounts.every(count => count === fareGateCounts[0]) ? fareGateCounts[0] : undefined
  // Candidate routes may use different physical fare-gate edges while each
  // still represents the same semantic gate crossing. Group by ordinal within
  // each candidate rather than by edge ID, so alternatives are not rendered as
  // sequential gates. All original edge IDs remain in provenance.
  const fareEvents = new Map<number, { edges: IndoorEdge[]; matchingOrigins: number; firstPosition: number }>()
  candidates.forEach(candidate => {
    candidate.route.edges.forEach((edge, position) => {
      if (edge.movementType !== 'fare-gate' || commonIds.has(edge.id)) return
      const ordinal = candidate.route.edges.slice(0, position + 1).filter(item => item.movementType === 'fare-gate' && !commonIds.has(item.id)).length - 1
      const current = fareEvents.get(ordinal)
      if (current) {
        current.edges.push(edge)
        current.matchingOrigins += 1
      } else {
        fareEvents.set(ordinal, { edges: [edge], matchingOrigins: 1, firstPosition: position })
      }
    })
  })
  const semanticPrefix: GuideStep[] = [...fareEvents.entries()]
    .sort(([leftOrdinal, left], [rightOrdinal, right]) => leftOrdinal - rightOrdinal || left.firstPosition - right.firstPosition)
    .map(([_, event], index) => {
      const eventFloors = event.edges
        .map(edge => officialGateFloor(graph, edge, compressionContext))
        .filter((floor): floor is NonNullable<ReturnType<typeof officialGateFloor>> => Boolean(floor))
      const officialFloor = event.matchingOrigins === candidates.length && eventFloors.length === event.edges.length && new Set(eventFloors.map(floor => `${floor.levelIndex}:${floor.label}`)).size === 1
        ? eventFloors[0]
        : undefined
      return {
        id: `gtfs-event-gate-${index + 1}`,
        instruction: officialFloor ? `${officialFloor.label}の改札を通る` : '改札を通る', facility: 'gate' as const,
        evidence: { source: 'gtfs-pathways' as const, sourceUrl: graph.source.url, edgeIds: [...new Set(event.edges.map(edge => edge.id))], fromNodeId: event.edges[0]?.fromNodeId, toNodeId: event.edges[0]?.toNodeId, candidateCoverage: { matchingOrigins: event.matchingOrigins, totalOrigins: candidates.length, allRoutesHaveEvent: allRoutesHaveFareGate, aggregateCount: aggregateFareGateCount }, officialFloor }
      }
    })
  const tailSteps: GuideStep[] = compactIndoorRouteSteps(route, routeTopologyContext(graph, route, compressionContext)).map((step, index) => {
    const facility = facilityForStep(step.type)
    const officialFloor = facility === 'gate'
      ? officialGateFloor(graph, step.evidence.edgeIds.map(edgeId => route.edges.find(edge => edge.id === edgeId)).find(Boolean), compressionContext)
      : undefined
    return {
      id: `gtfs-common-${index + 1}`,
      instruction: officialFloor ? `${officialFloor.label}の改札を通る` : formatIndoorStep(step),
      facility,
      evidence: {
        source: 'gtfs-pathways' as const,
        sourceUrl: graph.source.url,
        edgeIds: step.evidence.edgeIds,
        fromNodeId: step.evidence.fromNodeId,
        toNodeId: step.evidence.toNodeId,
        fromLevelIndex: step.evidence.fromLevelIndex,
        toLevelIndex: step.evidence.toLevelIndex,
        distanceMeters: step.distanceMeters,
        candidateCoverage: { matchingOrigins: candidates.length, totalOrigins: candidates.length },
        mapLocations: step.evidence.mapLocations,
        officialFloor,
      },
    }
  })
  const consensusVerticalSteps = semanticConsensusVerticalPrefix(graph, candidates, commonEdges.length, compressionContext)
  const directions = deriveIndoorDirections(graph, route, compressionContext)
  tailSteps.forEach(step => {
    if (step.facility || step.evidence?.source !== 'gtfs-pathways') return
    const decision = step.evidence.edgeIds?.map(edgeId => directions.get(edgeId)).find(Boolean)
    if (!decision?.result) return
    step.instruction = directionInstruction[decision.result]
    step.evidence.direction = { previousNodeId: decision.previousNodeId, currentNodeId: decision.currentNodeId, nextNodeId: decision.nextNodeId, angleDegrees: decision.angleDegrees, result: decision.result, reason: decision.reason }
  })
  const platformLabel = platform.platformCode ? `${platform.platformCode}番ホーム` : ''
  const exitLabel = exit.name ?? ''
  const exitStep: GuideStep[] = exitLabel ? [{ id: 'gtfs-exit', instruction: `${exitLabel}へ出る`, facility: 'exit', evidence: { source: 'gtfs-pathways', sourceUrl: graph.source.url, edgeIds: commonEdges.at(-1) ? [commonEdges.at(-1)!.id] : [], fromNodeId: commonEdges.at(-1)?.fromNodeId, toNodeId: exitNodeId, candidateCoverage: { matchingOrigins: candidates.length, totalOrigins: candidates.length } } }] : []
  return { ok: true, guide: { id: `gtfs-common-${graph.stationId}-${target.platformId}-${exitNodeId}`, station, arrivalPlatform: platformLabel, gate: '', exit: exitLabel, steps: [...consensusVerticalSteps, ...semanticPrefix, ...tailSteps, ...exitStep], officialSourceUrl: graph.source.url, verifiedAt: graph.source.retrievedAt, confidence: 'needs-review', safeAlternative: '迷ったら、案内表示を確認するか、駅係員にこの紙を見せて聞いてください。', dataSource: { type: 'gtfs-pathways', feedVersion: graph.source.feedVersion, retrievedAt: graph.source.retrievedAt, humanReviewed: false, scope: 'semantic-event-backbone' } } }
}

/** Builds a paper guide from one explicitly scored GTFS candidate route. */
export function buildGtfsStationGuideFromRoute(graph: IndoorGraph, station: StationRef, target: { platformId: string; exitNodeId: string }, route: IndoorRoute, compressionContext?: IndoorRouteCompressionContext): GtfsStationGuideBuildResult {
  if (station.id !== graph.stationId) return { ok: false, reason: 'station-mismatch' }
  const platform = graph.nodes.get(target.platformId)
  const exit = graph.nodes.get(target.exitNodeId)
  if (platform?.kind !== 'platform') return { ok: false, reason: 'no-platform-origins' }
  if (exit?.kind !== 'entrance-exit') return { ok: false, reason: 'target-is-not-exit' }
  const routeSteps = compactIndoorRouteSteps(route, routeTopologyContext(graph, route, compressionContext))
  const fareEvents = route.edges.filter(edge => edge.movementType === 'fare-gate')
  const steps: GuideStep[] = routeSteps.map((step, index) => {
    const facility = facilityForStep(step.type)
    const fareCount = step.type === 'fare-gate' || step.type === 'exit-gate' ? fareEvents.length : undefined
    const officialFloor = facility === 'gate' ? officialGateFloor(graph, step.evidence.edgeIds.map(edgeId => route.edges.find(edge => edge.id === edgeId)).find(Boolean), compressionContext) : undefined
    return { id: `gtfs-scored-${index + 1}`, instruction: officialFloor ? `${officialFloor.label}の改札を通る` : formatIndoorStep(step), facility, evidence: { source: 'gtfs-pathways', sourceUrl: graph.source.url, edgeIds: step.evidence.edgeIds, fromNodeId: step.evidence.fromNodeId, toNodeId: step.evidence.toNodeId, fromLevelIndex: step.evidence.fromLevelIndex, toLevelIndex: step.evidence.toLevelIndex, distanceMeters: step.distanceMeters, candidateCoverage: fareCount === undefined ? { matchingOrigins: 1, totalOrigins: 1 } : { matchingOrigins: 1, totalOrigins: 1, allRoutesHaveEvent: true, aggregateCount: fareCount }, mapLocations: step.evidence.mapLocations, officialFloor } }
  })
  const exitLabel = exit.name ?? ''
  if (exitLabel) steps.push({ id: 'gtfs-scored-exit', instruction: `${exitLabel}へ出る`, facility: 'exit', evidence: { source: 'gtfs-pathways', sourceUrl: graph.source.url, edgeIds: route.edges.at(-1) ? [route.edges.at(-1)!.id] : [], fromNodeId: route.edges.at(-1)?.fromNodeId, toNodeId: target.exitNodeId, candidateCoverage: { matchingOrigins: 1, totalOrigins: 1 } } })
  return { ok: true, guide: { id: `gtfs-scored-${graph.stationId}-${target.platformId}-${target.exitNodeId}`, station, arrivalPlatform: platform.platformCode ? `${platform.platformCode}番ホーム` : '', gate: '', exit: exitLabel, steps, officialSourceUrl: graph.source.url, verifiedAt: graph.source.retrievedAt, confidence: 'needs-review', safeAlternative: '迷ったら、案内表示を確認するか、駅係員にこの紙を見せて聞いてください。', dataSource: { type: 'gtfs-pathways', feedVersion: graph.source.feedVersion, retrievedAt: graph.source.retrievedAt, humanReviewed: false, scope: 'semantic-event-backbone' } } }
}

export const WALK_DISTANCE_DISPLAY_THRESHOLD_METERS = 10
export const WALK_STRIDE_METERS = 0.6

export interface IndoorInstructionOptions {
  includeWalkDistance?: boolean
  walkDistanceThresholdMeters?: number
  strideMeters?: number
}

function roundedWalkSteps(distanceMeters: number, strideMeters: number) {
  return Math.max(10, Math.ceil((distanceMeters / strideMeters) / 10) * 10)
}

export function formatIndoorStep(step: IndoorRouteStep, options: IndoorInstructionOptions = {}) {
  const vertical = step.verticalDirection === 'up' ? '上がる' : step.verticalDirection === 'down' ? '下りる' : undefined
  const labels: Record<IndoorRouteStep['type'], string> = { walk: '通路を進む', stairs: vertical ? `階段を${vertical}` : '階段を使う', 'moving-walkway': '動く歩道を利用する', escalator: vertical ? `エスカレーターで${vertical}` : 'エスカレーターを使う', elevator: vertical ? `エレベーターで${vertical}` : 'エレベーターで移動する', 'fare-gate': '改札を通る', 'exit-gate': '改札を通る', slope: 'スロープを進む', 'rail-crossing': '踏切を通る', unknown: '種別不明の通路を進む' }
  if (step.type === 'walk' && options.includeWalkDistance && step.distanceMeters >= (options.walkDistanceThresholdMeters ?? WALK_DISTANCE_DISPLAY_THRESHOLD_METERS)) {
    const roundedMeters = Math.round(step.distanceMeters / 5) * 5
    const strideMeters = options.strideMeters ?? WALK_STRIDE_METERS
    return `通路を約${roundedMeters}m（約${roundedWalkSteps(step.distanceMeters, strideMeters)}歩）進む`
  }
  return labels[step.type]
}
