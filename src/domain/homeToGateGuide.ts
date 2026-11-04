import type { StationOfficialGuidance } from '../data/stationOfficialGuidance'
import { findPlatformGateLevelConsensus, platformOriginNodes, type IndoorGraph, type IndoorRoute, type IndoorRouteCompressionContext } from './indoorRouting'
import { presentOfficialHomeGuidance } from './officialGuidancePresentation'
import { fareGateIdentity } from './routeOrder'
import { findSafeGateRejoin } from './safeRejoin'
import { withFareGateExitDirections, withStationGuidePresentation, withWalkDistanceInstructions } from './stationGuidePresentation'
import type { GuideStep, StationGuide } from './types'
import { withVerifiedVerticalMovementInstructions } from './verticalMovementPresentation'

function stepBearingDegrees(step: GuideStep, graph: IndoorGraph): number | undefined {
  const fromId = step.evidence?.fromNodeId
  const toId = step.evidence?.toNodeId
  if (!fromId || !toId) return undefined
  const from = graph.nodes.get(fromId)
  const to = graph.nodes.get(toId)
  if (!from || !to) return undefined
  const dx = (to.longitude - from.longitude) * Math.cos((from.latitude * Math.PI) / 180)
  const dy = to.latitude - from.latitude
  if (Math.hypot(dx, dy) < 1e-7) return undefined
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

function isSameAxisBearing(degA: number | undefined, degB: number | undefined, maxAxisDiff = 35): boolean {
  if (degA === undefined || degB === undefined) return true
  const rawDiff = Math.abs(degA - degB) % 360
  const acuteDiff = rawDiff > 180 ? 360 - rawDiff : rawDiff
  const axisDiff = Math.min(acuteDiff, Math.abs(180 - acuteDiff))
  return axisDiff <= maxAxisDiff
}

function formatCompressedFloorDestination(label: string | undefined): string | undefined {
  if (!label) return undefined
  const value = label.trim()
  if (/^地下\d+階$/.test(value) || /^地下中\d+階$/.test(value) || /^地上\d+階$/.test(value)) {
    return value === '地上1階' ? '地上' : value
  }
  if (/^地上階?$/.test(value) || /^(?:ground|g|1f)$/i.test(value)) return '地上'
  const basement = value.match(/^B(\d+)F$/i)
  if (basement) return `地下${basement[1]}階`
  return undefined
}

export function estimatePlatformCarPositionLabel(
  graph: IndoorGraph,
  platformId: string,
  originId: string | undefined,
): string | undefined {
  if (!originId) return undefined
  const origins = platformOriginNodes(graph, platformId)
  if (origins.length < 2) return undefined
  const originNode = graph.nodes.get(originId)
  if (!originNode) return undefined

  const lats = origins.map(o => o.latitude)
  const lons = origins.map(o => o.longitude)
  const dLat = Math.max(...lats) - Math.min(...lats)
  const dLon = (Math.max(...lons) - Math.min(...lons)) * Math.cos((lats[0] * Math.PI) / 180)
  const sorted = [...origins].sort((a, b) =>
    dLat >= dLon ? a.latitude - b.latitude : a.longitude - b.longitude,
  )
  const first = sorted[0]
  const last = sorted.at(-1)!
  const totalSpan = Math.hypot(
    last.latitude - first.latitude,
    (last.longitude - first.longitude) * Math.cos((first.latitude * Math.PI) / 180),
  )
  if (totalSpan < 1e-5) return undefined

  const distFromFirst = Math.hypot(
    originNode.latitude - first.latitude,
    (originNode.longitude - first.longitude) * Math.cos((first.latitude * Math.PI) / 180),
  )
  const t = Math.max(0, Math.min(1, distFromFirst / totalSpan))

  const descendingStations = new Set(['402', '423'])
  const maxCars = ['4229', '4205', '4208', '4212', '4224', '4230'].includes(graph.stationId) ? 11 : 8
  const carNumber = descendingStations.has(graph.stationId)
    ? Math.round(maxCars - t * (maxCars - 1))
    : Math.round(1 + t * (maxCars - 1))
  const clamped = Math.max(1, Math.min(maxCars, carNumber))
  return `${clamped}号車付近`
}

function compressConsecutiveEquipmentSteps(
  steps: GuideStep[],
  graph: IndoorGraph,
  officialFloorsByLevelIndex: Readonly<Record<number, { label: string; sourceUrl: string }>> = {},
): GuideStep[] {
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
      const baseBearing = stepBearingDegrees(current, graph)
      let j = i + 1
      let lastVerticalStep = current
      let count = 1

      while (j < steps.length) {
        const next = steps[j]
        if (
          next.facility === facilityType &&
          isSameAxisBearing(baseBearing, stepBearingDegrees(next, graph))
        ) {
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
          const nextVertical = steps[j + 1]
          if (
            dist <= 15 &&
            isSameAxisBearing(baseBearing, stepBearingDegrees(nextVertical, graph))
          ) {
            lastVerticalStep = nextVertical
            count++
            j += 2
          } else {
            break
          }
        } else {
          break
        }
      }

      if (count >= 2 && j > i + 1) {
        const toLevel = lastVerticalStep.evidence?.toLevelIndex
        const fromLevel = current.evidence?.fromLevelIndex
        const isUp =
          (toLevel !== undefined && fromLevel !== undefined && toLevel > fromLevel) ||
          current.instruction.includes('上がる') ||
          lastVerticalStep.instruction.includes('上がる')
        const isDown =
          (toLevel !== undefined && fromLevel !== undefined && toLevel < fromLevel) ||
          current.instruction.includes('下りる') ||
          lastVerticalStep.instruction.includes('下りる')
        const verb = isUp ? '上がる' : isDown ? '下りる' : '進む'

        const rawFloorLabel =
          toLevel !== undefined
            ? officialFloorsByLevelIndex[toLevel]?.label ??
              (toLevel === 0 ? '地上' : undefined)
            : undefined
        const destFloor = formatCompressedFloorDestination(rawFloorLabel)
        const equipName =
          facilityType === 'escalator'
            ? 'エスカレーター'
            : facilityType === 'elevator'
            ? 'エレベーター'
            : '階段'

        const mergedInstruction = destFloor
          ? `${equipName}で${destFloor}へ${verb}`
          : lastVerticalStep.instruction.includes('地上へ') ||
            current.instruction.includes('地上へ')
          ? `${equipName}で地上へ${verb}`
          : `${equipName}で${verb}`

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

  return result.filter((step, idx) => {
    if (step.facility !== undefined || !step.instruction.startsWith('通路')) return true
    const distMatch = step.instruction.match(/約(\d+)m/)
    const dist = distMatch ? parseInt(distMatch[1], 10) : 0
    if (dist > 10) return true
    const next = result[idx + 1]
    if (
      idx === 0 &&
      next &&
      (next.facility === 'escalator' ||
        next.facility === 'elevator' ||
        next.facility === 'stairs')
    ) {
      return false
    }
    if (
      next &&
      (next.facility === 'gate' ||
        next.facility === 'exit' ||
        next.instruction.includes('へ出る'))
    ) {
      return false
    }
    return true
  })
}

/** Domain-owned paper composition. The UI never chooses a semantic boundary,
 * removes GTFS actions or decides whether an official route can be spliced in.
 */
export function buildHomeToGateGuideModel(input: {
  guide: StationGuide
  graph: IndoorGraph
  platformId: string
  exitNodeIds: string[]
  preferredExitNodeIds?: string[]
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
  const gateIdentity = gate?.evidence
    ? fareGateIdentity({
        movementType: 'fare-gate',
        fromNodeId: gate.evidence.fromNodeId ?? '',
        toNodeId: gate.evidence.toNodeId ?? '',
      })
    : undefined

  const isPreferredExit =
    !input.preferredExitNodeIds ||
    input.preferredExitNodeIds.length === 0 ||
    input.exitNodeIds.some(id => input.preferredExitNodeIds!.includes(id))

  const preferredGateRejoin =
    !isPreferredExit && input.preferredExitNodeIds
      ? findSafeGateRejoin(graph, platformId, input.preferredExitNodeIds)
      : undefined

  const sameGateAsPreferredExit =
    isPreferredExit ||
    Boolean(preferredGateRejoin?.ok && gateIdentity === preferredGateRejoin.identity)

  // A selected guide or merged guide must contain this same boundary. A union
  // of alternative gate IDs or a matching level is not sufficient evidence.
  const guideReachesRejoin = sameGateAsPreferredExit && safeRejoin.ok && gate?.evidence && gateIdentity === safeRejoin.identity && (gate.evidence.routeOrder ?? []).length > 0
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

  // For alternate routes that pass through a different gate (!sameGateAsPreferredExit or !safeRejoin.ok)
  // and have multiple pre-gate vertical segments (e.g. Shinjuku exit 4, Roppongi exit 5/6),
  // apply axis-aware and floor-aware compression across the route.
  let effectiveSteps: GuideStep[]
  if (homeStep) {
    effectiveSteps = [homeStep, ...detailSteps]
  } else if ((!safeRejoin.ok || !sameGateAsPreferredExit || !metadata) && gateIndex > 0) {
    const preGateSteps = presentation.steps.slice(0, gateIndex)
    const preGateVerticalCount = preGateSteps.filter(
      s => s.facility === 'escalator' || s.facility === 'stairs' || s.facility === 'elevator',
    ).length

    if (preGateVerticalCount >= 2 || !sameGateAsPreferredExit || !metadata) {
      effectiveSteps = compressConsecutiveEquipmentSteps(
        detailSteps,
        graph,
        input.compressionContext?.officialFloorsByLevelIndex,
      )
    } else {
      effectiveSteps = detailSteps
    }
  } else {
    effectiveSteps = detailSteps
  }

  const shouldUseDynamicCarPosition =
    Boolean(input.selectedRoute) &&
    (!isPreferredExit || !official.carPositionLabel) &&
    !useHomeInstruction

  const dynamicCarLabel = shouldUseDynamicCarPosition
    ? estimatePlatformCarPositionLabel(
        graph,
        platformId,
        input.selectedRoute?.nodes[0]?.id,
      )
    : undefined

  const carPositionLabel = dynamicCarLabel ?? official.carPositionLabel
  const carPositionHint = dynamicCarLabel
    ? `できれば${dynamicCarLabel}に乗る`
    : official.carPositionHint

  const guide = withStationGuidePresentation({ ...presentation, steps: effectiveSteps })
  let number = 0
  const sections = (guide.sections ?? []).map(section => ({ ...section, steps: section.steps.map(step => ({ step, number: ++number })) }))
  const floor = input.arrivalPlatformFloor
  const arrivalFloorLabel = floor && [...graph.nodes.values()].some(node => node.parentPlatformId === platformId && node.levelIndex === floor.levelIndex) ? floor.label : undefined
  return {
    guide,
    sections,
    carPositionLabel,
    carPositionHint,
    arrivalFloorLabel,
    safeRejoin,
    hiddenHomeDetails,
  }
}

export type HomeToGateGuideModel = ReturnType<typeof buildHomeToGateGuideModel>
