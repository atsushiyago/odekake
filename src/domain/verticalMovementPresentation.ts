import type { GuideStep, PathwayEnrichment, RouteActionSource, StationGuide } from './types'
import type { IndoorGraph } from './indoorRouting'

export type VerticalEquipmentKind = 'elevator' | 'escalator'
export type MovementDirection = 'up' | 'down' | 'unknown'

const formatFloorLabel = (label: string | undefined): string | undefined => {
  if (!label) return undefined
  const value = label.trim()
  if (/^地下\d+階$/.test(value) || /^地下中\d+階$/.test(value) || /^地上\d+階$/.test(value)) return value
  if (/^地上階$/.test(value) || /^(?:ground|g)$/i.test(value)) return '地上階'
  const basement = value.match(/^B(\d+)F$/i)
  if (basement) return `地下${basement[1]}階`
  const above = value.match(/^(\d+)F$/i)
  if (above) return Number(above[1]) === 1 ? '地上階' : `地上${above[1]}階`
  return undefined
}

export function formatVerticalMovementInstruction(input: {
  mode: VerticalEquipmentKind
  fromFloorLabel?: string
  toFloorLabel?: string
  movementDirection: MovementDirection
  verified: boolean
  directionAligned: boolean
  resolverMatchMethod?: 'contained' | 'intersection' | 'nearby' | 'unmatched'
}): string | undefined {
  if (!input.verified || !input.directionAligned || input.movementDirection === 'unknown'
    || input.resolverMatchMethod === 'unmatched') return undefined
  const destination = formatFloorLabel(input.toFloorLabel)
  const verb = input.movementDirection === 'up' ? '上がる' : '下りる'
  if (destination === '地上階' && input.movementDirection === 'up') return `${input.mode === 'elevator' ? 'エレベーター' : 'エスカレーター'}で地上へ${verb}`
  if (destination) return `${input.mode === 'elevator' ? 'エレベーター' : 'エスカレーター'}で${destination}へ${verb}`
  const relative = input.movementDirection === 'up' ? '上' : '下'
  return `${input.mode === 'elevator' ? 'エレベーター' : 'エスカレーター'}で${relative}の階へ進む`
}

function traversalFor(step: GuideStep, pathwayId: string) {
  return (step.evidence?.routeOrder ?? []).map(source => ({ source,
    traversal: source.traversals.find(item => item.edgeId === pathwayId),
  }))
}

function matchesWalkingDirection(item: PathwayEnrichment, fromNodeId: string, toNodeId: string) {
  const forward = fromNodeId === item.fromStopId && toNodeId === item.toStopId
  const reverse = fromNodeId === item.toStopId && toNodeId === item.fromStopId
  if (!forward && !reverse) return false
  const walkingFrom = forward ? item.walkingFromNodeId : item.walkingToNodeId
  const walkingTo = forward ? item.walkingToNodeId : item.walkingFromNodeId
  if (item.walkingDirection === 1) return true
  if (item.walkingDirection === 2) return walkingFrom === item.walkingFromNodeId && walkingTo === item.walkingToNodeId
  if (item.walkingDirection === 3) return walkingFrom === item.walkingToNodeId && walkingTo === item.walkingFromNodeId
  return false
}

interface ResolvedTraversal {
  source: RouteActionSource
  direction: Exclude<MovementDirection, 'unknown'>
  destinationLevelIndex: number
  routeOrderIndex: number
}

function resolveActionDirection(step: GuideStep, graph: IndoorGraph, expectedMode: VerticalEquipmentKind) {
  const enrichments = step.evidence?.pathwayEnrichments ?? []
  const edgeIds = [...new Set(step.evidence?.edgeIds ?? [])]
  if (!edgeIds.length || enrichments.length !== edgeIds.length) return undefined
  const enrichmentById = new Map(enrichments.map(item => [item.pathwayId, item]))
  const allResolved: ResolvedTraversal[] = []
  for (const pathwayId of edgeIds) {
    const enrichment = enrichmentById.get(pathwayId)
    if (!enrichment?.verified || enrichment.matchMethod === 'unmatched') return undefined
    const routeTraversals = traversalFor(step, pathwayId)
    if (!routeTraversals.length || routeTraversals.some(item => !item.traversal)) return undefined
    for (const { source, traversal } of routeTraversals) {
      if (!traversal || !matchesWalkingDirection(enrichment, traversal.fromNodeId, traversal.toNodeId)) return undefined
      if (enrichment.facilityKind !== expectedMode) continue
      const forward = traversal.fromNodeId === enrichment.fromStopId && traversal.toNodeId === enrichment.toStopId
      const fromFloor = forward ? enrichment.fromWalkingFloor : enrichment.toWalkingFloor
      const toFloor = forward ? enrichment.toWalkingFloor : enrichment.fromWalkingFloor
      if (fromFloor === toFloor) return undefined
      const destinationLevelIndex = graph.nodes.get(traversal.toNodeId)?.levelIndex
      if (destinationLevelIndex === undefined) return undefined
      allResolved.push({ source, direction: toFloor > fromFloor ? 'up' : 'down', destinationLevelIndex,
        routeOrderIndex: source.traversals.indexOf(traversal) })
    }
  }
  if (!allResolved.length || allResolved.some(item => item.direction !== allResolved[0].direction)) return undefined
  const perSource = new Map<RouteActionSource, ResolvedTraversal[]>()
  for (const item of allResolved) perSource.set(item.source, [...(perSource.get(item.source) ?? []), item])
  const destinationLevels = [...perSource.values()].map(items => items.sort((a, b) => a.routeOrderIndex - b.routeOrderIndex).at(-1)?.destinationLevelIndex)
  if (!destinationLevels.length || destinationLevels.some(level => level === undefined || level !== destinationLevels[0])) return undefined
  return { direction: allResolved[0].direction, destinationLevelIndex: destinationLevels[0]! }
}

/** Rewords only fully verified, direction-aligned elevator/escalator actions. */
export function withVerifiedVerticalMovementInstructions(
  guide: StationGuide,
  graph: IndoorGraph,
  officialFloorsByLevelIndex: Readonly<Record<number, { label: string; sourceUrl: string }>> = {},
): StationGuide {
  let changed = false
  const steps = guide.steps.map(step => {
    const mode = step.facility === 'elevator' ? 'elevator' : step.facility === 'escalator' ? 'escalator' : undefined
    if (!mode) return step
    const resolved = resolveActionDirection(step, graph, mode)
    if (!resolved) return step
    const instruction = formatVerticalMovementInstruction({
      mode,
      fromFloorLabel: undefined,
      toFloorLabel: officialFloorsByLevelIndex[resolved.destinationLevelIndex]?.label,
      movementDirection: resolved.direction,
      verified: true,
      directionAligned: true,
      resolverMatchMethod: step.evidence?.pathwayEnrichments?.[0]?.matchMethod,
    })
    if (!instruction || instruction === step.instruction) return step
    changed = true
    return { ...step, instruction }
  })
  return changed ? { ...guide, steps } : guide
}
