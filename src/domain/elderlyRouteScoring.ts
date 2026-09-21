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

function compare(a: ElderlyRouteScore, b: ElderlyRouteScore) {
  // The first three criteria are hard priorities. Distance and number of
  // equipment uses are compared normally, except that nearly-equal routes
  // may use ES as a small tie-breaker (ES is never globally preferred over EV).
  for (let i = 0; i < 3; i += 1) {
    if (a.ranking[i] !== b.ranking[i]) return a.ranking[i] - b.ranking[i]
  }
  const distanceDelta = a.distanceMeters - b.distanceMeters
  if (Math.abs(distanceDelta) <= ELDERLY_ROUTE_DISTANCE_TIE_METERS) {
    if (a.equipmentUses !== b.equipmentUses) return a.equipmentUses - b.equipmentUses
    if (a.escalators !== b.escalators) return b.escalators - a.escalators
  }
  if (distanceDelta !== 0) return distanceDelta
  if (a.equipmentUses !== b.equipmentUses) return a.equipmentUses - b.equipmentUses
  if (a.escalators !== b.escalators) return b.escalators - a.escalators
  if (a.elevators !== b.elevators) return a.elevators - b.elevators
  return a.route.edges.map(edge => edge.id).join(',').localeCompare(b.route.edges.map(edge => edge.id).join(','))
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
  return [...candidates.values()].sort(compare)[0] ?? null
}

export function formatElderlyRouteScore(score: ElderlyRouteScore) {
  return `階段${score.stairs}・ES${score.escalators}・EV${score.elevators}・設備乗換${score.equipmentChanges}・分岐${score.decisionPoints}・徒歩${score.distanceMeters.toFixed(1)}m`
}
