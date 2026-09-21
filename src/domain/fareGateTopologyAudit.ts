import type { IndoorEdge, IndoorGraph, IndoorRoute } from './indoorRouting.ts'
import { findIndoorRoute } from './indoorRouting.ts'

export type FareGateForcedPathKind = 'simple' | 'loop' | 'none' | 'search-limit'
export interface FareGatePathSummary {
  distanceMeters: number
  edgeIds: string[]
  pathwayModes: number[]
  fareGateIds: string[]
  hasStairs: boolean
  hasEscalator: boolean
  hasElevator: boolean
  repeatedNodeIds: string[]
  repeatedEdgeIds: string[]
}
export interface FareGateRouteAudit {
  stationId: string; stationName: string; platformId: string; platformCode?: string
  boardingAreaId: string; exitId: string; exitName?: string
  shortest?: FareGatePathSummary
  forcedGate?: { kind: FareGateForcedPathKind; path?: FareGatePathSummary; distanceDeltaMeters?: number; searchStates?: number }
}
export interface FareGateGroupAudit {
  stationId: string; stationName: string; platformId: string; platformCode?: string; exitId: string; exitName?: string
  boardingAreas: FareGateRouteAudit[]
  status: 'OK' | '要確認' | '判定不能'
  anomalyReasons: string[]
}

const edgeSummary = (edges: IndoorEdge[], nodes: string[]): FareGatePathSummary => {
  const nodeCounts = new Map<string, number>()
  nodes.forEach(node => nodeCounts.set(node, (nodeCounts.get(node) ?? 0) + 1))
  const edgeCounts = new Map<string, number>()
  edges.forEach(edge => edgeCounts.set(edge.id, (edgeCounts.get(edge.id) ?? 0) + 1))
  return {
    distanceMeters: edges.reduce((sum, edge) => sum + edge.lengthMeters, 0),
    edgeIds: edges.map(edge => edge.id),
    pathwayModes: edges.map(edge => ({ walk: 1, stairs: 2, 'moving-walkway': 3, escalator: 4, elevator: 5, 'fare-gate': 6, 'exit-gate': 7 } as Record<string, number>)[edge.movementType] ?? 0),
    fareGateIds: edges.filter(edge => edge.movementType === 'fare-gate').map(edge => edge.id),
    hasStairs: edges.some(edge => edge.movementType === 'stairs'), hasEscalator: edges.some(edge => edge.movementType === 'escalator'), hasElevator: edges.some(edge => edge.movementType === 'elevator'),
    repeatedNodeIds: [...nodeCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id), repeatedEdgeIds: [...edgeCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
  }
}

const routeSummary = (route: IndoorRoute) => edgeSummary(route.edges, route.nodes.map(node => node.id))

/** A bounded best-first search over node-simple paths. */
function findSimpleFareGatePath(graph: IndoorGraph, from: string, to: string, maxStates = 20_000): { route?: IndoorRoute; states: number; limitReached: boolean } {
  type State = { node: string; distance: number; edges: IndoorEdge[]; nodes: string[] }
  const pending: State[] = [{ node: from, distance: 0, edges: [], nodes: [from] }]
  let states = 0
  while (pending.length && states < maxStates) {
    pending.sort((a, b) => a.distance - b.distance)
    const state = pending.shift()!
    states += 1
    if (state.node === to && state.edges.some(edge => edge.movementType === 'fare-gate')) return { route: { nodes: state.nodes.map(id => graph.nodes.get(id)!), edges: state.edges, distanceMeters: state.distance }, states, limitReached: false }
    for (const edge of graph.adjacency.get(state.node) ?? []) {
      if (state.nodes.includes(edge.toNodeId)) continue
      pending.push({ node: edge.toNodeId, distance: state.distance + edge.lengthMeters, edges: [...state.edges, edge], nodes: [...state.nodes, edge.toNodeId] })
    }
  }
  return { states, limitReached: pending.length > 0 }
}

/** Dijkstra on (node, gate-seen) states; it permits a loop only when the feed requires one. */
function findLoopFareGatePath(graph: IndoorGraph, from: string, to: string, maxStates = 100_000): { route?: IndoorRoute; states: number; limitReached: boolean } {
  type State = { key: string; node: string; gateSeen: boolean }
  const key = (node: string, gateSeen: boolean) => `${node}|${gateSeen ? 1 : 0}`
  const start = key(from, false), distances = new Map([[start, 0]]), previous = new Map<string, { key: string; edge: IndoorEdge }>(), pending = new Set<string>()
  for (const node of graph.nodes.keys()) { pending.add(key(node, false)); pending.add(key(node, true)) }
  let states = 0, end: string | undefined
  while (pending.size && states < maxStates) {
    let current: string | undefined
    for (const candidate of pending) if (distances.has(candidate) && (!current || distances.get(candidate)! < distances.get(current)!)) current = candidate
    if (!current) break
    pending.delete(current); states += 1
    const separator = current.lastIndexOf('|'), node = current.slice(0, separator), gateSeen = current.slice(separator + 1) === '1'
    if (node === to && gateSeen) { end = current; break }
    for (const edge of graph.adjacency.get(node) ?? []) {
      const nextGateSeen = gateSeen || edge.movementType === 'fare-gate', next = key(edge.toNodeId, nextGateSeen)
      if (!pending.has(next)) continue
      const distance = distances.get(current)! + edge.lengthMeters
      if (distance < (distances.get(next) ?? Number.POSITIVE_INFINITY)) { distances.set(next, distance); previous.set(next, { key: current, edge }) }
    }
  }
  if (!end) return { states, limitReached: pending.size > 0 && states >= maxStates }
  const edges: IndoorEdge[] = [], nodes = [to]
  for (let current = end; current !== start;) { const prior = previous.get(current); if (!prior) break; edges.unshift(prior.edge); nodes.unshift(prior.edge.fromNodeId); current = prior.key }
  return { route: { nodes: nodes.map(id => graph.nodes.get(id)!), edges, distanceMeters: distances.get(end)! }, states, limitReached: false }
}

export function auditFareGateGroup(graph: IndoorGraph, platform: { id: string; platformCode?: string }, exit: { id: string; name?: string }): FareGateGroupAudit {
  const origins = [...graph.nodes.values()].filter(node => node.kind === 'boarding-area' && node.parentPlatformId === platform.id)
  const boardingAreas = origins.map(origin => {
    const shortestRoute = findIndoorRoute(graph, origin.id, exit.id)
    const result: FareGateRouteAudit = { stationId: graph.stationId, stationName: graph.stationName, platformId: platform.id, platformCode: platform.platformCode, boardingAreaId: origin.id, exitId: exit.id, exitName: exit.name }
    if (!shortestRoute) return result
    result.shortest = routeSummary(shortestRoute)
    return result
  })
  const routable = boardingAreas.filter(item => item.shortest)
  const withGate = routable.filter(item => item.shortest!.fareGateIds.length)
  const withoutGate = routable.filter(item => !item.shortest!.fareGateIds.length)
  const gateSets = new Set(withGate.map(item => item.shortest!.fareGateIds.join(',')))
  const anomalyReasons: string[] = []
  if (withGate.length && withoutGate.length) anomalyReasons.push(`${withGate.length}/${routable.length}経路だけfare gateあり`)
  if (gateSets.size > 1) anomalyReasons.push(`fare gate pathway構成が${gateSets.size}種類`)
  if (withGate.length && withoutGate.length) for (const item of withoutGate) {
    const shortest = item.shortest!
    const simple = findSimpleFareGatePath(graph, item.boardingAreaId, exit.id)
    if (simple.route) item.forcedGate = { kind: 'simple', path: routeSummary(simple.route), distanceDeltaMeters: simple.route.distanceMeters - shortest.distanceMeters, searchStates: simple.states }
    else {
      const loop = findLoopFareGatePath(graph, item.boardingAreaId, exit.id)
      item.forcedGate = loop.route ? { kind: 'loop', path: routeSummary(loop.route), distanceDeltaMeters: loop.route.distanceMeters - shortest.distanceMeters, searchStates: loop.states } : { kind: loop.limitReached ? 'search-limit' : 'none', searchStates: loop.states }
    }
  }
  if (withoutGate.some(item => item.forcedGate?.kind === 'loop')) anomalyReasons.push('fare gate強制経路がループ')
  return { stationId: graph.stationId, stationName: graph.stationName, platformId: platform.id, platformCode: platform.platformCode, exitId: exit.id, exitName: exit.name, boardingAreas, status: !routable.length ? '判定不能' : anomalyReasons.length ? '要確認' : 'OK', anomalyReasons }
}

export function auditFareGateGraph(graph: IndoorGraph): FareGateGroupAudit[] {
  const platforms = [...graph.nodes.values()].filter(node => node.kind === 'platform')
  const exits = [...graph.nodes.values()].filter(node => node.kind === 'entrance-exit')
  return platforms.flatMap(platform => exits.map(exit => auditFareGateGroup(graph, platform, exit)))
}
