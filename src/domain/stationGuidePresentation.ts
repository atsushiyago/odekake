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
  const threshold = options.thresholdMeters ?? WALK_DISTANCE_DISPLAY_THRESHOLD_METERS
  const stride = options.strideMeters ?? WALK_STRIDE_METERS
  const steps = guide.steps.map(step => {
    const distance = step.evidence?.distanceMeters
    if (step.facility || !distance || distance < threshold || !step.instruction.startsWith('通路を')) return step
    const meters = Math.round(distance / 5) * 5
    const walks = Math.max(10, Math.ceil((distance / stride) / 10) * 10)
    return { ...step, instruction: `通路を約${meters}m（約${walks}歩）進む` }
  })
  return { ...guide, steps }
}

/** Adds a gate-following turn only when adjacent GTFS geometry passes safety checks. */
export function withFareGateExitDirections(guide: StationGuide, graph: IndoorGraph, options: { enabled?: boolean } = {}): StationGuide {
  if (!options.enabled) return guide
  const steps = guide.steps.map((step, index, all) => {
    if (step.facility !== 'gate' || !step.evidence) return step
    const decision = deriveFareGateExitDirection(graph, all[index - 1], step, all[index + 1])
    if (!decision || !decision.result) return step
    return { ...step, instruction: `改札を通ったら${decision.result === 'left' ? '左' : '右'}へ進む`, evidence: { ...step.evidence, direction: { previousNodeId: decision.previousNodeId, currentNodeId: decision.currentNodeId, nextNodeId: decision.nextNodeId, angleDegrees: decision.angleDegrees, result: decision.result, reason: decision.reason } } }
  })
  return { ...guide, steps }
}
