import { compactIndoorRouteSteps, findRoutesFromPlatform, routeTopologyContext, type IndoorGraph, type IndoorMovementType, type IndoorRoute, type IndoorRouteCompressionContext } from './indoorRouting'

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

/**
 * Collects the repository's existing route variants, then chooses a route
 * using transparent elderly-oriented criteria. No station or pathway IDs are
 * embedded here; official car-position wording remains separate data.
 */
export function findBestElderlyRoute(graph: IndoorGraph, platformId: string, exitIds: string[], compressionContext?: IndoorRouteCompressionContext): ElderlyRouteScore | null {
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
  return selectBestElderlyRoute([...candidates.values()])
}

export function formatElderlyRouteScore(score: ElderlyRouteScore) {
  return `階段${score.stairs}・ES${score.escalators}・EV${score.elevators}・設備乗換${score.equipmentChanges}・分岐${score.decisionPoints}・徒歩${score.distanceMeters.toFixed(1)}m`
}
