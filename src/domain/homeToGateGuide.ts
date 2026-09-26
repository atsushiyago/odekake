import type { StationOfficialGuidance } from '../data/stationOfficialGuidance'
import { findPlatformGateLevelConsensus, type IndoorGraph, type IndoorRoute } from './indoorRouting'
import { presentOfficialHomeGuidance } from './officialGuidancePresentation'
import { fareGateIdentity } from './routeOrder'
import { findSafeGateRejoin } from './safeRejoin'
import { withFareGateExitDirections, withStationGuidePresentation, withWalkDistanceInstructions } from './stationGuidePresentation'
import type { GuideStep, StationGuide } from './types'

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
}) {
  const { graph, platformId, metadata } = input
  const consensus = findPlatformGateLevelConsensus(graph, platformId, input.exitNodeIds)
  const safeRejoin = findSafeGateRejoin(graph, platformId, input.exitNodeIds, input.selectedRoute)
  const directed = withFareGateExitDirections(input.guide, graph, { enabled: input.humanizeGateDirection })
  const presentation = withWalkDistanceInstructions(directed, { enabled: input.humanizeWalkDistance })
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
  const guide = withStationGuidePresentation({ ...presentation, steps: homeStep ? [homeStep, ...detailSteps] : detailSteps })
  let number = 0
  const sections = (guide.sections ?? []).map(section => ({ ...section, steps: section.steps.map(step => ({ step, number: ++number })) }))
  const floor = input.arrivalPlatformFloor
  const arrivalFloorLabel = floor && [...graph.nodes.values()].some(node => node.parentPlatformId === platformId && node.levelIndex === floor.levelIndex) ? floor.label : undefined
  return { guide, sections, carPositionHint: official.carPositionHint, arrivalFloorLabel, safeRejoin, hiddenHomeDetails }
}

export type HomeToGateGuideModel = ReturnType<typeof buildHomeToGateGuideModel>
