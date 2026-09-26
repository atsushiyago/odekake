import type { RouteActionSource } from './types'
import type { IndoorEdge, IndoorRoute, IndoorRouteStep } from './indoorRouting'

/** Directed topology identity, not a proximity/level/ordinal-based gate guess.
 * Parallel records with the same directed boundary represent the same crossing.
 * A Facility match inferred by the map overlay is deliberately insufficient.
 */
export function fareGateIdentity(edge: Pick<IndoorEdge, 'movementType' | 'fromNodeId' | 'toNodeId'>): string | undefined {
  if (edge.movementType !== 'fare-gate' || !edge.fromNodeId || !edge.toNodeId || edge.fromNodeId === edge.toNodeId) return undefined
  return JSON.stringify(['fare-gate', edge.fromNodeId, edge.toNodeId])
}

export function sameTraversal(left: IndoorEdge | undefined, right: IndoorEdge | undefined): boolean {
  return Boolean(left && right && left.id === right.id && left.fromNodeId === right.fromNodeId && left.toNodeId === right.toNodeId && left.movementType === right.movementType)
}

export function actionSource(route: IndoorRoute, first: number, last: number, semanticType: string): RouteActionSource {
  return {
    originNodeId: route.nodes[0].id, exitNodeId: route.nodes.at(-1)!.id,
    firstRouteIndex: first, lastRouteIndex: last, semanticType,
    traversals: route.edges.slice(first, last + 1).map(edge => ({ edgeId: edge.id, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId })),
  }
}

/** Merge only contiguous intervals belonging to the same traversal. */
export function joinActionSources(left: RouteActionSource[] | undefined, right: RouteActionSource[] | undefined, semanticType: string): RouteActionSource[] | undefined {
  if (!left || !right || left.length !== right.length) return undefined
  return left.map((source, index) => {
    const next = right[index]
    if (source.originNodeId !== next.originNodeId || source.exitNodeId !== next.exitNodeId || source.lastRouteIndex + 1 !== next.firstRouteIndex || source.traversals.at(-1)?.toNodeId !== next.traversals[0]?.fromNodeId) throw new Error('Cannot merge non-contiguous semantic actions')
    return { ...source, semanticType, lastRouteIndex: next.lastRouteIndex, traversals: [...source.traversals, ...next.traversals] }
  })
}

/** Identity is proven by directed source topology, not equipment type alone. */
export function semanticActionIdentity(step: IndoorRouteStep): string | undefined {
  if (step.type === 'fare-gate') return fareGateIdentity({ movementType: step.type, ...step.evidence })
  const traversals = step.evidence.routeOrder?.[0]?.traversals
  return traversals?.length ? JSON.stringify([step.type, step.verticalDirection, traversals]) : undefined
}
