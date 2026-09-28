import type { EquipmentSessionProof, RouteCost } from './routeCost'
import { computeRouteCost } from './routeCost'
import {
  resolveVerticalDirection, type FacilityMappingEvidence, type IndoorGraph, type IndoorRoute,
  type IndoorRouteCompressionContext, type IndoorMovementType, type VerticalDirection,
} from './indoorRouting'
import { resolveEquipmentSessionBridge, type EquipmentSessionBridgeData, type EquipmentSessionMappingChain } from './equipmentSessionBridge'

const equipmentTypes = new Set<IndoorMovementType>(['stairs', 'escalator', 'elevator'])
const strongMethods = new Set<FacilityMappingEvidence['method']>(['direct', 'geometry-intersection'])

/**
 * A physical instance identity is strong only when the source explicitly binds
 * the pathway to a Facility or geometry-intersects it. Nearest matches and
 * proximity groups remain useful display evidence, never session proof.
 */
export const EQUIPMENT_EVIDENCE_HIERARCHY = {
  strongIdentity: ['direct pathway-to-facility binding', 'geometry intersection binding'],
  supporting: ['nearest Facility assignment', 'route continuity', 'same equipment type', 'direction consensus'],
  insufficient: ['Facility group', 'Space', 'Floor/level', 'proximity', 'type-only', 'presentation grouping'],
} as const

export interface EquipmentSessionEvidence {
  equipmentType: 'stairs' | 'escalator' | 'elevator'
  firstRouteIndex: number
  lastRouteIndex: number
  edgeIds: string[]
  connectorRouteIndices: number[]
  facilityCandidates: string[]
  identitySourceUrls: string[]
  mappingMethods: string[]
  direction: VerticalDirection
  status: 'confirmed' | 'unresolved'
  unresolvedReason?: 'missing-route-order' | 'invalid-route-span' | 'unmapped-traversal'
    | 'weak-facility-mapping' | 'missing-facility-identity' | 'multiple-facility-identities'
    | 'source-namespace-mismatch' | 'unsupported-span-edge' | 'connector-level-unproven'
  proof?: EquipmentSessionProof
  /** Full GTFS → walking-link → Facility provenance when produced via the bridge layer. */
  bridgeChains?: EquipmentSessionMappingChain[]
}

export interface EquipmentInstanceTransitionEvidence {
  fromSessionIndex: number
  toSessionIndex: number
  routeIndices: [number, number]
  result: 'same-instance' | 'distinct-instances' | 'unresolved'
  reason: string
  evidenceSources: string[]
}

export interface EquipmentSessionProofBuildResult {
  sessions: EquipmentSessionEvidence[]
  proofs: EquipmentSessionProof[]
  unresolved: EquipmentSessionEvidence[]
  instanceTransitions: EquipmentInstanceTransitionEvidence[]
}

function mappingFor(context: IndoorRouteCompressionContext | undefined, edgeId: string, routeIndex?: number,
  bridgeMappings?: ReadonlyMap<number, NonNullable<IndoorRouteCompressionContext['byPathwayId'][string]>>) {
  return (routeIndex === undefined ? undefined : bridgeMappings?.get(routeIndex)) ?? context?.byPathwayId[edgeId]
}

function proveSpan(route: IndoorRoute, graph: IndoorGraph, context: IndoorRouteCompressionContext | undefined,
  span: { first: number; last: number }, type: EquipmentSessionEvidence['equipmentType'],
  bridgeMappings?: ReadonlyMap<number, NonNullable<IndoorRouteCompressionContext['byPathwayId'][string]>>): EquipmentSessionEvidence {
  const base = {
    equipmentType: type,
    firstRouteIndex: span.first,
    lastRouteIndex: span.last,
    edgeIds: route.edges.slice(span.first, span.last + 1).map(edge => edge.id),
    connectorRouteIndices: [] as number[],
    facilityCandidates: [] as string[],
    identitySourceUrls: [] as string[],
    mappingMethods: [] as string[],
    direction: 'unknown' as VerticalDirection,
  }
  const unresolved = (reason: NonNullable<EquipmentSessionEvidence['unresolvedReason']>, details: Partial<EquipmentSessionEvidence> = {}): EquipmentSessionEvidence => ({ ...base, ...details, status: 'unresolved', unresolvedReason: reason })
  if (!Number.isInteger(span.first) || !Number.isInteger(span.last) || span.first < 0
    || span.last >= route.edges.length || span.last < span.first) return unresolved('invalid-route-span')
  const routeEdges = route.edges.slice(span.first, span.last + 1)
  if (routeEdges.some((edge, offset) => edge.fromNodeId !== route.nodes[span.first + offset]?.id
    || edge.toNodeId !== route.nodes[span.first + offset + 1]?.id)) return unresolved('invalid-route-span')

  const mappings = routeEdges.map((edge, offset) => ({ edge, index: span.first + offset, mapping: mappingFor(context, edge.id, span.first + offset, bridgeMappings) }))
  if (mappings.some(item => !item.mapping?.facilityId)) return unresolved('unmapped-traversal', {
    ...base, facilityCandidates: [...new Set(mappings.flatMap(item => item.mapping?.facilityId ? [item.mapping.facilityId] : []))],
    mappingMethods: [...new Set(mappings.flatMap(item => item.mapping?.facilityMapping?.method ? [item.mapping.facilityMapping.method] : []))],
  })
  if (mappings.some(item => !item.mapping?.facilityMapping || item.mapping.facilityMapping.identityStrength !== 'strong'
    || !strongMethods.has(item.mapping.facilityMapping.method))) return unresolved('weak-facility-mapping', {
    ...base, facilityCandidates: [...new Set(mappings.flatMap(item => item.mapping?.facilityId ? [item.mapping.facilityId] : []))],
    mappingMethods: [...new Set(mappings.flatMap(item => item.mapping?.facilityMapping?.method ? [item.mapping.facilityMapping.method] : []))],
  })
  const ids = [...new Set(mappings.map(item => item.mapping!.facilityId!))]
  if (ids.length !== 1) return unresolved('multiple-facility-identities', {
    ...base, facilityCandidates: ids,
    identitySourceUrls: [...new Set(mappings.flatMap(item => item.mapping?.facilityMapping?.sourceUrl ? [item.mapping.facilityMapping.sourceUrl] : []))],
    mappingMethods: [...new Set(mappings.flatMap(item => item.mapping?.facilityMapping?.method ? [item.mapping.facilityMapping.method] : []))],
  })
  const sourceUrls = [...new Set(mappings.map(item => item.mapping!.facilityMapping!.sourceUrl?.trim() ?? ''))]
  if (sourceUrls.some(source => !source)) return unresolved('missing-facility-identity', {
    ...base, facilityCandidates: ids, mappingMethods: [...new Set(mappings.map(item => item.mapping!.facilityMapping!.method))],
  })
  if (sourceUrls.length !== 1) return unresolved('source-namespace-mismatch', {
    ...base, facilityCandidates: ids, identitySourceUrls: sourceUrls,
    mappingMethods: [...new Set(mappings.map(item => item.mapping!.facilityMapping!.method))],
  })

  const connectors: number[] = []
  for (const item of mappings) {
    if (item.edge.movementType === type) continue
    if (item.edge.movementType !== 'walk') return unresolved('unsupported-span-edge', {
      ...base, facilityCandidates: ids, identitySourceUrls: sourceUrls,
      mappingMethods: [...new Set(mappings.map(entry => entry.mapping!.facilityMapping!.method))],
    })
    const from = graph.nodes.get(item.edge.fromNodeId)?.levelIndex
    const to = graph.nodes.get(item.edge.toNodeId)?.levelIndex
    if (from === undefined || to === undefined || !Number.isFinite(from) || from !== to) return unresolved('connector-level-unproven', {
      ...base, facilityCandidates: ids, identitySourceUrls: sourceUrls,
      mappingMethods: [...new Set(mappings.map(entry => entry.mapping!.facilityMapping!.method))],
    })
    connectors.push(item.index)
  }
  if (!mappings.some(item => item.edge.movementType === type)) return unresolved('unsupported-span-edge')

  const verticalDirections = mappings.filter(item => item.edge.movementType === type)
    .map(item => resolveVerticalDirection(graph.nodes.get(item.edge.fromNodeId)?.levelIndex, graph.nodes.get(item.edge.toNodeId)?.levelIndex))
  const direction = verticalDirections.length > 0 && verticalDirections.every(item => item === verticalDirections[0])
    ? verticalDirections[0] : 'unknown'

  const instanceKey = JSON.stringify([sourceUrls[0], ids[0]])
  const proof: EquipmentSessionProof = {
    firstRouteIndex: span.first, lastRouteIndex: span.last, instanceKey,
    source: `${mappings[0].mapping!.facilityMapping!.method}:${sourceUrls[0]}`,
    basis: 'explicit-equipment-session', connectorRouteIndices: connectors,
  }
  return {
    ...base, direction, connectorRouteIndices: connectors, facilityCandidates: ids, identitySourceUrls: sourceUrls,
    mappingMethods: [...new Set(mappings.map(item => item.mapping!.facilityMapping!.method))],
    status: 'confirmed', proof,
  }
}

/** Find same-type equipment spans from the raw route itself, not presentation actions. */
function candidateSpans(route: IndoorRoute) {
  const result: Array<{ first: number; last: number; type: EquipmentSessionEvidence['equipmentType'] }> = []
  for (let index = 0; index < route.edges.length;) {
    const edge = route.edges[index]
    if (!equipmentTypes.has(edge.movementType)) { index += 1; continue }
    const type = edge.movementType as EquipmentSessionEvidence['equipmentType']
    let last = index
    while (last + 1 < route.edges.length) {
      const next = route.edges[last + 1]
      if (next.movementType === type) { last += 1; continue }
      if (next.movementType === 'walk') {
        let nextEquipment = last + 2
        while (nextEquipment < route.edges.length && route.edges[nextEquipment].movementType === 'walk') nextEquipment += 1
        if (nextEquipment < route.edges.length && route.edges[nextEquipment].movementType === type) { last = nextEquipment; continue }
      }
      break
    }
    result.push({ first: index, last, type })
    index = last + 1
  }
  return result
}

/**
 * Build RouteCost-compatible session proofs from raw ordered traversals and
 * explicitly strong Facility bindings. Human-facing compression only identifies
 * candidate spans; it cannot upgrade weak or missing mapping provenance.
 */
export function buildEquipmentSessionProofs(route: IndoorRoute, graph: IndoorGraph,
  compression?: IndoorRouteCompressionContext, bridgeMappings?: ReadonlyMap<number, NonNullable<IndoorRouteCompressionContext['byPathwayId'][string]>>,
  bridgeChains?: ReadonlyMap<number, EquipmentSessionMappingChain>): EquipmentSessionProofBuildResult {
  const candidateGroups = candidateSpans(route)
  const sessions: EquipmentSessionEvidence[] = []
  for (const group of candidateGroups) {
    const groupResult = proveSpan(route, graph, compression, group, group.type, bridgeMappings)
    const groupChains = [...Array(group.last - group.first + 1)].map((_, offset) => bridgeChains?.get(group.first + offset)).filter((item): item is EquipmentSessionMappingChain => Boolean(item))
    if (groupChains.length) groupResult.bridgeChains = groupChains
    if (group.first === group.last || groupResult.status === 'confirmed') {
      sessions.push(groupResult)
      continue
    }
    const equipmentIndices = route.edges.flatMap((edge, index) => index >= group.first && index <= group.last && edge.movementType === group.type ? [index] : [])
      const equipmentMappings = equipmentIndices.map(index => mappingFor(compression, route.edges[index].id, index, bridgeMappings))
    const explicitDistinctEquipmentIds = equipmentMappings.every(mapping => Boolean(mapping?.facilityId
      && mapping.facilityMapping?.identityStrength === 'strong' && strongMethods.has(mapping.facilityMapping.method)
      && mapping.facilityMapping.sourceUrl?.trim()))
      && new Set(equipmentMappings.map(mapping => mapping!.facilityId)).size === equipmentMappings.length
    if (explicitDistinctEquipmentIds) {
      for (const index of equipmentIndices) {
        const session = proveSpan(route, graph, compression, { first: index, last: index }, group.type, bridgeMappings)
        const chain = bridgeChains?.get(index)
        if (chain) session.bridgeChains = [chain]
        sessions.push(session)
      }
    } else {
      // A partial/weak span is unresolved as a whole: splitting it would convert
      // missing connector identity into an invented equipment transfer.
      sessions.push(groupResult)
    }
  }
  const proofs = sessions.flatMap(session => session.proof ? [session.proof] : [])
  const instanceTransitions: EquipmentInstanceTransitionEvidence[] = []
  for (let index = 1; index < sessions.length; index += 1) {
    const previous = sessions[index - 1], current = sessions[index]
    const left = previous.proof, right = current.proof
    const result = !left || !right ? 'unresolved'
      : left.instanceKey === right.instanceKey ? 'same-instance' : 'distinct-instances'
    instanceTransitions.push({
      fromSessionIndex: index - 1, toSessionIndex: index,
      routeIndices: [previous.lastRouteIndex, current.firstRouteIndex], result,
      reason: result === 'same-instance' ? 'Both sessions have source-backed identical instance identities'
        : result === 'distinct-instances' ? 'Both sessions have source-backed distinct Facility identities'
          : 'At least one adjacent session lacks strong source-backed identity',
      evidenceSources: [...new Set([...previous.identitySourceUrls, ...current.identitySourceUrls])],
    })
  }
  return { sessions, proofs, unresolved: sessions.filter(session => session.status === 'unresolved'), instanceTransitions }
}

/** Shadow/test-only bridge entry point. It does not alter routing, selection, or presentation. */
export function buildEquipmentSessionProofsFromBridge(route: IndoorRoute, graph: IndoorGraph,
  bridge: EquipmentSessionBridgeData): { bridge: ReturnType<typeof resolveEquipmentSessionBridge>; evidence: EquipmentSessionProofBuildResult } {
  const resolution = resolveEquipmentSessionBridge({ graph, route, data: bridge })
  const mappings = new Map<number, NonNullable<IndoorRouteCompressionContext['byPathwayId'][string]>>()
  const chains = new Map<number, EquipmentSessionMappingChain>()
  for (const traversal of resolution.traversals) if (traversal.status === 'confirmed-chain' && traversal.chain) {
    mappings.set(traversal.routeIndex, resolution.mappingsByRouteIndex[traversal.routeIndex])
    chains.set(traversal.routeIndex, traversal.chain)
  }
  return { bridge: resolution, evidence: buildEquipmentSessionProofs(route, graph, undefined, mappings, chains) }
}

/** Diagnostic-only comparison; this does not feed route selection or production. */
export function compareRouteCostWithGeneratedSessionProofs(route: IndoorRoute, graph: IndoorGraph,
  compression?: IndoorRouteCompressionContext): { evidence: EquipmentSessionProofBuildResult; withoutProofs: RouteCost; withProofs: RouteCost } {
  const evidence = buildEquipmentSessionProofs(route, graph, compression)
  return {
    evidence,
    withoutProofs: computeRouteCost(route, { graph, compression }),
    withProofs: computeRouteCost(route, { graph, compression, sessionProofs: evidence.proofs }),
  }
}
