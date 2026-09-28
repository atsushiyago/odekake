import {
  type IndoorEdge, type IndoorGraph, type IndoorRoute, type IndoorRouteCompressionContext,
  type IndoorMovementType, platformOriginNodes,
} from './indoorRouting'
import { fareGateIdentity } from './routeOrder'
import { computeRouteCost, type RouteCost } from './routeCost'
import {
  MOBILITY_PROFILES, selectBestEvidenceAwareRoute, selectBestRoute, scoreElderlyRoute,
  type MobilityProfile, type MobilityProfileId, type MobilityRouteCandidate,
} from './elderlyRouteScoring'

/** Additive search-time quantities. These are raw traversals, not semantic uses. */
export interface SearchLabelCost {
  totalPathwayMeters: number | null
  rawStairTraversals: number
  rawEscalatorTraversals: number
  rawElevatorTraversals: number
  rawEquipmentTypeChanges: number
  rawFareGateTraversals: number
  decisionPoints: number
}

/** State facts needed so labels with different next-action context never merge. */
export interface MultiObjectiveSearchState {
  currentNodeId: string
  incomingTraversal: string | null
  activeEquipmentSession: string | null
  fareGatePassed: boolean
  fareGateSequence: readonly string[]
  originBoardingAreaId: string
  targetExitId: string
}

export interface MultiObjectiveSearchLimits {
  maxLabelsPerState: number
  maxTotalLabels: number
  maxCompletedCandidates: number
  maxExpansions: number
}

/** Central defaults; callers can tighten them in tests or diagnostics. */
export const DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS: Readonly<MultiObjectiveSearchLimits> = {
  maxLabelsPerState: 96,
  maxTotalLabels: 30000,
  maxCompletedCandidates: 3000,
  maxExpansions: 150000,
}

export interface MultiObjectiveSearchOptions {
  limits?: Partial<MultiObjectiveSearchLimits>
  compressionContext?: IndoorRouteCompressionContext
  /** Opt-in, potentially large diagnostics for tests and route audits only. */
  diagnostics?: boolean
  /** Optional queue-only heuristic for origin-wise shadow search; current ordering remains default. */
  queueOrdering?: 'current' | 'distance-lower-bound'
  /** Opt-in shadow-only choice of selector; production routing remains separate. */
  selectionMode?: 'current' | 'evidence-aware'
}

function selectShadowCandidate(candidates: MobilityRouteCandidate[], profile: MobilityProfile,
  mode: MultiObjectiveSearchOptions['selectionMode']) {
  return (mode === 'evidence-aware' ? selectBestEvidenceAwareRoute : selectBestRoute)(candidates, profile).selected
}

export type SearchDiagnosticEventType = 'admitted' | 'pruned' | 'cycle-rejected' | 'limit-reached'
  | 'invalid-transition' | 'completed'

export interface SearchLabelDiagnostic {
  labelId: number
  event: SearchDiagnosticEventType
  currentNodeId: string
  stateKey: string
  directedTraversalHistory: string[]
  usedDirectedEdges: string[]
  searchLabelCost: SearchLabelCost
  dominatingLabelId?: number
  dominatingSearchLabelCost?: SearchLabelCost
  pruneReason?: 'pareto-dominated' | 'equal-cost-duplicate' | 'dominated-by-new-label'
    | 'repeated-directed-edge' | 'repeated-fare-gate' | 'maxLabelsPerState' | 'maxTotalLabels' | 'maxExpansions'
    | 'maxCompletedCandidates' | 'invalid-transition'
  originBoardingAreaId: string
  targetExit: string
  fareGateState: { passed: boolean; sequence: string[] }
  equipmentSessionState: string | null
  targetSubscriptions?: string[]
  attemptedTraversal?: string
}

export type LegacyRouteReplayStatus = 'valid' | 'dominated' | 'cycle-rejected' | 'limit-reached'
  | 'invalid-transition' | 'completed'

export interface LegacyRouteReplayDiagnostic {
  status: LegacyRouteReplayStatus
  matchedPrefixLength: number
  firstLostTraversal: string | null
  reason: string
  search: MultiObjectiveSearchResult
}

export interface LegacyRouteTraceClassification {
  status: LegacyRouteReplayStatus
  matchedPrefixLength: number
  firstLostTraversal: string | null
  reason: string
}

export interface MultiObjectiveCandidate {
  originBoardingAreaId: string
  targetExitId: string
  route: IndoorRoute
  searchCost: SearchLabelCost
  routeCost: RouteCost
  directedTraversalKey: string
}

export interface MultiObjectiveSearchResult {
  candidates: MultiObjectiveCandidate[]
  frontiers: Record<MobilityProfileId, MultiObjectiveCandidate[]>
  /** Best among completed frontier labels seen; only globally conclusive when complete is true. */
  selectedByProfile: Record<MobilityProfileId, MultiObjectiveCandidate | null>
  exploredLabelCount: number
  prunedLabelCount: number
  expansionCount: number
  complete: boolean
  cutoffReasons: string[]
  /** Omitted unless diagnostics were explicitly requested. */
  diagnosticTrace?: SearchLabelDiagnostic[]
}

interface Label {
  id: number
  state: MultiObjectiveSearchState
  nodePath: string[]
  edgePath: IndoorEdge[]
  visitedTraversals: Set<string>
  cost: SearchLabelCost
  active: boolean
  /** Multi-target-only candidate subscriptions; never mixes boarding origins. */
  targetSubscriptions?: Set<string>
  /** Known distance used only by the optional queue heuristic, never by costs or dominance. */
  knownDistanceLowerBoundMeters?: number
}

const traversalKey = (edge: IndoorEdge) => JSON.stringify([edge.id, edge.fromNodeId, edge.toNodeId])
const gateKey = (edge: IndoorEdge) => fareGateIdentity(edge) ?? JSON.stringify(['unresolved-fare-gate', traversalKey(edge)])
const isEquipment = (type: IndoorMovementType) => type === 'stairs' || type === 'escalator' || type === 'elevator'
const zeroCost = (): SearchLabelCost => ({ totalPathwayMeters: 0, rawStairTraversals: 0, rawEscalatorTraversals: 0,
  rawElevatorTraversals: 0, rawEquipmentTypeChanges: 0, rawFareGateTraversals: 0, decisionPoints: 0 })

function labelStateKey(state: MultiObjectiveSearchState, includeTarget = true) {
  const key = [state.currentNodeId, state.incomingTraversal, state.activeEquipmentSession,
    state.fareGateSequence, state.originBoardingAreaId]
  if (includeTarget) key.push(state.targetExitId)
  return JSON.stringify(key)
}

/** Strict Pareto dominance on additive raw metrics, only within an identical state. */
function dominates(a: SearchLabelCost, b: SearchLabelCost): boolean {
  if (a.totalPathwayMeters === null || b.totalPathwayMeters === null) return false
  const left = [a.totalPathwayMeters, a.rawStairTraversals, a.rawEscalatorTraversals, a.rawElevatorTraversals,
    a.rawEquipmentTypeChanges, a.rawFareGateTraversals, a.decisionPoints]
  const right = [b.totalPathwayMeters, b.rawStairTraversals, b.rawEscalatorTraversals, b.rawElevatorTraversals,
    b.rawEquipmentTypeChanges, b.rawFareGateTraversals, b.decisionPoints]
  return left.every((value, index) => value <= right[index]) && left.some((value, index) => value < right[index])
}

/** A has at least as many future traversal choices as B iff A has consumed no edge B can still use. */
export function isTraversalHistoryAtLeastAsFlexible(usedA: ReadonlySet<string>, usedB: ReadonlySet<string>): boolean {
  for (const traversal of usedA) if (!usedB.has(traversal)) return false
  return true
}

export function dominatesWithTraversalAvailability(costA: SearchLabelCost, usedA: ReadonlySet<string>,
  costB: SearchLabelCost, usedB: ReadonlySet<string>): boolean {
  return isTraversalHistoryAtLeastAsFlexible(usedA, usedB) && dominates(costA, costB)
}

function labelDominates(a: Label, b: Label): boolean {
  return targetCoverageContains(a, b)
    && dominatesWithTraversalAvailability(a.cost, a.visitedTraversals, b.cost, b.visitedTraversals)
}

function targetCoverageContains(a: Label, b: Label): boolean {
  if (!a.targetSubscriptions || !b.targetSubscriptions) return true
  return isTargetCoverageAtLeastAsBroad(a.targetSubscriptions, b.targetSubscriptions)
}

/** A label may dominate only if it can still serve every target the other can. */
export function isTargetCoverageAtLeastAsBroad(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  for (const target of b) if (!a.has(target)) return false
  return true
}

function sameCost(a: SearchLabelCost, b: SearchLabelCost) {
  return a.totalPathwayMeters === b.totalPathwayMeters
    && a.rawStairTraversals === b.rawStairTraversals
    && a.rawEscalatorTraversals === b.rawEscalatorTraversals
    && a.rawElevatorTraversals === b.rawElevatorTraversals
    && a.rawEquipmentTypeChanges === b.rawEquipmentTypeChanges
    && a.rawFareGateTraversals === b.rawFareGateTraversals && a.decisionPoints === b.decisionPoints
}

function stateForEdge(graph: IndoorGraph, previous: Label, edge: IndoorEdge, context?: IndoorRouteCompressionContext): MultiObjectiveSearchState {
  const type = edge.movementType
  const map = context?.byPathwayId[edge.id]
  const previousEdge = previous.edgePath.at(-1)
  const previousMap = previousEdge && context?.byPathwayId[previousEdge.id]
  const directlyContinues = previousEdge?.toNodeId === edge.fromNodeId
  const priorSession = previous.state.activeEquipmentSession ? JSON.parse(previous.state.activeEquipmentSession) as [string, string | null, string] : null
  const facilityIdentity = map?.facilityId ?? null
  let activeEquipmentSession: string | null = null
  if (isEquipment(type)) {
    const continuesExactDevice = directlyContinues && priorSession?.[0] === type && facilityIdentity !== null && priorSession[1] === facilityIdentity
    activeEquipmentSession = JSON.stringify([type, facilityIdentity, continuesExactDevice ? priorSession[2] : traversalKey(edge)])
  } else if (type === 'walk' && directlyContinues && priorSession && facilityIdentity !== null
    && previousMap?.facilityId === facilityIdentity) {
    // Preserve only explicit same-Facility context across a mapped connector;
    // this state annotation is for safe label partitioning, not cost proof.
    activeEquipmentSession = previous.state.activeEquipmentSession
  }
  const gateSequence = type === 'fare-gate' ? [...previous.state.fareGateSequence, gateKey(edge)] : previous.state.fareGateSequence
  return { currentNodeId: edge.toNodeId, incomingTraversal: traversalKey(edge), activeEquipmentSession,
    fareGatePassed: gateSequence.length > 0, fareGateSequence: gateSequence, originBoardingAreaId: previous.state.originBoardingAreaId,
    targetExitId: previous.state.targetExitId }
}

function nextCost(previous: Label, edge: IndoorEdge, sourceDegree: number): SearchLabelCost {
  const validLength = Number.isFinite(edge.lengthMeters) && edge.lengthMeters >= 0
  const prevType = previous.edgePath.at(-1)?.movementType
  return {
    totalPathwayMeters: previous.cost.totalPathwayMeters === null || !validLength
      ? null : previous.cost.totalPathwayMeters + edge.lengthMeters,
    rawStairTraversals: previous.cost.rawStairTraversals + Number(edge.movementType === 'stairs'),
    rawEscalatorTraversals: previous.cost.rawEscalatorTraversals + Number(edge.movementType === 'escalator'),
    rawElevatorTraversals: previous.cost.rawElevatorTraversals + Number(edge.movementType === 'elevator'),
    rawEquipmentTypeChanges: previous.cost.rawEquipmentTypeChanges + Number(isEquipment(prevType ?? 'unknown') && isEquipment(edge.movementType) && prevType !== edge.movementType),
    rawFareGateTraversals: previous.cost.rawFareGateTraversals + Number(edge.movementType === 'fare-gate'),
    // This is the established outgoing-degree proxy, accumulated per departure.
    decisionPoints: previous.cost.decisionPoints + Number(sourceDegree > 2),
  }
}

function pathKey(edges: readonly IndoorEdge[]) { return JSON.stringify(edges.map(edge => [edge.id, edge.fromNodeId, edge.toNodeId])) }
function compareQueueLabels(left: Label, right: Label) {
  const distances = (left.cost.totalPathwayMeters ?? Infinity) - (right.cost.totalPathwayMeters ?? Infinity)
  if (distances) return distances
  const l = [left.cost.rawStairTraversals, left.cost.rawEquipmentTypeChanges, left.cost.decisionPoints,
    left.cost.rawEscalatorTraversals, left.cost.rawElevatorTraversals]
  const r = [right.cost.rawStairTraversals, right.cost.rawEquipmentTypeChanges, right.cost.decisionPoints,
    right.cost.rawEscalatorTraversals, right.cost.rawElevatorTraversals]
  for (let i = 0; i < l.length; i += 1) if (l[i] !== r[i]) return l[i] - r[i]
  const pathOrder = pathKey(left.edgePath).localeCompare(pathKey(right.edgePath))
  if (pathOrder) return pathOrder
  const originOrder = left.state.originBoardingAreaId.localeCompare(right.state.originBoardingAreaId)
  if (originOrder) return originOrder
  return left.state.targetExitId.localeCompare(right.state.targetExitId)
}
function heapPush(heap: Label[], label: Label, compare: (a: Label, b: Label) => number = compareQueueLabels) {
  heap.push(label)
  let index = heap.length - 1
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2)
    if (compare(heap[parent], heap[index]) <= 0) break
    ;[heap[parent], heap[index]] = [heap[index], heap[parent]]
    index = parent
  }
}
function heapPop(heap: Label[], compare: (a: Label, b: Label) => number = compareQueueLabels): Label | undefined {
  if (!heap.length) return undefined
  const first = heap[0], last = heap.pop()!
  if (heap.length) {
    heap[0] = last
    let index = 0
    while (true) {
      const left = index * 2 + 1, right = left + 1
      let smallest = index
      if (left < heap.length && compare(heap[left], heap[smallest]) < 0) smallest = left
      if (right < heap.length && compare(heap[right], heap[smallest]) < 0) smallest = right
      if (smallest === index) break
      ;[heap[index], heap[smallest]] = [heap[smallest], heap[index]]
      index = smallest
    }
  }
  return first
}

// Heuristic-only optimistic distances: unknown or invalid pathway lengths add
// zero here. SearchLabelCost and RouteCost retain their existing semantics.
const reverseDistanceCache = new WeakMap<IndoorGraph, Map<string, ReadonlyMap<string, number>>>()
const reverseAdjacencyCache = new WeakMap<IndoorGraph, Map<string, IndoorEdge[]>>()
function optimisticDistancesToTarget(graph: IndoorGraph, targetId: string): ReadonlyMap<string, number> {
  let graphCache = reverseDistanceCache.get(graph)
  if (!graphCache) { graphCache = new Map(); reverseDistanceCache.set(graph, graphCache) }
  const cached = graphCache.get(targetId)
  if (cached) return cached
  let reverse = reverseAdjacencyCache.get(graph)
  if (!reverse) {
    reverse = new Map()
    for (const edge of graph.edges) {
      const incoming = reverse.get(edge.toNodeId) ?? []
      incoming.push(edge); reverse.set(edge.toNodeId, incoming)
    }
    reverseAdjacencyCache.set(graph, reverse)
  }
  const distances = new Map<string, number>([[targetId, 0]])
  const unsettled = new Set<string>([targetId])
  while (unsettled.size) {
    let nodeId: string | undefined, best = Infinity
    for (const candidate of unsettled) {
      const value = distances.get(candidate) ?? Infinity
      if (value < best || (value === best && (nodeId === undefined || candidate < nodeId))) { best = value; nodeId = candidate }
    }
    if (nodeId === undefined) break
    unsettled.delete(nodeId)
    for (const edge of reverse.get(nodeId) ?? []) {
      const length = Number.isFinite(edge.lengthMeters) && edge.lengthMeters >= 0 ? edge.lengthMeters : 0
      const next = best + length
      if (next < (distances.get(edge.fromNodeId) ?? Infinity)) {
        distances.set(edge.fromNodeId, next); unsettled.add(edge.fromNodeId)
      }
    }
  }
  graphCache.set(targetId, distances)
  return distances
}

function compareNumeric(a: number, b: number) { return a < b ? -1 : a > b ? 1 : 0 }

function routeFromLabel(graph: IndoorGraph, label: Label): IndoorRoute {
  const nodes = label.nodePath.map(id => graph.nodes.get(id)!).filter(Boolean)
  // Do not turn a partially known route length into an apparently complete
  // distance: the downstream profile selector must reject unknown-distance
  // candidates rather than treating missing meters as zero.
  const distanceMeters = label.cost.totalPathwayMeters === null ? Number.NaN : label.cost.totalPathwayMeters
  return { nodes, edges: label.edgePath, distanceMeters }
}

type CostDimension = (cost: RouteCost) => number | null
const commonDimensions: CostDimension[] = [
  cost => cost.stairs.uses,
  cost => cost.unresolvedEquipmentGroups,
  cost => cost.unresolvedEquipmentTransitions,
  cost => cost.decisionPoints,
  cost => cost.walkingMeters,
  cost => cost.totalPathwayMeters,
]

function routeCostDominates(a: RouteCost, b: RouteCost, profile: MobilityProfile): boolean {
  const dimensions: CostDimension[] = [...commonDimensions]
  if (profile.id === 'escalator-preferred') dimensions.push(cost => cost.equipmentBoardings, cost => cost.elevatorUses, cost => cost.escalatorUses === null ? null : -cost.escalatorUses)
  else if (profile.id === 'elevator-preferred') dimensions.push(cost => cost.equipmentBoardings, cost => cost.escalatorUses, cost => cost.elevatorUses === null ? null : -cost.elevatorUses)
  else dimensions.push(cost => cost.equipmentBoardings, cost => cost.escalatorUses, cost => cost.elevatorUses)
  dimensions.push(cost => cost.equipmentTypeChanges, cost => cost.equipmentInstanceTransfers)
  const left = dimensions.map(dimension => dimension(a)), right = dimensions.map(dimension => dimension(b))
  // Unknown on either side means this pair cannot safely establish dominance.
  if (left.some(value => value === null) || right.some(value => value === null)) return false
  const values = left as number[], other = right as number[]
  return values.every((value, index) => value <= other[index]) && values.some((value, index) => value < other[index])
}

function finalFrontier(candidates: MultiObjectiveCandidate[], profile: MobilityProfile): MultiObjectiveCandidate[] {
  return candidates.filter((candidate, index) => !candidates.some((other, otherIndex) => otherIndex !== index
    && routeCostDominates(other.routeCost, candidate.routeCost, profile)))
}

/** Shadow-only label-setting search. Each origin/exit pair is an explicit state domain. */
export function searchMultiObjectiveRoutes(
  graph: IndoorGraph,
  originIds: readonly string[],
  exitIds: readonly string[],
  options: MultiObjectiveSearchOptions = {},
): MultiObjectiveSearchResult {
  const limits = { ...DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS, ...options.limits }
  const allLabels: Label[] = [], completed: Label[] = [], byState = new Map<string, Label[]>()
  const queue: Label[] = [], cutoffReasons = new Set<string>(), diagnosticTrace = options.diagnostics ? [] as SearchLabelDiagnostic[] : undefined
  let nextLabelId = 1
  let prunedLabelCount = 0, expansionCount = 0
  const trace = (label: Label, event: SearchDiagnosticEventType, details: Partial<SearchLabelDiagnostic> = {}) => {
    if (!diagnosticTrace) return
    const history = label.edgePath.map(traversalKey)
    diagnosticTrace.push({ labelId: label.id, event, currentNodeId: label.state.currentNodeId,
      stateKey: labelStateKey(label.state), directedTraversalHistory: history, usedDirectedEdges: [...label.visitedTraversals].sort(),
      searchLabelCost: { ...label.cost }, originBoardingAreaId: label.state.originBoardingAreaId,
      targetExit: label.state.targetExitId,
      fareGateState: { passed: label.state.fareGatePassed, sequence: [...label.state.fareGateSequence] },
      equipmentSessionState: label.state.activeEquipmentSession, ...details })
  }
  const attemptedLabel = (previous: Label, edge: IndoorEdge): Label => {
    const state = stateForEdge(graph, previous, edge, options.compressionContext)
    return { id: nextLabelId++, state, nodePath: [...previous.nodePath, edge.toNodeId], edgePath: [...previous.edgePath, edge],
      visitedTraversals: new Set([...previous.visitedTraversals, traversalKey(edge)]),
      cost: nextCost(previous, edge, graph.adjacency.get(previous.state.currentNodeId)?.length ?? 0), active: true }
  }
  const admit = (label: Label): boolean => {
    const key = labelStateKey(label.state), sameState = byState.get(key) ?? []
    const dominator = sameState.find(existing => existing.active && labelDominates(existing, label))
    if (dominator) { prunedLabelCount += 1; trace(label, 'pruned', { dominatingLabelId: dominator.id,
      dominatingSearchLabelCost: { ...dominator.cost }, pruneReason: 'pareto-dominated' }); return false }
    // Equal-cost duplicate directed prefixes are the same search label. Keep one.
    const duplicate = sameState.find(existing => existing.active && sameCost(existing.cost, label.cost) && pathKey(existing.edgePath) === pathKey(label.edgePath))
    if (duplicate) { prunedLabelCount += 1; trace(label, 'pruned', { dominatingLabelId: duplicate.id,
      dominatingSearchLabelCost: { ...duplicate.cost }, pruneReason: 'equal-cost-duplicate' }); return false }
    const removed = sameState.filter(existing => existing.active && labelDominates(label, existing))
    removed.forEach(existing => { existing.active = false; prunedLabelCount += 1; trace(existing, 'pruned', {
      dominatingLabelId: label.id, dominatingSearchLabelCost: { ...label.cost }, pruneReason: 'dominated-by-new-label' }) })
    const activeCount = sameState.filter(existing => existing.active).length
    if (activeCount >= limits.maxLabelsPerState) { cutoffReasons.add('maxLabelsPerState'); trace(label, 'limit-reached', { pruneReason: 'maxLabelsPerState' }); return false }
    if (allLabels.length >= limits.maxTotalLabels) { cutoffReasons.add('maxTotalLabels'); trace(label, 'limit-reached', { pruneReason: 'maxTotalLabels' }); return false }
    sameState.push(label); byState.set(key, sameState); allLabels.push(label); heapPush(queue, label)
    trace(label, 'admitted')
    return true
  }
  for (const originId of [...originIds].sort()) for (const targetExitId of [...exitIds].sort()) {
    if (!graph.nodes.has(originId) || !graph.nodes.has(targetExitId)) continue
    const label: Label = { id: nextLabelId++, state: { currentNodeId: originId, incomingTraversal: null, activeEquipmentSession: null,
      fareGatePassed: false, fareGateSequence: [], originBoardingAreaId: originId, targetExitId },
    nodePath: [originId], edgePath: [], visitedTraversals: new Set(), cost: zeroCost(), active: true }
    admit(label)
  }
  while (queue.length) {
    if (expansionCount >= limits.maxExpansions) { cutoffReasons.add('maxExpansions'); trace(currentQueueHead(queue), 'limit-reached', { pruneReason: 'maxExpansions' }); break }
    const current = heapPop(queue)!
    if (!current.active) continue
    if (current.state.currentNodeId === current.state.targetExitId) {
      completed.push(current)
      trace(current, 'completed')
      if (completed.length >= limits.maxCompletedCandidates) { cutoffReasons.add('maxCompletedCandidates'); trace(current, 'limit-reached', { pruneReason: 'maxCompletedCandidates' }); break }
      continue
    }
    expansionCount += 1
    const outgoing = graph.adjacency.get(current.state.currentNodeId) ?? []
    for (const edge of [...outgoing].sort((a, b) => traversalKey(a).localeCompare(traversalKey(b)))) {
      if (edge.fromNodeId !== current.state.currentNodeId || !graph.nodes.has(edge.toNodeId)) {
        if (diagnosticTrace) {
          const attempted = attemptedLabel(current, edge)
          trace(attempted, 'invalid-transition', { attemptedTraversal: traversalKey(edge), pruneReason: 'invalid-transition' })
        }
        continue
      }
      const directedKey = traversalKey(edge)
      // Edge-simple, not node-simple: legitimate down-then-up paths may revisit a node.
      if (current.visitedTraversals.has(directedKey)) {
        if (diagnosticTrace) trace(attemptedLabel(current, edge), 'cycle-rejected', { attemptedTraversal: directedKey, pruneReason: 'repeated-directed-edge' })
        continue
      }
      if (edge.movementType === 'fare-gate' && current.state.fareGateSequence.includes(gateKey(edge))) {
        if (diagnosticTrace) trace(attemptedLabel(current, edge), 'cycle-rejected', { attemptedTraversal: directedKey, pruneReason: 'repeated-fare-gate' })
        continue
      }
      const label = attemptedLabel(current, edge)
      admit(label)
    }
  }
  const candidates = completed.filter(label => label.active).map(label => {
    const route = routeFromLabel(graph, label)
    const routeCost = computeRouteCost(route, { graph, compression: options.compressionContext })
    return { originBoardingAreaId: label.state.originBoardingAreaId, targetExitId: label.state.targetExitId,
      route, searchCost: label.cost, routeCost, directedTraversalKey: pathKey(route.edges) }
  })
  const frontiers = Object.fromEntries(Object.values(MOBILITY_PROFILES).map(profile => [profile.id, finalFrontier(candidates, profile)])) as Record<MobilityProfileId, MultiObjectiveCandidate[]>
  const selectedByProfile = Object.fromEntries(Object.values(MOBILITY_PROFILES).map(profile => {
    const pool = frontiers[profile.id]
    const wrapped: MobilityRouteCandidate[] = pool.map(candidate => ({
      score: scoreElderlyRoute(graph, candidate.originBoardingAreaId, candidate.targetExitId, candidate.route, options.compressionContext),
      cost: candidate.routeCost,
    }))
    const selected = selectShadowCandidate(wrapped, profile, options.selectionMode)
    return [profile.id, selected ? pool.find(candidate => candidate.route === selected.score.route) ?? null : null]
  })) as Record<MobilityProfileId, MultiObjectiveCandidate | null>
  return { candidates, frontiers, selectedByProfile, exploredLabelCount: allLabels.length,
    prunedLabelCount, expansionCount, complete: cutoffReasons.size === 0, cutoffReasons: [...cutoffReasons], diagnosticTrace }
}

export interface MultiTargetExitResult {
  targetExitId: string
  candidates: MultiObjectiveCandidate[]
  frontiers: Record<MobilityProfileId, MultiObjectiveCandidate[]>
  selectedByProfile: Record<MobilityProfileId, MultiObjectiveCandidate | null>
  /** False means absence of a candidate is not evidence of unreachability. */
  searchComplete: boolean
  candidateDiscovered: boolean
  unreachableProven: boolean
}

export interface MultiTargetSearchResult {
  originBoardingAreaId: string
  targetExitIds: string[]
  exits: Record<string, MultiTargetExitResult>
  exploredLabelCount: number
  prunedLabelCount: number
  expansionCount: number
  complete: boolean
  cutoffReasons: string[]
  queueOrdering: 'current' | 'distance-lower-bound'
  distinctStateCount: number
  firstCandidateAdmittedLabelCount: number | null
  firstCandidateExpansionCount: number | null
  candidateCountsByExit: Record<string, number>
  diagnosticTrace?: SearchLabelDiagnostic[]
}

function selectCandidatesByProfile(candidates: MultiObjectiveCandidate[], graph: IndoorGraph,
  options: MultiObjectiveSearchOptions) {
  const frontiers = Object.fromEntries(Object.values(MOBILITY_PROFILES).map(profile =>
    [profile.id, finalFrontier(candidates, profile)])) as Record<MobilityProfileId, MultiObjectiveCandidate[]>
  const selectedByProfile = Object.fromEntries(Object.values(MOBILITY_PROFILES).map(profile => {
    const pool = frontiers[profile.id]
    const wrapped: MobilityRouteCandidate[] = pool.map(candidate => ({
      score: scoreElderlyRoute(graph, candidate.originBoardingAreaId, candidate.targetExitId, candidate.route, options.compressionContext),
      cost: candidate.routeCost,
    }))
    const selected = selectShadowCandidate(wrapped, profile, options.selectionMode)
    return [profile.id, selected ? pool.find(candidate => candidate.route === selected.score.route) ?? null : null]
  })) as Record<MobilityProfileId, MultiObjectiveCandidate | null>
  return { frontiers, selectedByProfile }
}

/**
 * Shadow-only search for one boarding origin and several exits. The origin is
 * deliberately fixed for the entire frontier; labels only share work when
 * their semantic state and future target coverage are both compatible.
 */
export function searchMultiObjectiveRoutesToTargets(graph: IndoorGraph, originBoardingAreaId: string,
  targetExitIds: readonly string[], options: MultiObjectiveSearchOptions = {}): MultiTargetSearchResult {
  const targets = [...new Set(targetExitIds)].filter(id => graph.nodes.has(id)).sort()
  const limits = { ...DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS, ...options.limits }
  const queueOrdering = options.queueOrdering ?? 'current'
  const targetDistances = queueOrdering === 'distance-lower-bound'
    ? new Map(targets.map(target => [target, optimisticDistancesToTarget(graph, target)])) : undefined
  const heuristic = (label: Label) => {
    if (!targetDistances) return 0
    let remaining = Infinity
    for (const target of label.targetSubscriptions ?? []) remaining = Math.min(remaining, targetDistances.get(target)?.get(label.state.currentNodeId) ?? Infinity)
    return remaining
  }
  const compareLabels = (left: Label, right: Label) => {
    if (queueOrdering === 'distance-lower-bound') {
      const leftPriority = (left.knownDistanceLowerBoundMeters ?? 0) + heuristic(left)
      const rightPriority = (right.knownDistanceLowerBoundMeters ?? 0) + heuristic(right)
      const priorityOrder = compareNumeric(leftPriority, rightPriority)
      if (priorityOrder) return priorityOrder
    }
    return compareQueueLabels(left, right)
  }
  const allLabels: Label[] = [], byState = new Map<string, Label[]>(), queue: Label[] = []
  const completedByTarget = new Map<string, Label[]>(targets.map(target => [target, []]))
  const cutoffReasons = new Set<string>(), diagnosticTrace = options.diagnostics ? [] as SearchLabelDiagnostic[] : undefined
  const rebuildQueue = () => {
    const labels = queue.splice(0).filter(label => label.active)
    labels.forEach(label => heapPush(queue, label, compareLabels))
  }
  let nextLabelId = 1, prunedLabelCount = 0, expansionCount = 0
  let firstCandidateAdmittedLabelCount: number | null = null, firstCandidateExpansionCount: number | null = null
  const trace = (label: Label, event: SearchDiagnosticEventType, details: Partial<SearchLabelDiagnostic> = {}) => {
    if (!diagnosticTrace) return
    diagnosticTrace.push({ labelId: label.id, event, currentNodeId: label.state.currentNodeId,
      stateKey: labelStateKey(label.state, false), directedTraversalHistory: label.edgePath.map(traversalKey),
      usedDirectedEdges: [...label.visitedTraversals].sort(), searchLabelCost: { ...label.cost },
      originBoardingAreaId, targetExit: '', targetSubscriptions: [...(label.targetSubscriptions ?? [])].sort(),
      fareGateState: { passed: label.state.fareGatePassed, sequence: [...label.state.fareGateSequence] },
      equipmentSessionState: label.state.activeEquipmentSession, ...details })
  }
  const attemptedLabel = (previous: Label, edge: IndoorEdge): Label => ({
    id: nextLabelId++, state: stateForEdge(graph, previous, edge, options.compressionContext),
    nodePath: [...previous.nodePath, edge.toNodeId], edgePath: [...previous.edgePath, edge],
    visitedTraversals: new Set([...previous.visitedTraversals, traversalKey(edge)]),
    cost: nextCost(previous, edge, graph.adjacency.get(previous.state.currentNodeId)?.length ?? 0),
    knownDistanceLowerBoundMeters: (previous.knownDistanceLowerBoundMeters ?? 0)
      + (Number.isFinite(edge.lengthMeters) && edge.lengthMeters >= 0 ? edge.lengthMeters : 0),
    active: true, targetSubscriptions: new Set(previous.targetSubscriptions),
  })
  const admit = (label: Label): boolean => {
    const key = labelStateKey(label.state, false), sameState = byState.get(key) ?? []
    const dominator = sameState.find(existing => existing.active && labelDominates(existing, label))
    if (dominator) {
      prunedLabelCount += 1
      trace(label, 'pruned', { dominatingLabelId: dominator.id, dominatingSearchLabelCost: { ...dominator.cost }, pruneReason: 'pareto-dominated' })
      return false
    }
    const duplicate = sameState.find(existing => existing.active && targetCoverageContains(existing, label)
      && sameCost(existing.cost, label.cost) && pathKey(existing.edgePath) === pathKey(label.edgePath))
    if (duplicate) {
      prunedLabelCount += 1
      trace(label, 'pruned', { dominatingLabelId: duplicate.id, dominatingSearchLabelCost: { ...duplicate.cost }, pruneReason: 'equal-cost-duplicate' })
      return false
    }
    sameState.filter(existing => existing.active && labelDominates(label, existing)).forEach(existing => {
      existing.active = false; prunedLabelCount += 1
      trace(existing, 'pruned', { dominatingLabelId: label.id, dominatingSearchLabelCost: { ...label.cost }, pruneReason: 'dominated-by-new-label' })
    })
    const activeCount = sameState.filter(existing => existing.active).length
    if (activeCount >= limits.maxLabelsPerState) {
      cutoffReasons.add('maxLabelsPerState'); trace(label, 'limit-reached', { pruneReason: 'maxLabelsPerState' }); return false
    }
    if (allLabels.length >= limits.maxTotalLabels) {
      cutoffReasons.add('maxTotalLabels'); trace(label, 'limit-reached', { pruneReason: 'maxTotalLabels' }); return false
    }
    sameState.push(label); byState.set(key, sameState); allLabels.push(label); heapPush(queue, label, compareLabels); trace(label, 'admitted')
    return true
  }

  if (graph.nodes.has(originBoardingAreaId) && targets.length) {
    const start: Label = { id: nextLabelId++, state: { currentNodeId: originBoardingAreaId, incomingTraversal: null,
      activeEquipmentSession: null, fareGatePassed: false, fareGateSequence: [], originBoardingAreaId, targetExitId: '' },
      nodePath: [originBoardingAreaId], edgePath: [], visitedTraversals: new Set(), cost: zeroCost(), active: true,
      knownDistanceLowerBoundMeters: 0, targetSubscriptions: new Set(targets) }
    admit(start)
  }

  while (queue.length) {
    if (expansionCount >= limits.maxExpansions) {
      cutoffReasons.add('maxExpansions'); const head = currentQueueHead(queue)
      if (head) trace(head, 'limit-reached', { pruneReason: 'maxExpansions' })
      break
    }
    const current = heapPop(queue, compareLabels)!
    if (!current.active || !current.targetSubscriptions?.size) continue
    const reachedTarget = current.targetSubscriptions.has(current.state.currentNodeId)
    if (reachedTarget) {
      const target = current.state.currentNodeId
      const snapshot: Label = { ...current, id: nextLabelId++, state: { ...current.state, targetExitId: target },
        visitedTraversals: new Set(current.visitedTraversals), targetSubscriptions: undefined, active: true }
      completedByTarget.get(target)!.push(snapshot)
      if (firstCandidateAdmittedLabelCount === null) {
        firstCandidateAdmittedLabelCount = allLabels.length
        firstCandidateExpansionCount = expansionCount
      }
      trace(current, 'completed', { targetExit: target })
      const completedCount = [...completedByTarget.values()].reduce((sum, labels) => sum + labels.length, 0)
      if (completedCount >= limits.maxCompletedCandidates) {
        cutoffReasons.add('maxCompletedCandidates'); trace(current, 'limit-reached', { targetExit: target, pruneReason: 'maxCompletedCandidates' }); break
      }
      current.targetSubscriptions.delete(target)
      if (!current.targetSubscriptions.size) continue
      // In g+h mode, the target set is part of h. Reinsert after removal so
      // remaining work is ordered against the updated target coverage.
      if (queueOrdering === 'distance-lower-bound') {
        rebuildQueue()
        heapPush(queue, current, compareLabels)
        continue
      }
    }
    expansionCount += 1
    const outgoing = graph.adjacency.get(current.state.currentNodeId) ?? []
    for (const edge of [...outgoing].sort((a, b) => traversalKey(a).localeCompare(traversalKey(b)))) {
      if (edge.fromNodeId !== current.state.currentNodeId || !graph.nodes.has(edge.toNodeId)) {
        if (diagnosticTrace) trace(attemptedLabel(current, edge), 'invalid-transition', { attemptedTraversal: traversalKey(edge), pruneReason: 'invalid-transition' })
        continue
      }
      const directedKey = traversalKey(edge)
      if (current.visitedTraversals.has(directedKey)) {
        if (diagnosticTrace) trace(attemptedLabel(current, edge), 'cycle-rejected', { attemptedTraversal: directedKey, pruneReason: 'repeated-directed-edge' })
        continue
      }
      if (edge.movementType === 'fare-gate' && current.state.fareGateSequence.includes(gateKey(edge))) {
        if (diagnosticTrace) trace(attemptedLabel(current, edge), 'cycle-rejected', { attemptedTraversal: directedKey, pruneReason: 'repeated-fare-gate' })
        continue
      }
      admit(attemptedLabel(current, edge))
    }
    if ([...completedByTarget.values()].reduce((sum, labels) => sum + labels.length, 0) >= limits.maxCompletedCandidates) {
      cutoffReasons.add('maxCompletedCandidates'); trace(current, 'limit-reached', { pruneReason: 'maxCompletedCandidates' }); break
    }
  }

  const exits: Record<string, MultiTargetExitResult> = {}
  for (const target of targets) {
    const labels = completedByTarget.get(target) ?? []
    const candidates = labels.map(label => {
      const route = routeFromLabel(graph, label)
      const routeCost = computeRouteCost(route, { graph, compression: options.compressionContext })
      return { originBoardingAreaId, targetExitId: target, route, searchCost: label.cost, routeCost, directedTraversalKey: pathKey(route.edges) }
    })
    exits[target] = { targetExitId: target, candidates, ...selectCandidatesByProfile(candidates, graph, options),
      searchComplete: cutoffReasons.size === 0, candidateDiscovered: candidates.length > 0,
      unreachableProven: cutoffReasons.size === 0 && candidates.length === 0 }
  }
  return { originBoardingAreaId, targetExitIds: targets, exits, exploredLabelCount: allLabels.length,
    prunedLabelCount, expansionCount, complete: cutoffReasons.size === 0, cutoffReasons: [...cutoffReasons],
    queueOrdering, distinctStateCount: byState.size, firstCandidateAdmittedLabelCount, firstCandidateExpansionCount,
    candidateCountsByExit: Object.fromEntries(targets.map(target => [target, exits[target].candidates.length])), diagnosticTrace }
}

function currentQueueHead(queue: readonly Label[]) { return queue[0] }

export interface CandidateComparisonDiagnostic {
  legacyCandidateCount: number
  multiObjectiveCandidateCount: number
  legacyCandidates: Array<{ route: IndoorRoute; routeCost: RouteCost; directedTraversalKey: string }>
  legacyOnly: string[]
  multiObjectiveOnly: string[]
  search: MultiObjectiveSearchResult
}

/** Compares by directed traversals so reverse use of one Pathway remains distinct. */
export function compareCandidateSets(legacyRoutes: readonly IndoorRoute[], search: MultiObjectiveSearchResult,
  graph: IndoorGraph, compressionContext?: IndoorRouteCompressionContext): CandidateComparisonDiagnostic {
  const legacy = new Set(legacyRoutes.map(route => pathKey(route.edges))), multi = new Set(search.candidates.map(candidate => candidate.directedTraversalKey))
  const legacyCandidates = [...new Map(legacyRoutes.map(route => [pathKey(route.edges), route])).values()].map(route => ({
    route, routeCost: computeRouteCost(route, { graph, compression: compressionContext }), directedTraversalKey: pathKey(route.edges),
  }))
  return { legacyCandidateCount: legacy.size, multiObjectiveCandidateCount: multi.size, legacyCandidates,
    legacyOnly: [...legacy].filter(key => !multi.has(key)), multiObjectiveOnly: [...multi].filter(key => !legacy.has(key)), search }
}

/** Expand the same boarding-area × exit domain used by platform routing. */
export function searchPlatformToExitsMultiObjective(graph: IndoorGraph, platformIds: readonly string[], exitIds: readonly string[], options: MultiObjectiveSearchOptions = {}) {
  const originIds = [...new Set(platformIds.flatMap(platformId => platformOriginNodes(graph, platformId).map(origin => origin.id)))]
  return searchMultiObjectiveRoutes(graph, originIds, exitIds, options)
}

/** Replay a legacy traversal against an opt-in trace; never inject it into search. */
export function traceRouteThroughSearch(graph: IndoorGraph, route: IndoorRoute, originBoardingAreaId: string,
  targetExitId: string, options: MultiObjectiveSearchOptions = {}): LegacyRouteReplayDiagnostic {
  const search = searchMultiObjectiveRoutes(graph, [originBoardingAreaId], [targetExitId], { ...options, diagnostics: true })
  return { ...classifyLegacyRouteAgainstTrace(route, search, originBoardingAreaId, targetExitId), search }
}

/** Classify a route against a previously captured trace, without rerunning search. */
export function classifyLegacyRouteAgainstTrace(route: IndoorRoute, search: MultiObjectiveSearchResult,
  originBoardingAreaId?: string, targetExitId?: string): LegacyRouteTraceClassification {
  const trace = search.diagnosticTrace ?? [], edgeKeys = route.edges.map(traversalKey), routeKey = pathKey(route.edges)
  const inScope = (candidate: MultiObjectiveCandidate) => (!originBoardingAreaId || candidate.originBoardingAreaId === originBoardingAreaId)
    && (!targetExitId || candidate.targetExitId === targetExitId)
  const traceInScope = trace.filter(event => (!originBoardingAreaId || event.originBoardingAreaId === originBoardingAreaId)
    && (!targetExitId || event.targetExit === targetExitId))
  if (search.candidates.some(candidate => inScope(candidate) && candidate.directedTraversalKey === routeKey)) {
    return { status: 'completed', matchedPrefixLength: edgeKeys.length, firstLostTraversal: null,
      reason: 'The exact directed traversal sequence completed in shadow search.' }
  }
  const eventsForPrefix = (prefix: string[]) => traceInScope.filter(event => JSON.stringify(event.directedTraversalHistory) === JSON.stringify(prefix))
  for (let index = 1; index <= edgeKeys.length; index += 1) {
    const events = eventsForPrefix(edgeKeys.slice(0, index))
    const rejected = events.find(event => event.event === 'cycle-rejected' || event.event === 'invalid-transition'
      || event.event === 'limit-reached' || event.event === 'pruned')
    if (!rejected) continue
    const status: LegacyRouteReplayStatus = rejected.event === 'cycle-rejected' ? 'cycle-rejected'
      : rejected.event === 'invalid-transition' ? 'invalid-transition'
        : rejected.event === 'limit-reached' ? 'limit-reached' : 'dominated'
    return { status, matchedPrefixLength: index, firstLostTraversal: edgeKeys[index - 1],
      reason: rejected.pruneReason ?? rejected.event }
  }
  let longestAdmitted = 0
  edgeKeys.forEach((_, index) => {
    if (eventsForPrefix(edgeKeys.slice(0, index + 1)).some(event => event.event === 'admitted')) longestAdmitted = index + 1
  })
  if (!search.complete) return { status: 'limit-reached', matchedPrefixLength: longestAdmitted,
    firstLostTraversal: edgeKeys[longestAdmitted] ?? null,
    reason: `Search ended incomplete (${search.cutoffReasons.join(', ')}); later prefixes were not observed.` }
  if (longestAdmitted < edgeKeys.length) return { status: 'dominated', matchedPrefixLength: longestAdmitted,
    firstLostTraversal: edgeKeys[longestAdmitted] ?? null,
    reason: 'A route descendant was not emitted after its prefix; exact rejection was not recorded.' }
  return { status: 'valid', matchedPrefixLength: longestAdmitted, firstLostTraversal: null,
    reason: 'All route prefixes were admitted, but the exact route was not a completed candidate.' }
}
