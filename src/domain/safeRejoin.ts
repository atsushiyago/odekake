import { findIndoorRoute, platformOriginNodes, type IndoorGraph, type IndoorRoute } from './indoorRouting'
import { actionSource, fareGateIdentity } from './routeOrder'
import type { RouteActionSource } from './types'

export type SafeRejoinResult =
  | { ok: true; identity: string; fromNodeId: string; toNodeId: string; candidateCount: number; sources: RouteActionSource[] }
  | { ok: false; reason: 'incomplete-candidates' | 'invalid-traversal' | 'missing-gate' | 'unknown-gate-identity' | 'different-gates' | 'repeated-gate' }

/** The caller must include every candidate, including an explicit null for an
 * unreachable origin. A common level or ordinal is never a rejoin proof.
 * Only the first crossing is eligible for replacing platform-to-gate detail;
 * rejoining a later gate would conceal intervening public/paid-area actions.
 */
export function proveSafeGateRejoin(routes: Array<IndoorRoute | null>): SafeRejoinResult {
  if (!routes.length || routes.some(route => !route)) return { ok: false, reason: 'incomplete-candidates' }
  const sources: RouteActionSource[] = []
  let identity: string | undefined
  let fromNodeId = '', toNodeId = ''
  for (const route of routes as IndoorRoute[]) {
    if (route.nodes.length !== route.edges.length + 1 || route.edges.some((edge, index) => edge.fromNodeId !== route.nodes[index]?.id || edge.toNodeId !== route.nodes[index + 1]?.id)) return { ok: false, reason: 'invalid-traversal' }
    const index = route.edges.findIndex(edge => edge.movementType === 'fare-gate')
    if (index < 0) return { ok: false, reason: 'missing-gate' }
    const gate = route.edges[index]
    const key = fareGateIdentity(gate)
    if (!key) return { ok: false, reason: 'unknown-gate-identity' }
    // Re-entering either side, even via a different edge, makes this boundary
    // ambiguous. Do not let an official instruction hide a loop.
    if ([gate.fromNodeId, gate.toNodeId].some(id => route.nodes.filter(node => node.id === id).length !== 1)) return { ok: false, reason: 'repeated-gate' }
    if (identity && identity !== key) return { ok: false, reason: 'different-gates' }
    identity = key
    fromNodeId = gate.fromNodeId
    toNodeId = gate.toNodeId
    sources.push(actionSource(route, index, index, 'fare-gate'))
  }
  return { ok: true, identity: identity!, fromNodeId, toNodeId, candidateCount: routes.length, sources }
}

/** Enumerate the same shortest boarding-area candidates used by consensus,
 * without dropping unreachable origins. The selected/scored route must also
 * reach that very boundary; its different equipment preference is not proof.
 */
export function findSafeGateRejoin(graph: IndoorGraph, platformId: string, exitIds: string[], selectedRoute?: IndoorRoute): SafeRejoinResult {
  const routes = exitIds.flatMap(exitId => platformOriginNodes(graph, platformId).map(origin => findIndoorRoute(graph, origin.id, exitId)))
  const proof = proveSafeGateRejoin(routes)
  if (!proof.ok || !selectedRoute) return proof
  const selectedProof = proveSafeGateRejoin([selectedRoute])
  if (!selectedProof.ok) return selectedProof
  return selectedProof.identity === proof.identity ? proof : { ok: false, reason: 'different-gates' }
}
