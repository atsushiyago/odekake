import {
  MOBILITY_PROFILES, selectBestEvidenceAwareRoute,
  type MobilityProfile, type MobilityRouteCandidate, type MobilitySelectionResult,
} from './elderlyRouteScoring'
import type { RouteCost } from './routeCost'

export type ShadowCutoverSource = 'new' | 'legacy-fallback'

export interface ShadowCutoverDiagnostic {
  selectedSource: ShadowCutoverSource
  fallbackReason?: string
  newCandidateTraversal: Array<{ edgeId: string; fromNodeId: string; toNodeId: string }> | null
  legacyTraversal: Array<{ edgeId: string; fromNodeId: string; toNodeId: string }>
  routeCostDelta: Record<string, number | null> | null
  unresolvedReason?: string
  profile: MobilityProfile['id']
  newSelectionBlockedBy?: string
  comparisonBlockedBy?: string
  paperSemanticValidation?: { safe: boolean; reason?: string }
}

const routeKey = (candidate: MobilityRouteCandidate) => JSON.stringify([
  candidate.score.originId, candidate.score.exitId,
  candidate.score.route.edges.map(edge => [edge.id, edge.fromNodeId, edge.toNodeId]),
])

function traversal(candidate: MobilityRouteCandidate) {
  return candidate.score.route.edges.map(({ id, fromNodeId, toNodeId }) => ({ edgeId: id, fromNodeId, toNodeId }))
}

/** Exact evidence is required for every burden axis used by the cutover comparison. */
function unresolvedCostReasons(prefix: 'new' | 'legacy', cost: RouteCost): string[] {
  const reasons: string[] = []
  if (cost.unresolvedEquipmentGroups > 0) reasons.push(`${prefix}:unresolved-equipment-groups=${cost.unresolvedEquipmentGroups}`)
  if (cost.unresolvedEquipmentTransitions > 0) reasons.push(`${prefix}:unresolved-equipment-transitions=${cost.unresolvedEquipmentTransitions}`)
  for (const [name, value] of [
    ['stairs', cost.stairs.uses], ['escalator', cost.escalatorUses], ['elevator', cost.elevatorUses],
    ['equipment-boardings', cost.equipmentBoardings], ['walking-distance', cost.walkingMeters],
    ['total-distance', cost.totalPathwayMeters],
  ] as const) if (value === null || !Number.isFinite(value)) reasons.push(`${prefix}:unresolved-${name}`)
  return reasons
}

function routeCostDelta(newCost: RouteCost, legacyCost: RouteCost): Record<string, number | null> {
  const delta = (newValue: number | null, legacyValue: number | null) => newValue === null || legacyValue === null ? null : newValue - legacyValue
  return {
    stairs: delta(newCost.stairs.uses, legacyCost.stairs.uses),
    escalator: delta(newCost.escalatorUses, legacyCost.escalatorUses),
    elevator: delta(newCost.elevatorUses, legacyCost.elevatorUses),
    equipmentBoardings: delta(newCost.equipmentBoardings, legacyCost.equipmentBoardings),
    instanceTransfers: delta(newCost.equipmentInstanceTransfers, legacyCost.equipmentInstanceTransfers),
    equipmentTypeChanges: delta(newCost.equipmentTypeChanges, legacyCost.equipmentTypeChanges),
    walkingMeters: delta(newCost.walkingMeters, legacyCost.walkingMeters),
    totalPathwayMeters: delta(newCost.totalPathwayMeters, legacyCost.totalPathwayMeters),
    decisionPoints: delta(newCost.decisionPoints, legacyCost.decisionPoints),
    unresolvedEvidence: delta(newCost.unresolvedEquipmentGroups + newCost.unresolvedEquipmentTransitions,
      legacyCost.unresolvedEquipmentGroups + legacyCost.unresolvedEquipmentTransitions),
  }
}

function exactCostEquivalent(a: MobilityRouteCandidate, b: MobilityRouteCandidate) {
  const da = routeCostDelta(a.cost, b.cost)
  return Object.values(da).every(value => value === 0)
    && a.score.distanceMeters === b.score.distanceMeters
}

/**
 * Shadow-only gate. It does not search or mutate routes. The existing
 * evidence-aware ordering is applied first to new candidates, then to the
 * selected candidate against the legacy production route. Unknown evidence
 * required for the comparison always selects the legacy fallback.
 */
export function evaluateShadowCutover(input: {
  candidates: readonly MobilityRouteCandidate[]
  legacyCandidate: MobilityRouteCandidate
  profile?: MobilityProfile
  /** Shadow caller's check that selected traversals still render as ordered paper actions. */
  paperSemanticValidation?: { safe: boolean; reason?: string }
}): { diagnostic: ShadowCutoverDiagnostic; newSelection: MobilitySelectionResult } {
  const profile = input.profile ?? MOBILITY_PROFILES.balanced
  const legacyTraversal = traversal(input.legacyCandidate)
  const newSelection = selectBestEvidenceAwareRoute(input.candidates, profile)
  const selectedNew = newSelection.selected
  const base = {
    profile: profile.id,
    legacyTraversal,
    newCandidateTraversal: selectedNew ? traversal(selectedNew) : null,
    routeCostDelta: selectedNew ? routeCostDelta(selectedNew.cost, input.legacyCandidate.cost) : null,
    newSelectionBlockedBy: newSelection.selectionBlockedBy,
    ...(input.paperSemanticValidation ? { paperSemanticValidation: input.paperSemanticValidation } : {}),
  } as const

  const fallback = (fallbackReason: string, unresolvedReason?: string, comparisonBlockedBy?: string) => ({
    newSelection,
    diagnostic: { ...base, selectedSource: 'legacy-fallback' as const, fallbackReason,
      ...(unresolvedReason ? { unresolvedReason } : {}), ...(comparisonBlockedBy ? { comparisonBlockedBy } : {}) },
  })

  if (!selectedNew) return fallback('evidence-aware-selector-returned-no-winner',
    newSelection.selectionBlockedBy ?? 'no-valid-new-candidate')
  if (!input.paperSemanticValidation) return fallback('paper-semantic-validation-missing',
    'selected new route has not been checked against its StationGuide rendering')
  if (!input.paperSemanticValidation.safe) return fallback('paper-semantic-regression',
    input.paperSemanticValidation.reason ?? 'paper-step order or provenance could not be verified')

  const unresolved = [
    ...unresolvedCostReasons('new', selectedNew.cost),
    ...unresolvedCostReasons('legacy', input.legacyCandidate.cost),
  ]
  if (unresolved.length) return fallback('non-degradation-comparison-incomplete', unresolved.join('; '))

  const comparison = selectBestEvidenceAwareRoute([selectedNew, input.legacyCandidate], profile)
  if (!comparison.selected) return fallback('new-vs-legacy-comparison-incomparable',
    comparison.selectionBlockedBy ?? 'comparison-has-no-proven-winner', comparison.selectionBlockedBy)

  const sameDirectedRoute = routeKey(selectedNew) === routeKey(input.legacyCandidate)
  if (comparison.selected === selectedNew || sameDirectedRoute || exactCostEquivalent(selectedNew, input.legacyCandidate)) {
    return { newSelection, diagnostic: { ...base, selectedSource: 'new' } }
  }
  return fallback('new-candidate-not-selected-over-legacy', undefined, comparison.selectionBlockedBy)
}
