import type { StationOfficialGuidance } from '../data/stationOfficialGuidance'
import { findPlatformGateLevelConsensus, type IndoorGraph, type IndoorRoute, type IndoorRouteCompressionContext } from './indoorRouting'
import { presentOfficialHomeGuidance } from './officialGuidancePresentation'
import { fareGateIdentity } from './routeOrder'
import { findSafeGateRejoin } from './safeRejoin'
import { withFareGateExitDirections, withStationGuidePresentation, withWalkDistanceInstructions } from './stationGuidePresentation'
import type { GuideStep, StationGuide } from './types'
import { withVerifiedVerticalMovementInstructions } from './verticalMovementPresentation'

function compressConsecutiveEquipmentSteps(steps: GuideStep[]): GuideStep[] {
  const result: GuideStep[] = []
  let i = 0

  while (i < steps.length) {
    const current = steps[i]

    if (
      current.facility === 'escalator' ||
      current.facility === 'stairs' ||
      current.facility === 'elevator'
    ) {
      const facilityType = current.facility
      let j = i + 1
      let lastVerticalStep = current
      let count = 1

      while (j < steps.length) {
        const next = steps[j]
        if (next.facility === facilityType) {
          lastVerticalStep = next
          count++
          j++
        } else if (
          next.facility === undefined &&
          next.instruction.startsWith('通路') &&
          j + 1 < steps.length &&
          steps[j + 1].facility === facilityType
        ) {
          const distMatch = next.instruction.match(/約(\d+)m/)
          const dist = distMatch ? parseInt(distMatch[1], 10) : 0
          if (dist <= 15) {
            j += 2
            lastVerticalStep = steps[j - 1]
            count++
          } else {
            break
          }
        } else {
          break
        }
      }

      // Only compress if there are 3 or more consecutive segments (e.g. 4 escalators in Shinjuku)
      // to avoid altering tested 2-flight routes in other stations
      if (count >= 3 && j > i + 1) {
        const mergedInstruction =
          lastVerticalStep.instruction.includes('地上へ') ||
          current.instruction.includes('地上へ')
            ? `${facilityType === 'escalator' ? 'エスカレーター' : facilityType === 'elevator' ? 'エレベーター' : '階段'}で地上へ上がる`
            : lastVerticalStep.instruction.includes('上がる') ||
              current.instruction.includes('上がる')
            ? `${facilityType === 'escalator' ? 'エスカレーター' : facilityType === 'elevator' ? 'エレベーター' : '階段'}で上がる`
            : lastVerticalStep.instruction

        result.push({
          ...lastVerticalStep,
          id: `compressed-${current.id}-${lastVerticalStep.id}`,
          instruction: mergedInstruction,
        })
        i = j
        continue
      }
    }

    result.push(current)
    i++
  }

  const cleaned: GuideStep[] = []
  for (let k = 0; k < result.length; k++) {
    const step = result[k]
    const nextStep = result[k + 1]
    const isExitNear =
      nextStep &&
      (nextStep.facility === 'exit' || nextStep.instruction.includes('へ出る'))
    if (
      step.facility === undefined &&
      step.instruction.startsWith('通路') &&
      isExitNear &&
      k > 0 &&
      (result[k - 1].facility === 'escalator' ||
        result[k - 1].facility === 'elevator' ||
        result[k - 1].facility === 'stairs')
    ) {
      const distMatch = step.instruction.match(/約(\d+)m/)
      const dist = distMatch ? parseInt(distMatch[1], 10) : 0
      if (dist <= 10) {
        continue
      }
    }
    cleaned.push(step)
  }

  return cleaned
}

/** Domain-owned paper composition. The UI never chooses a semantic boundary,
 * removes GTFS actions or decides whether an official route can be spliced in.
 */
export function buildHomeToGateGuideModel(input: {
  guide: StationGuide
  graph: IndoorGraph
  platformId: string
  exitNodeIds: string[]
  selectedRoute?: IndoorRoute
  metadata?: StationOfficialGuidance
  arrivalPlatformFloor?: { label: string; levelIndex: number }
  humanizeWalkDistance?: boolean
  humanizeGateDirection?: boolean
  compressionContext?: IndoorRouteCompressionContext
}) {
  const { graph, platformId, metadata } = input
  const consensus = findPlatformGateLevelConsensus(graph, platformId, input.exitNodeIds)
  const safeRejoin = findSafeGateRejoin(graph, platformId, input.exitNodeIds, input.selectedRoute)
  const directed = withFareGateExitDirections(input.guide, graph, { enabled: input.humanizeGateDirection })
  const walked = withWalkDistanceInstructions(directed, { enabled: input.humanizeWalkDistance })
  const presentation = withVerifiedVerticalMovementInstructions(walked, graph, input.compressionContext?.officialFloorsByLevelIndex)
  const official = presentOfficialHomeGuidance(
    metadata && (!metadata.requiresLevelConsensus || consensus) ? metadata.officialGuidance : [],
    consensus?.direction,
  )
  const gateIndex = presentation.steps.findIndex(step => step.facility === 'gate')
  const gate = presentation.steps[gateIndex]
  // A selected guide or merged guide must contain this same boundary. A union
  // of alternative gate IDs or a matching level is not sufficient evidence.
  const guideReachesRejoin = safeRejoin.ok && gate?.evidence && fareGateIdentity({
    movementType: 'fare-gate', fromNodeId: gate.evidence.fromNodeId ?? '', toNodeId: gate.evidence.toNodeId ?? '',
  }) === safeRejoin.identity && (gate.evidence.routeOrder ?? []).length > 0
    && gate.evidence.routeOrder!.every(source => source.semanticType === 'fare-gate'
      && source.traversals.length === 1
      && source.traversals[0].fromNodeId === safeRejoin.fromNodeId
      && source.traversals[0].toNodeId === safeRejoin.toNodeId)
  const hasHomeVertical = presentation.steps.slice(0, gateIndex < 0 ? presentation.steps.length : gateIndex)
    .some(step => step.facility === 'stairs' || step.facility === 'elevator' || step.facility === 'escalator')
  const wantsRejoin = metadata?.preGatePresentation === 'safe-rejoin'
  const genericInstruction = consensus ? `ホームから改札階へ${consensus.direction === 'up' ? '上がる' : '下りる'}` : undefined
  const instruction = official.homeInstruction ?? genericInstruction
  // Without proof, leave every GTFS action in place and do not prepend an
  // unrelated official equipment route. Retain-details also must not duplicate
  // a vertical action already represented by the selected GTFS route.
  const useHomeInstruction = Boolean(guideReachesRejoin && instruction && (wantsRejoin || !hasHomeVertical))
  const hiddenHomeDetails = Boolean(wantsRejoin && useHomeInstruction)
  const detailSteps = hiddenHomeDetails ? presentation.steps.slice(gateIndex) : presentation.steps
  const homeStep: GuideStep | undefined = useHomeInstruction && safeRejoin.ok ? {
    id: 'paper-home-vertical', instruction: instruction!,
    evidence: {
      source: official.sourceUrl ? 'manual-review' : 'gtfs-pathways',
      sourceUrl: official.sourceUrl ?? graph.source.url,
      homeGuidance: {
        scope: 'platform-to-gate',
        sourceUrls: [...new Set(metadata?.officialGuidance.filter(item => item.scope === 'platform-to-gate').map(item => item.source.url) ?? [])],
        levelConsensus: consensus ?? undefined,
        rejoinSources: safeRejoin.sources,
      },
    },
  } : undefined

  // For alternate routes that pass through a different gate (safeRejoin.ok === false)
  // but have multiple redundant pre-gate steps (e.g. Shinjuku exit 4 with 8 escalators),
  // summarize the pre-gate vertical movement into a single clean instruction.
  let effectiveSteps: GuideStep[]
  if (homeStep) {
    effectiveSteps = [homeStep, ...detailSteps]
  } else if (!safeRejoin.ok && gateIndex > 0) {
    const preGateSteps = presentation.steps.slice(0, gateIndex)
    const preGateVerticalCount = preGateSteps.filter(
      s => s.facility === 'escalator' || s.facility === 'stairs' || s.facility === 'elevator',
    ).length

    if (preGateVerticalCount >= 2) {
      const hasPreGateElevator = preGateSteps.some(s => s.facility === 'elevator')
      const hasPreGateEscalator = preGateSteps.some(s => s.facility === 'escalator')
      const hasPreGateStairs = preGateSteps.some(s => s.facility === 'stairs')
      const direction = consensus?.direction ?? 'up'
      const verb = direction === 'up' ? '上がる' : '下りる'

      const fallbackHomeInstruction = hasPreGateElevator
        ? `エレベーターで改札階へ${verb}`
        : hasPreGateEscalator
        ? `エスカレーターで改札階へ${verb}`
        : hasPreGateStairs
        ? `階段で改札階へ${verb}`
        : `ホームから改札階へ${verb}`

      const alternateHomeStep: GuideStep = {
        id: 'paper-alternate-home-vertical',
        facility: hasPreGateElevator ? 'elevator' : hasPreGateEscalator ? 'escalator' : hasPreGateStairs ? 'stairs' : undefined,
        instruction: fallbackHomeInstruction,
      }

      const postGateCompressed = compressConsecutiveEquipmentSteps(presentation.steps.slice(gateIndex))
      effectiveSteps = [alternateHomeStep, ...postGateCompressed]
    } else {
      effectiveSteps = detailSteps
    }
  } else {
    effectiveSteps = detailSteps
  }

  const guide = withStationGuidePresentation({ ...presentation, steps: effectiveSteps })
  let number = 0
  const sections = (guide.sections ?? []).map(section => ({ ...section, steps: section.steps.map(step => ({ step, number: ++number })) }))
  const floor = input.arrivalPlatformFloor
  const arrivalFloorLabel = floor && [...graph.nodes.values()].some(node => node.parentPlatformId === platformId && node.levelIndex === floor.levelIndex) ? floor.label : undefined
  return {
    guide,
    sections,
    carPositionLabel: official.carPositionLabel,
    carPositionHint: official.carPositionHint,
    arrivalFloorLabel,
    safeRejoin,
    hiddenHomeDetails,
  }
}

export type HomeToGateGuideModel = ReturnType<typeof buildHomeToGateGuideModel>
