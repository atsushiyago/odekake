import { compactIndoorRouteSteps, findRoutesFromPlatform, routeTopologyContext, type IndoorGraph, type IndoorMovementType, type IndoorRoute, type IndoorRouteCompressionContext } from './indoorRouting'
import { computeRouteCost, type RouteCost } from './routeCost'

export interface ElderlyRouteScore {
  originId: string
  exitId: string
  route: IndoorRoute
  stairs: number
  escalators: number
  elevators: number
  equipmentChanges: number
  decisionPoints: number
  distanceMeters: number
  equipmentUses: number
  /** Lower is better. The ES preference is applied only inside a small distance tie. */
  ranking: [number, number, number, number, number]
}

export const ELDERLY_ROUTE_DISTANCE_TIE_METERS = 10

export type MobilityProfileId = 'balanced' | 'escalator-preferred' | 'elevator-preferred'
export interface MobilityProfile {
  id: MobilityProfileId
  equipmentPreference: 'neutral' | 'escalator' | 'elevator'
}
export const MOBILITY_PROFILES: Readonly<Record<MobilityProfileId, MobilityProfile>> = {
  balanced: { id: 'balanced', equipmentPreference: 'neutral' },
  'escalator-preferred': { id: 'escalator-preferred', equipmentPreference: 'escalator' },
  'elevator-preferred': { id: 'elevator-preferred', equipmentPreference: 'elevator' },
}

/** Profile-level distance-equivalence setting; retained at the existing 10m. */
export const MOBILITY_PROFILE_DISTANCE_TIE_METERS = ELDERLY_ROUTE_DISTANCE_TIE_METERS

export interface MobilityRouteCandidate { score: ElderlyRouteScore; cost: RouteCost }
export interface MobilityCandidateDiagnostic extends MobilityRouteCandidate {
  inBaseGroup: boolean
  inDistanceGroup: boolean
  selected: boolean
  reason: string
}
export interface MobilitySelectionResult {
  profile: MobilityProfile
  selected: MobilityRouteCandidate | null
  candidates: MobilityCandidateDiagnostic[]
  /** Present when unresolved evidence prevents a defensible winner. */
  selectionBlockedBy?: string
}

type EvidenceMetric = 'stairs' | 'escalator' | 'elevator' | 'boardings' | 'transfers' | 'typeChanges'
interface EvidenceBounds { lower: number; upper: number }

function evidenceBounds(candidate: MobilityRouteCandidate, metric: EvidenceMetric): EvidenceBounds {
  const { cost } = candidate
  if (metric === 'stairs') return cost.stairs.uses === null
    ? { lower: cost.observedSemanticUses.stairs, upper: Infinity }
    : { lower: cost.stairs.uses, upper: cost.stairs.uses }
  if (metric === 'escalator') return cost.escalatorUses === null
    ? { lower: cost.observedSemanticUses.escalator, upper: Infinity }
    : { lower: cost.escalatorUses, upper: cost.escalatorUses }
  if (metric === 'elevator') return cost.elevatorUses === null
    ? { lower: cost.observedSemanticUses.elevator, upper: Infinity }
    : { lower: cost.elevatorUses, upper: cost.elevatorUses }
  if (metric === 'boardings') return cost.equipmentBoardings === null
    ? { lower: Object.values(cost.observedSemanticUses).reduce((sum, value) => sum + value, 0), upper: Infinity }
    : { lower: cost.equipmentBoardings, upper: cost.equipmentBoardings }
  if (metric === 'transfers') return cost.unresolvedEquipmentTransitions > 0
    ? { lower: cost.equipmentInstanceTransfers, upper: Infinity }
    : { lower: cost.equipmentInstanceTransfers, upper: cost.equipmentInstanceTransfers }
  return { lower: cost.equipmentTypeChanges, upper: cost.equipmentTypeChanges }
}

/**
 * Retain a minimum/maximum only when the available exact values and lower bounds
 * prove a candidate (or tied candidates) no worse than every alternative.
 * Overlapping intervals are incomparable; their lower bounds are never treated
 * as exact values.
 */
function retainProvablyBest(candidates: readonly MobilityRouteCandidate[], metric: EvidenceMetric,
  preference: 'min' | 'max'): { candidates: MobilityRouteCandidate[]; comparable: boolean } {
  if (candidates.length < 2) return { candidates: [...candidates], comparable: true }
  const bounds = new Map(candidates.map(candidate => [candidate, evidenceBounds(candidate, metric)]))
  const proven = candidates.filter(candidate => candidates.every(other => {
    if (candidate === other) return true
    const own = bounds.get(candidate)!, alternative = bounds.get(other)!
    return preference === 'min' ? own.upper <= alternative.lower : own.lower >= alternative.upper
  }))
  if (proven.length) return { candidates: proven, comparable: true }
  return { candidates: [...candidates], comparable: false }
}

/** Shadow-only selector. Production keeps using selectBestRoute unchanged. */
export function selectBestEvidenceAwareRoute(candidates: readonly MobilityRouteCandidate[],
  profile: MobilityProfile = MOBILITY_PROFILES.balanced): MobilitySelectionResult {
  const valid = candidates.filter(candidate => validRouteCost(candidate.cost) && selectBestElderlyRoute([candidate.score]) !== null)
  let pool = [...valid]
  let basePool = [...valid]
  let distancePool = [...valid]
  let selectionBlockedBy: string | undefined
  const comparisonNotes = new Map<MobilityRouteCandidate, string[]>()
  const applyEvidenceMinimum = (metric: EvidenceMetric) => {
    const result = retainProvablyBest(pool, metric, 'min')
    if (!result.comparable) {
      selectionBlockedBy = metric
      for (const candidate of pool) {
        const note = comparisonNotes.get(candidate) ?? []
        note.push(`${metric} unresolved/incomparable; lower bound not treated as exact`)
        comparisonNotes.set(candidate, note)
      }
    } else {
      const retained = new Set(result.candidates)
      for (const candidate of pool) if (!retained.has(candidate)) {
        const note = comparisonNotes.get(candidate) ?? []
        note.push(`${metric} count proven no better than another candidate`)
        comparisonNotes.set(candidate, note)
      }
    }
    pool = result.candidates
  }

  // Preserve the established burden priority, but do not let an unresolved
  // observed count masquerade as a confirmed low count.
  applyEvidenceMinimum('stairs')
  if (!selectionBlockedBy) applyEvidenceMinimum('typeChanges')
  if (!selectionBlockedBy) {
    const decisions = pool.length ? Math.min(...pool.map(candidate => candidate.cost.decisionPoints)) : Infinity
    pool = pool.filter(candidate => candidate.cost.decisionPoints === decisions)
  }
  basePool = [...pool]

  // Distance is measured independently of equipment certainty.
  if (!selectionBlockedBy) {
    const minDistance = pool.length ? Math.min(...pool.map(({ score }) => score.distanceMeters)) : Infinity
    pool = pool.filter(({ score }) => score.distanceMeters <= minDistance + MOBILITY_PROFILE_DISTANCE_TIE_METERS)
  }
  distancePool = [...pool]

  // Balanced preserves its established neutral equipment-change semantics;
  // transfers are only an explicit profile tie-break today.
  if (!selectionBlockedBy && profile.id !== 'balanced') applyEvidenceMinimum('transfers')
  if (!selectionBlockedBy) applyEvidenceMinimum('boardings')
  const preferredMetric: EvidenceMetric | null = profile.equipmentPreference === 'escalator' ? 'escalator'
    : profile.equipmentPreference === 'elevator' ? 'elevator' : null
  if (!selectionBlockedBy && preferredMetric) {
    const result = retainProvablyBest(pool, preferredMetric, 'max')
    if (!result.comparable) {
      for (const candidate of pool) {
        const note = comparisonNotes.get(candidate) ?? []
        note.push(`evidence insufficient for ${profile.equipmentPreference} preference`)
        comparisonNotes.set(candidate, note)
      }
    } else {
      const retained = new Set(result.candidates)
      for (const candidate of pool) if (!retained.has(candidate)) {
        const note = comparisonNotes.get(candidate) ?? []
        note.push(`${profile.equipmentPreference} use proven no better than another candidate`)
        comparisonNotes.set(candidate, note)
      }
    }
    pool = result.candidates
  } else if (!selectionBlockedBy) {
    const result = retainProvablyBest(pool, 'escalator', 'max')
    if (!result.comparable) {
      for (const candidate of pool) {
        const note = comparisonNotes.get(candidate) ?? []
        note.push('escalator evidence insufficient for balanced tie-break')
        comparisonNotes.set(candidate, note)
      }
    } else {
      const retained = new Set(result.candidates)
      for (const candidate of pool) if (!retained.has(candidate)) {
        const note = comparisonNotes.get(candidate) ?? []
        note.push('escalator use proven no better than another candidate')
        comparisonNotes.set(candidate, note)
      }
    }
    pool = result.candidates
  }
  // Stable, evidence-neutral tie-breaks; no observed unresolved use count here.
  if (!selectionBlockedBy && pool.length) {
    const shortest = Math.min(...pool.map(({ score }) => score.distanceMeters))
    pool = pool.filter(({ score }) => score.distanceMeters === shortest)
  }
  if (!selectionBlockedBy) {
    const finalElevators = retainProvablyBest(pool, 'elevator', 'min')
    pool = finalElevators.candidates
  }
  const selected = selectionBlockedBy ? null : pool.reduce<MobilityRouteCandidate | null>((best, candidate) =>
    !best || routeKey(candidate.score) < routeKey(best.score) ? candidate : best, null)

  const diagnostics = candidates.map(candidate => {
    const isValid = valid.includes(candidate)
    const isSelected = selected !== null && routeKey(candidate.score) === routeKey(selected.score)
    const inBaseGroup = basePool.includes(candidate)
    const inDistanceGroup = distancePool.includes(candidate)
    const notes = [...(comparisonNotes.get(candidate) ?? [])]
    if (candidate.cost.unresolvedEquipmentGroups > 0) notes.push('equipment use counts include unresolved groups')
    if (candidate.cost.unresolvedEquipmentTransitions > 0) notes.push('equipment transfer count is a confirmed lower bound')
    if (profile.equipmentPreference === 'escalator' && candidate.cost.escalatorUses === null)
      notes.push('evidence insufficient for escalator preference')
    if (profile.equipmentPreference === 'elevator' && candidate.cost.elevatorUses === null)
      notes.push('evidence insufficient for elevator preference')
    const reason = !isValid ? 'Rejected: invalid route or malformed cost evidence'
      : selectionBlockedBy ? `No winner: ${selectionBlockedBy} evidence is incomparable; cannot rank lower-priority criteria`
      : isSelected ? `Selected by evidence-aware ordering${notes.length ? `; ${notes.join('; ')}` : ''}`
        : !inBaseGroup ? `Rejected by a proven higher-priority burden comparison${notes.length ? `; ${notes.join('; ')}` : ''}`
          : !inDistanceGroup ? `Outside global Dmin + ${MOBILITY_PROFILE_DISTANCE_TIE_METERS}m window${notes.length ? `; ${notes.join('; ')}` : ''}`
          : `Not selected after evidence-neutral canonical traversal tie-break${notes.length ? `; ${notes.join('; ')}` : ''}`
    return { ...candidate, inBaseGroup, inDistanceGroup, selected: isSelected, reason }
  })
  return { profile, selected, candidates: diagnostics, ...(selectionBlockedBy ? { selectionBlockedBy } : {}) }
}

const equipment = new Set<IndoorMovementType>(['stairs', 'escalator', 'elevator'])

function equipmentUsage(route: IndoorRoute, graph: IndoorGraph, compressionContext?: IndoorRouteCompressionContext) {
  const counts: Record<'stairs' | 'escalator' | 'elevator', number> = { stairs: 0, escalator: 0, elevator: 0 }
  const semanticSteps = compactIndoorRouteSteps(route, routeTopologyContext(graph, route, compressionContext))
  const semanticEquipment = semanticSteps.map(step => step.type).filter((type): type is IndoorMovementType => equipment.has(type))
  semanticEquipment.forEach(type => { counts[type as keyof typeof counts] += 1 })
  let changes = 0
  for (let index = 1; index < semanticEquipment.length; index += 1) {
    if (semanticEquipment[index] !== semanticEquipment[index - 1]) changes += 1
  }
  return { ...counts, changes, uses: semanticEquipment.length }
}

function decisionPoints(graph: IndoorGraph, route: IndoorRoute) {
  return route.nodes.slice(0, -1).filter(node => (graph.adjacency.get(node.id)?.length ?? 0) > 2).length
}

export function scoreElderlyRoute(graph: IndoorGraph, originId: string, exitId: string, route: IndoorRoute, compressionContext?: IndoorRouteCompressionContext): ElderlyRouteScore {
  const usage = equipmentUsage(route, graph, compressionContext)
  const stairs = usage.stairs
  const escalators = usage.escalator
  const elevators = usage.elevator
  const changes = usage.changes
  const decisions = decisionPoints(graph, route)
  const equipmentUses = usage.uses
  return { originId, exitId, route, stairs, escalators, elevators, equipmentChanges: changes, decisionPoints: decisions, distanceMeters: route.distanceMeters, equipmentUses, ranking: [stairs, changes, decisions, route.distanceMeters, equipmentUses] }
}

function canonicalTraversalKey(candidate: ElderlyRouteScore): string {
  return JSON.stringify([candidate.originId, candidate.exitId,
    candidate.route.edges.map(edge => [edge.id, edge.fromNodeId, edge.toNodeId])])
}

/** Selects from an already-generated set; never changes search or semantic scoring.
 * Distance equivalence is anchored once to the hard-priority group's minimum,
 * not to each pair (which would make the preference non-transitive).
 */
export function selectBestElderlyRoute(candidates: readonly ElderlyRouteScore[]): ElderlyRouteScore | null {
  let group = candidates.filter(candidate => {
    const { route } = candidate
    return [candidate.stairs, candidate.equipmentChanges, candidate.decisionPoints,
      candidate.distanceMeters, candidate.equipmentUses, candidate.escalators, candidate.elevators]
      .every(value => Number.isFinite(value) && value >= 0)
      && route.nodes.length === route.edges.length + 1
      && route.nodes[0]?.id === candidate.originId
      && route.nodes.at(-1)?.id === candidate.exitId
      && route.edges.every((edge, index) => edge.fromNodeId === route.nodes[index].id
        && edge.toNodeId === route.nodes[index + 1].id)
  })
  if (!group.length) return null
  const retainMinimum = (value: (candidate: ElderlyRouteScore) => number) => {
    const minimum = group.reduce((best, candidate) => Math.min(best, value(candidate)), Infinity)
    group = group.filter(candidate => value(candidate) === minimum)
  }
  retainMinimum(candidate => candidate.stairs)
  retainMinimum(candidate => candidate.equipmentChanges)
  retainMinimum(candidate => candidate.decisionPoints)
  const minimumDistance = group.reduce((best, candidate) => Math.min(best, candidate.distanceMeters), Infinity)
  group = group.filter(candidate => candidate.distanceMeters <= minimumDistance + ELDERLY_ROUTE_DISTANCE_TIE_METERS)
  retainMinimum(candidate => candidate.equipmentUses)
  retainMinimum(candidate => -candidate.escalators)
  retainMinimum(candidate => candidate.distanceMeters)
  retainMinimum(candidate => candidate.elevators)
  // IDs have no semantic priority: use directed traversals only after all scores tie.
  return group.reduce((best, candidate) => canonicalTraversalKey(candidate) < canonicalTraversalKey(best) ? candidate : best)
}

function routeKey(candidate: ElderlyRouteScore) {
  return JSON.stringify([candidate.originId, candidate.exitId,
    candidate.route.edges.map(edge => [edge.id, edge.fromNodeId, edge.toNodeId])])
}

function baseGroup(candidates: readonly MobilityRouteCandidate[]) {
  let group = [...candidates].filter(({ score }) => selectBestElderlyRoute([score]) !== null)
  const minimize = (value: (candidate: MobilityRouteCandidate) => number) => {
    if (!group.length) return
    const best = Math.min(...group.map(value))
    group = group.filter(candidate => value(candidate) === best)
  }
  minimize(({ score }) => score.stairs)
  minimize(({ score }) => score.equipmentChanges)
  minimize(({ score }) => score.decisionPoints)
  return group
}

function validRouteCost(cost: RouteCost) {
  const knownValues = [cost.knownWalkingMeters, cost.knownPathwayMeters, cost.equipmentInstanceTransfers,
    cost.equipmentTypeChanges, cost.unresolvedEquipmentTransitions, cost.unresolvedEquipmentGroups,
    cost.decisionPoints, ...Object.values(cost.observedSemanticUses), ...Object.values(cost.verticalActions)]
  const optionalValues = [cost.walkingMeters, cost.totalPathwayMeters, cost.stairs.uses, cost.escalatorUses,
    cost.elevatorUses, cost.equipmentBoardings]
  return knownValues.every(value => Number.isFinite(value) && value >= 0)
    && optionalValues.every(value => value === null || (Number.isFinite(value) && value >= 0))
}

/** Pure candidate-set profile selection with a trace explaining every rejection. */
export function selectBestRoute(candidates: readonly MobilityRouteCandidate[], profile: MobilityProfile = MOBILITY_PROFILES.balanced): MobilitySelectionResult {
  const valid = candidates.filter(candidate => validRouteCost(candidate.cost) && selectBestElderlyRoute([candidate.score]) !== null)
  const base = baseGroup(valid)
  const minDistance = base.length ? Math.min(...base.map(({ score }) => score.distanceMeters)) : Infinity
  const distanceGroup = base.filter(({ score }) => score.distanceMeters <= minDistance + MOBILITY_PROFILE_DISTANCE_TIE_METERS)
  let preferenceGroup = [...distanceGroup]
  if (profile.id !== 'balanced' && preferenceGroup.length) {
    // Unresolved evidence cannot masquerade as a zero-cost/known transition.
    const uncertainty = (candidate: MobilityRouteCandidate) => candidate.cost.unresolvedEquipmentGroups + candidate.cost.unresolvedEquipmentTransitions
    const bestUncertainty = Math.min(...preferenceGroup.map(uncertainty))
    preferenceGroup = preferenceGroup.filter(candidate => uncertainty(candidate) === bestUncertainty)
    const confirmedTransfers = preferenceGroup.map(candidate => candidate.cost.equipmentInstanceTransfers)
    if (confirmedTransfers.every(Number.isFinite)) {
      const fewestTransfers = Math.min(...confirmedTransfers)
      preferenceGroup = preferenceGroup.filter(candidate => candidate.cost.equipmentInstanceTransfers === fewestTransfers)
    }
    const boardings = preferenceGroup.map(candidate => candidate.cost.equipmentBoardings)
    // If any remaining route has unknown boardings, do not treat null as zero;
    // retain the whole set and let only known per-type preference evidence apply.
    if (boardings.every((value): value is number => value !== null)) {
      const fewest = Math.min(...boardings)
      preferenceGroup = preferenceGroup.filter(candidate => candidate.cost.equipmentBoardings === fewest)
    }
    const preferredCounts = preferenceGroup.map(candidate => profile.equipmentPreference === 'escalator'
      ? candidate.cost.escalatorUses : candidate.cost.elevatorUses)
    if (preferredCounts.every((value): value is number => value !== null)) {
      const most = Math.max(...preferredCounts)
      preferenceGroup = preferenceGroup.filter(candidate => (profile.equipmentPreference === 'escalator'
        ? candidate.cost.escalatorUses : candidate.cost.elevatorUses) === most)
    }
  }
  // Balanced retains the prior deterministic collection rule exactly. Preferred
  // profiles use its remaining neutral tie-breaks after applying their preference.
  const tieBreak = (pool: MobilityRouteCandidate[]) => {
    if (!pool.length) return null
    if (profile.id === 'balanced') return selectBestElderlyRoute(pool.map(candidate => candidate.score))
    const minUses = Math.min(...pool.map(({ score }) => score.equipmentUses))
    pool = pool.filter(({ score }) => score.equipmentUses === minUses)
    const minDistance = Math.min(...pool.map(({ score }) => score.distanceMeters))
    pool = pool.filter(({ score }) => score.distanceMeters === minDistance)
    const minElevators = Math.min(...pool.map(({ score }) => score.elevators))
    pool = pool.filter(({ score }) => score.elevators === minElevators)
    return pool.map(candidate => candidate.score).reduce((best, current) => routeKey(current) < routeKey(best) ? current : best)
  }
  const selectedScore = tieBreak(preferenceGroup)
  const selected = selectedScore ? valid.find(candidate => routeKey(candidate.score) === routeKey(selectedScore)) ?? null : null
  const diagnostics = candidates.map(candidate => {
    const isValid = valid.includes(candidate)
    const inBaseGroup = base.some(item => routeKey(item.score) === routeKey(candidate.score))
    const inDistanceGroup = distanceGroup.some(item => routeKey(item.score) === routeKey(candidate.score))
    const isSelected = selected !== null && routeKey(candidate.score) === routeKey(selected.score)
    const reason = isSelected ? 'Selected after base burden, global distance window and profile preference'
      : !isValid ? 'Rejected: invalid route or malformed cost evidence'
      : !inBaseGroup ? 'Rejected by stairs, equipment type changes, or decision points'
        : !inDistanceGroup ? `Outside global Dmin + ${MOBILITY_PROFILE_DISTANCE_TIE_METERS}m window`
          : !preferenceGroup.some(item => routeKey(item.score) === routeKey(candidate.score))
            ? profile.id === 'balanced' ? 'Rejected by balanced semantic-use/ES/distance tie-breaks'
              : 'Rejected by unresolved-evidence, boarding-count, or profile equipment preference'
            : 'Deterministic canonical traversal tie-break'
    return { ...candidate, inBaseGroup, inDistanceGroup, selected: isSelected, reason }
  })
  return { profile, selected, candidates: diagnostics }
}

function mobilityCandidates(graph: IndoorGraph, candidates: readonly ElderlyRouteScore[], compressionContext?: IndoorRouteCompressionContext): MobilityRouteCandidate[] {
  return candidates.map(score => ({ score, cost: computeRouteCost(score.route, { graph, compression: compressionContext }) }))
}

export function selectBestMobilityRoute(graph: IndoorGraph, candidates: readonly ElderlyRouteScore[], profile: MobilityProfile = MOBILITY_PROFILES.balanced, compressionContext?: IndoorRouteCompressionContext): MobilitySelectionResult {
  return selectBestRoute(mobilityCandidates(graph, candidates, compressionContext), profile)
}

/**
 * Collects the repository's existing route variants, then chooses a route
 * using transparent elderly-oriented criteria. No station or pathway IDs are
 * embedded here; official car-position wording remains separate data.
 */
export function findBestElderlyRoute(graph: IndoorGraph, platformId: string, exitIds: string[], compressionContext?: IndoorRouteCompressionContext, profile: MobilityProfile = MOBILITY_PROFILES.balanced): ElderlyRouteScore | null {
  const variants = ['shortest', 'avoid-stairs', 'elevator-priority', 'escalator-priority'] as const
  const candidates = new Map<string, ElderlyRouteScore>()
  for (const exitId of exitIds) {
    for (const preference of variants) {
      for (const candidate of findRoutesFromPlatform(graph, platformId, exitId, preference)) {
        const scored = scoreElderlyRoute(graph, candidate.origin.id, exitId, candidate.route, compressionContext)
        const key = `${candidate.origin.id}|${exitId}|${candidate.route.edges.map(edge => edge.id).join(',')}`
        candidates.set(key, scored)
      }
    }
  }
  const scores = [...candidates.values()]
  if (profile.id === 'balanced') return selectBestElderlyRoute(scores)
  return selectBestMobilityRoute(graph, scores, profile, compressionContext).selected?.score ?? null
}

export function formatElderlyRouteScore(score: ElderlyRouteScore) {
  return `階段${score.stairs}・ES${score.escalators}・EV${score.elevators}・設備乗換${score.equipmentChanges}・分岐${score.decisionPoints}・徒歩${score.distanceMeters.toFixed(1)}m`
}
