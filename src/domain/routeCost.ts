import {
  compactIndoorRouteSteps, routeTopologyContext, resolveVerticalDirection,
  resolveVerticalDirectionConsensus,
  type IndoorGraph, type IndoorRoute, type IndoorRouteCompressionContext,
  type IndoorRouteStep, type VerticalDirection,
} from './indoorRouting'

type Equipment = 'stairs' | 'escalator' | 'elevator'
const isEquipment = (type: string): type is Equipment => ['stairs', 'escalator', 'elevator'].includes(type)

/** Explicit source-backed session evidence, NOT nearest-Facility/proximity matching.
 * Indices refer to this route's directed traversals. The caller must have evidence
 * of one uninterrupted use, not merely repeated visits to the same Facility.
 * No existing StationMap matching result is automatically promoted to this proof.
 */
export interface EquipmentSessionProof {
  firstRouteIndex: number
  lastRouteIndex: number
  instanceKey: string
  source: string
  basis: 'explicit-equipment-session'
  connectorRouteIndices: readonly number[]
}

export interface RouteCostEvidence {
  metric: 'distance' | 'equipment' | 'transition' | 'decisionPoints' | 'unavailable'
  reason: string
  routeIndices?: number[]
  /** Existing directed traversal and map evidence, not a second graph copy. */
  semanticAction?: IndoorRouteStep
  sessionProof?: EquipmentSessionProof
  direction?: VerticalDirection
}

export interface RouteCost {
  /** null means incomplete, never a fabricated zero. */
  walkingMeters: number | null
  totalPathwayMeters: number | null
  knownWalkingMeters: number
  knownPathwayMeters: number
  stairs: { uses: number | null; steps: null; ascentMeters: null; descentMeters: null }
  escalatorUses: number | null
  elevatorUses: number | null
  equipmentBoardings: number | null
  /** Confirmed lower bound; read with unresolved counts, never as an exact zero. */
  equipmentInstanceTransfers: number
  equipmentTypeChanges: number
  unresolvedEquipmentTransitions: number
  unresolvedEquipmentGroups: number
  /** Current compression output, explicitly NOT proof of physical session count. */
  observedSemanticUses: Record<Equipment, number>
  decisionPoints: number
  verticalActions: Record<VerticalDirection, number>
  waitingSeconds: null
  evidence: RouteCostEvidence[]
}

export interface RouteCostContext {
  graph: IndoorGraph
  compression?: IndoorRouteCompressionContext
  sessionProofs?: readonly EquipmentSessionProof[]
}

/** Pure measurement only. Neither candidate search nor selection consumes this model.
 * Lengths mean supplied graph-edge lengths; upstream imputation cannot be recovered
 * here. Unknown movement types make pure walking distance incomplete.
 */
export function computeRouteCost(route: IndoorRoute, context: RouteCostContext): RouteCost {
  const evidence: RouteCostEvidence[] = []
  let knownWalkingMeters = 0, knownPathwayMeters = 0
  let walkingComplete = true, totalComplete = true
  route.edges.forEach((edge, index) => {
    const valid = Number.isFinite(edge.lengthMeters) && edge.lengthMeters >= 0
    if (valid) knownPathwayMeters += edge.lengthMeters
    else totalComplete = false
    // Deliberately exclude stairs, moving walkways, ES/EV and gates. Other modes
    // (including slopes) need a walking classification policy, not a guess.
    if (edge.movementType === 'walk') {
      if (valid) knownWalkingMeters += edge.lengthMeters
      else walkingComplete = false
    } else if (!isEquipment(edge.movementType) && !['fare-gate', 'exit-gate', 'moving-walkway'].includes(edge.movementType)) {
      walkingComplete = false
    }
    evidence.push({ metric: 'distance', routeIndices: [index], reason: !valid
      ? 'Missing/invalid supplied edge length; aggregate incomplete'
      : edge.movementType === 'walk' ? 'Explicit walk edge; included in walking and total'
        : `Excluded from pure walking: ${edge.movementType}; included in total` })
  })
  const actions = compactIndoorRouteSteps(route, routeTopologyContext(context.graph, route, context.compression))
    .filter(action => isEquipment(action.type))
  const observedSemanticUses = { stairs: 0, escalator: 0, elevator: 0 }
  const unknownUses = new Set<Equipment>()
  const verticalActions = { up: 0, down: 0, unknown: 0 }
  let unresolvedEquipmentGroups = 0, equipmentInstanceTransfers = 0
  let equipmentTypeChanges = 0, unresolvedEquipmentTransitions = 0

  const sessions = actions.map(action => {
    const type = action.type as Equipment
    observedSemanticUses[type] += 1
    const span = action.evidence.routeOrder![0]
    const indices = Array.from({ length: span.lastRouteIndex - span.firstRouteIndex + 1 }, (_, i) => span.firstRouteIndex + i)
    const proof = context.sessionProofs?.find(proof => proof.firstRouteIndex === span.firstRouteIndex
      && proof.lastRouteIndex === span.lastRouteIndex && proof.basis === 'explicit-equipment-session'
      && proof.source.trim() && proof.instanceKey.trim()
      && proof.connectorRouteIndices.every(index => indices.includes(index)
        && resolveVerticalDirection(route.nodes[index]?.levelIndex, route.nodes[index + 1]?.levelIndex) === 'unknown'
        && Number.isFinite(route.nodes[index]?.levelIndex)
        && route.nodes[index]?.levelIndex === route.nodes[index + 1]?.levelIndex)
      && indices.every(index => route.edges[index].movementType === type || (route.edges[index].movementType === 'walk' && proof.connectorRouteIndices.includes(index)))
      && indices.some(index => !proof.connectorRouteIndices.includes(index) && route.edges[index].movementType === type))
    const verticalIndices = indices.filter(index => isEquipment(route.edges[index].movementType))
    // A single raw action is observable without physical instance identification.
    // A multi-flight group may have been built from proximity evidence: do not
    // silently claim it is one boarding. Keep the observed count separately.
    const knownSession = Boolean(proof) || verticalIndices.length === 1
    if (!knownSession) {
      unknownUses.add(type)
      unresolvedEquipmentGroups += 1
      // These raw boundaries may be connectors or real transfers. Do not hide
      // their uncertainty merely because presentation grouped the edges.
      unresolvedEquipmentTransitions += verticalIndices.length - 1
    }
    const direction = proof
      ? resolveVerticalDirectionConsensus(verticalIndices.filter(index => !proof.connectorRouteIndices.includes(index))
        .map(index => resolveVerticalDirection(route.nodes[index]?.levelIndex, route.nodes[index + 1]?.levelIndex)))
      : action.verticalDirectionEvidence === 'complete' ? action.verticalDirection ?? 'unknown' : 'unknown'
    verticalActions[direction] += 1
    evidence.push({ metric: 'equipment', semanticAction: action, sessionProof: proof, direction,
      reason: proof ? 'Explicit uninterrupted session evidence'
        : knownSession ? 'One observable semantic action; physical identity unverified'
          : 'Multi-edge grouping lacks explicit session identity; use count unknown (Facility/group match alone is insufficient)' })
    return { type, proof, knownSession, indices }
  })
  for (let i = 1; i < sessions.length; i += 1) {
    const previous = sessions[i - 1], current = sessions[i]
    const typeChange = previous.type !== current.type
    if (typeChange) equipmentTypeChanges += 1
    const differentInstance = typeChange || (previous.proof && current.proof && previous.proof.instanceKey !== current.proof.instanceKey)
    const sameInstance = previous.proof && current.proof && previous.proof.instanceKey === current.proof.instanceKey
    if (differentInstance) equipmentInstanceTransfers += 1
    else if (!sameInstance) unresolvedEquipmentTransitions += 1
    evidence.push({ metric: 'transition', routeIndices: [previous.indices.at(-1)!, current.indices[0]], reason:
      differentInstance ? 'Different equipment type or explicitly distinct instances'
        : sameInstance ? 'Explicit same instance, separate boarding sessions'
          : 'Same type does not prove same instance; transition unresolved' })
  }
  // Preserve current scoring's proxy. It can miss one-way two-choice branches;
  // it is NOT a general proof that other nodes require no decisions.
  const decisionIndices = route.nodes.slice(0, -1).flatMap((node, i) => (context.graph.adjacency.get(node.id)?.length ?? 0) > 2 ? [i] : [])
  evidence.push({ metric: 'decisionPoints', routeIndices: decisionIndices, reason: 'Legacy outgoing-degree > 2 proxy; one-way two-choice branches may be missed' })
  evidence.push({ metric: 'unavailable', reason: 'No stair-count, measured rise/fall height or waiting-time evidence in current route model; no level-to-meters conversion' })
  return {
    walkingMeters: walkingComplete ? knownWalkingMeters : null,
    totalPathwayMeters: totalComplete ? knownPathwayMeters : null, knownWalkingMeters, knownPathwayMeters,
    stairs: { uses: unknownUses.has('stairs') ? null : observedSemanticUses.stairs, steps: null, ascentMeters: null, descentMeters: null },
    escalatorUses: unknownUses.has('escalator') ? null : observedSemanticUses.escalator,
    elevatorUses: unknownUses.has('elevator') ? null : observedSemanticUses.elevator,
    equipmentBoardings: unresolvedEquipmentGroups ? null : actions.length,
    equipmentInstanceTransfers, equipmentTypeChanges, unresolvedEquipmentTransitions, unresolvedEquipmentGroups,
    observedSemanticUses, decisionPoints: decisionIndices.length, verticalActions, waitingSeconds: null, evidence,
  }
}
