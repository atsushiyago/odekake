import type { GuideSection, GuideStep, StationGuide, StationGuideSummary } from './types'
import { deriveFareGateExitDirection, WALK_DISTANCE_DISPLAY_THRESHOLD_METERS, WALK_STRIDE_METERS, type IndoorGraph } from './indoorRouting'

function isConfirmedFareGate(step: GuideStep) {
  if (step.facility !== 'gate') return false
  const coverage = step.evidence?.candidateCoverage
  return step.evidence?.source === 'manual-review' || Boolean(coverage && (coverage.matchingOrigins === coverage.totalOrigins || coverage.allRoutesHaveEvent))
}

/** Counts the already-compressed semantic steps, not raw GTFS edges. */
export function summarizeStationGuide(guide: StationGuide): StationGuideSummary {
  const counts = { stairsCount: 0, escalatorCount: 0, elevatorCount: 0, fareGateCount: 0 }
  const countedFacilities = new Set<string>()
  const aggregateGateStep = guide.steps.find(step => step.facility === 'gate' && step.evidence?.candidateCoverage?.allRoutesHaveEvent && step.evidence?.candidateCoverage?.aggregateCount !== undefined)
  const aggregateGate = Boolean(aggregateGateStep)
  guide.steps.forEach(step => {
    if (!step.facility || step.facility === 'exit') return
    const key = step.evidence?.mapLocations?.map(location => location.facilityId).find(Boolean) ?? step.id
    if (countedFacilities.has(`${step.facility}:${key}`)) return
    countedFacilities.add(`${step.facility}:${key}`)
    if (step.facility === 'stairs') counts.stairsCount += 1
    if (step.facility === 'escalator') counts.escalatorCount += 1
    if (step.facility === 'elevator') counts.elevatorCount += 1
    if (step.facility === 'gate' && isConfirmedFareGate(step)) {
      if (!aggregateGate) counts.fareGateCount += 1
    }
  })
  if (aggregateGate) counts.fareGateCount = aggregateGateStep?.evidence?.candidateCoverage?.aggregateCount ?? 0
  return counts
}

/** User-facing wording for the number of confirmed semantic fare-gate events. */
export function formatFareGateSummary(fareGateCount: number): string | undefined {
  if (fareGateCount <= 0) return undefined
  return fareGateCount === 1 ? '改札あり' : `改札${fareGateCount}回`
}

/**
 * Builds the user-facing equipment summary from the steps actually printed
 * after the fare gate. This deliberately does not alter the internal GTFS
 * summary or deduplicate facilities: one printed semantic action counts once.
 */
export function summarizeVisiblePostGateSteps(steps: GuideStep[]): string | undefined {
  const counts = { stairs: 0, escalator: 0, elevator: 0 }
  steps.forEach(step => {
    if (step.facility === 'stairs') counts.stairs += 1
    if (step.facility === 'escalator') counts.escalator += 1
    if (step.facility === 'elevator') counts.elevator += 1
  })
  return [
    counts.stairs && `階段${counts.stairs}回`,
    counts.escalator && `エスカレーター${counts.escalator}回`,
    counts.elevator && `エレベーター${counts.elevator}回`,
  ].filter(Boolean).join('・') || undefined
}

/** Counts fare-gate actions that are actually printed on the paper. */
export function countVisibleFareGateSteps(steps: GuideStep[]): number {
  return steps.filter(step => step.facility === 'gate' && step.instruction.includes('改札')).length
}

/** Groups details around confirmed semantic events, with a safe fallback for uncertain gates. */
export function buildStationGuideSections(guide: StationGuide): GuideSection[] {
  const exitIndex = guide.steps.findIndex(step => step.facility === 'exit')
  const bodyEnd = exitIndex >= 0 ? exitIndex : guide.steps.length
  const gateIndex = guide.steps.findIndex((step, index) => index < bodyEnd && isConfirmedFareGate(step))
  const sections: GuideSection[] = []
  const push = (id: string, title: string, steps: GuideStep[]) => { if (steps.length) sections.push({ id, title, steps }) }
  if (gateIndex >= 0) {
    push('platform-to-gate', 'ホームから改札へ', guide.steps.slice(0, gateIndex + 1))
    push('gate-to-exit', '改札から出口へ', guide.steps.slice(gateIndex + 1, bodyEnd))
  } else {
    push('platform-to-exit', 'ホームから出口へ', guide.steps.slice(0, bodyEnd))
  }
  if (exitIndex >= 0) push('to-ground', '地上へ', guide.steps.slice(exitIndex))
  return sections
}

export function withStationGuidePresentation(guide: StationGuide): StationGuide {
  return { ...guide, summary: summarizeStationGuide(guide), sections: buildStationGuideSections(guide) }
}

/**
 * Optional paper wording experiment. It only changes human-facing wording;
 * route edges, semantic steps, sections and evidence remain untouched.
 */
export function withWalkDistanceInstructions(guide: StationGuide, options: { enabled?: boolean; thresholdMeters?: number; strideMeters?: number } = {}): StationGuide {
  if (!options.enabled) return guide
  const stride = options.strideMeters ?? WALK_STRIDE_METERS
  const steps = guide.steps.map(step => {
    const distance = step.evidence?.distanceMeters
    if (step.facility || !distance || distance <= 0 || !step.instruction.startsWith('通路を')) return step
    const meters = distance < (options.thresholdMeters ?? WALK_DISTANCE_DISPLAY_THRESHOLD_METERS)
      ? Math.max(1, Math.round(distance))
      : Math.round(distance / 5) * 5
    const walks = distance < (options.thresholdMeters ?? WALK_DISTANCE_DISPLAY_THRESHOLD_METERS)
      ? Math.max(5, Math.ceil((distance / stride) / 5) * 5)
      : Math.max(10, Math.ceil((distance / stride) / 10) * 10)
    return { ...step, instruction: `通路を約${meters}m（約${walks}歩）進む` }
  })
  return { ...guide, steps }
}

const directionInstruction: Record<'left' | 'right' | 'straight', string> = {
  left: '左へ進む', right: '右へ進む', straight: 'まっすぐ進む',
}

/**
 * A turn can be separated from a gate only when the actual directed route
 * proves a contiguous walk → gate → walk sequence for every represented
 * candidate. The turn is a zero-length semantic event at the boundary; the
 * adjacent steps keep ownership of their pathway traversals.
 */
function gateMovementRouteContext(before: GuideStep | undefined, gate: GuideStep, after: GuideStep, decision: NonNullable<ReturnType<typeof deriveFareGateExitDirection>>) {
  const beforeSources = before?.evidence?.routeOrder ?? []
  const gateSources = gate.evidence?.routeOrder ?? []
  const afterSources = after.evidence?.routeOrder ?? []
  if (!before || before.facility || after.facility || beforeSources.length === 0 || gateSources.length === 0 || afterSources.length === 0) return undefined
  if (gate.evidence?.fromNodeId !== decision.currentNodeId || after.evidence?.toNodeId !== decision.nextNodeId) return undefined

  const contexts: NonNullable<NonNullable<GuideStep['evidence']>['direction']>['routeContext'] = []
  for (const gateSource of gateSources) {
    const matching = (sources: typeof beforeSources) => sources.filter(source => source.originNodeId === gateSource.originNodeId && source.exitNodeId === gateSource.exitNodeId)
    const [approach] = matching(beforeSources)
    const [movement] = matching(afterSources)
    if (matching(beforeSources).length !== 1 || matching(afterSources).length !== 1 || !approach || !movement) return undefined
    const gateTraversal = gateSource.traversals.length === 1 ? gateSource.traversals[0] : undefined
    const approachStart = approach.traversals[0]
    const approachEnd = approach.traversals.at(-1)
    const movementTraversal = movement.traversals[0]
    if (!gateTraversal || gateSource.semanticType !== 'fare-gate' || approach.semanticType !== 'walk' || movement.semanticType !== 'walk') return undefined
    if (approach.lastRouteIndex - approach.firstRouteIndex !== approach.traversals.length - 1
      || gateSource.lastRouteIndex !== gateSource.firstRouteIndex
      || movement.lastRouteIndex - movement.firstRouteIndex !== movement.traversals.length - 1) return undefined
    if (approach.lastRouteIndex + 1 !== gateSource.firstRouteIndex || gateSource.lastRouteIndex + 1 !== movement.firstRouteIndex) return undefined
    if (gateTraversal.fromNodeId !== gate.evidence?.fromNodeId || gateTraversal.toNodeId !== gate.evidence?.toNodeId) return undefined
    if (approachStart?.fromNodeId !== decision.previousNodeId || approachEnd?.toNodeId !== gateTraversal.fromNodeId
      || movementTraversal?.fromNodeId !== gateTraversal.toNodeId || movement.traversals.at(-1)?.toNodeId !== decision.nextNodeId) return undefined
    contexts.push({
      originNodeId: gateSource.originNodeId,
      exitNodeId: gateSource.exitNodeId,
      approachRouteIndex: approach.lastRouteIndex,
      gateRouteIndex: gateSource.firstRouteIndex,
      movementRouteIndex: movement.firstRouteIndex,
    })
  }
  return contexts.length === gateSources.length ? contexts : undefined
}

/** Splits a proven post-gate turn into its own semantic action, without moving route traversals between steps. */
export function withFareGateExitDirections(guide: StationGuide, graph: IndoorGraph, options: { enabled?: boolean } = {}): StationGuide {
  if (!options.enabled) return guide
  const steps: GuideStep[] = []
  guide.steps.forEach((step, index, all) => {
    if (step.facility !== 'gate' || !step.evidence || all[index + 1]?.id === `${step.id}-post-gate-movement`) {
      steps.push(step)
      return
    }
    const before = all[index - 1]
    const after = all[index + 1]
    const decision = deriveFareGateExitDirection(graph, before, step, after)
    const routeContext = decision?.result && after ? gateMovementRouteContext(before, step, after, decision) : undefined
    if (!decision?.result || !routeContext || !after) {
      steps.push(step)
      return
    }

    const gateEvidence = { ...step.evidence }
    delete gateEvidence.direction
    steps.push({
      ...step,
      instruction: step.evidence.officialFloor ? `${step.evidence.officialFloor.label}の改札を通る` : '改札を通る',
      evidence: gateEvidence,
    })
    steps.push({
      id: `${step.id}-post-gate-movement`,
      instruction: directionInstruction[decision.result],
      evidence: {
        source: after.evidence?.source ?? step.evidence.source,
        sourceUrl: after.evidence?.sourceUrl ?? step.evidence.sourceUrl,
        fromNodeId: step.evidence.toNodeId,
        toNodeId: decision.nextNodeId,
        direction: {
          previousNodeId: decision.previousNodeId,
          currentNodeId: decision.currentNodeId,
          nextNodeId: decision.nextNodeId,
          angleDegrees: decision.angleDegrees,
          result: decision.result,
          reason: decision.reason,
          routeContext,
        },
      },
    })
  })
  return { ...guide, steps }
}
