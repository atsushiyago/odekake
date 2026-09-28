import {
  compactIndoorRouteSteps, resolveVerticalDirection, resolveVerticalDirectionConsensus, routeTopologyContext,
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

function validatedPhysicalSessions(route: IndoorRoute, proofs: readonly EquipmentSessionProof[] | undefined) {
  if (!proofs?.length) return [] as Array<{ proof: EquipmentSessionProof; type: Equipment; equipmentIndices: number[] }>
  const accepted: Array<{ proof: EquipmentSessionProof; type: Equipment; equipmentIndices: number[] }> = []
  const claimed = new Set<number>()
  for (const proof of proofs) {
    const { firstRouteIndex: first, lastRouteIndex: last } = proof
    if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last < first || last >= route.edges.length
      || !proof.source.trim() || !proof.instanceKey.trim() || proof.basis !== 'explicit-equipment-session') continue
    const connectorIndices = new Set(proof.connectorRouteIndices)
    const equipmentIndices: number[] = []
    let type: Equipment | undefined
    let valid = true
    for (let index = first; index <= last; index += 1) {
      const edge = route.edges[index]
      if (connectorIndices.has(index)) {
        if (edge.movementType !== 'walk') { valid = false; break }
        const from = route.nodes[index]?.levelIndex, to = route.nodes[index + 1]?.levelIndex
        if (!Number.isFinite(from) || from !== to) { valid = false; break }
        continue
      }
      if (!isEquipment(edge.movementType) || (type && type !== edge.movementType)) { valid = false; break }
      type = edge.movementType
      equipmentIndices.push(index)
    }
    if (!valid || !type || !equipmentIndices.length || [...connectorIndices].some(index => index < first || index > last)
      || equipmentIndices.some(index => claimed.has(index))) continue
    equipmentIndices.forEach(index => claimed.add(index))
    accepted.push({ proof, type, equipmentIndices })
  }
  return accepted.sort((a, b) => a.equipmentIndices[0] - b.equipmentIndices[0])
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
  const verticalActions = { up: 0, down: 0, unknown: 0 }
  const actionSpans = actions.map(action => {
    const type = action.type as Equipment
    observedSemanticUses[type] += 1
    const span = action.evidence.routeOrder![0]
    const indices = Array.from({ length: span.lastRouteIndex - span.firstRouteIndex + 1 }, (_, i) => span.firstRouteIndex + i)
    const verticalIndices = indices.filter(index => isEquipment(route.edges[index].movementType))
    const direction = action.verticalDirectionEvidence === 'complete' ? action.verticalDirection ?? 'unknown' : 'unknown'
    verticalActions[direction] += 1
    return { action, type, indices, verticalIndices }
  })

  const physicalSessions = validatedPhysicalSessions(route, context.sessionProofs)
  // Keep legacy measurement exactly unchanged unless explicit physical proofs
  // are supplied. The new path is diagnostic/shadow-only until a caller opts in.
  if (physicalSessions.length === 0) {
    const unknownUses = new Set<Equipment>()
    let unresolvedEquipmentGroups = 0, equipmentInstanceTransfers = 0
    let equipmentTypeChanges = 0, unresolvedEquipmentTransitions = 0
    const legacySessions = actionSpans.map(action => {
      const knownSession = action.verticalIndices.length === 1
      if (!knownSession) {
        unknownUses.add(action.type)
        unresolvedEquipmentGroups += 1
        unresolvedEquipmentTransitions += action.verticalIndices.length - 1
      }
      const proof = context.sessionProofs?.find(candidate => candidate.firstRouteIndex === action.indices[0]
        && candidate.lastRouteIndex === action.indices.at(-1) && candidate.basis === 'explicit-equipment-session'
        && candidate.source.trim() && candidate.instanceKey.trim()
        && candidate.connectorRouteIndices.every(index => action.indices.includes(index)
          && resolveVerticalDirection(route.nodes[index]?.levelIndex, route.nodes[index + 1]?.levelIndex) === 'unknown'
          && Number.isFinite(route.nodes[index]?.levelIndex) && route.nodes[index]?.levelIndex === route.nodes[index + 1]?.levelIndex)
        && action.indices.every(index => route.edges[index].movementType === action.type
          || (route.edges[index].movementType === 'walk' && candidate.connectorRouteIndices.includes(index)))
        && action.indices.some(index => !candidate.connectorRouteIndices.includes(index) && route.edges[index].movementType === action.type))
      evidence.push({ metric: 'equipment', semanticAction: action.action, sessionProof: proof,
        direction: action.action.verticalDirectionEvidence === 'complete' ? action.action.verticalDirection ?? 'unknown' : 'unknown',
        reason: knownSession ? 'One observable semantic action; physical identity unverified'
          : 'Multi-edge grouping lacks explicit session identity; use count unknown (Facility/group match alone is insufficient)' })
      return { ...action, proof }
    })
    for (let i = 1; i < legacySessions.length; i += 1) {
      const previous = legacySessions[i - 1], current = legacySessions[i]
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
  const covered = new Set(physicalSessions.flatMap(session => session.equipmentIndices))
  const unresolvedTypes = new Set<Equipment>()
  let unresolvedEquipmentGroups = 0, unresolvedEquipmentTransitions = 0
  const inferredSessions: Array<{ type: Equipment; firstIndex: number; lastIndex: number; proof?: EquipmentSessionProof }> = physicalSessions.map(session => ({
    type: session.type, firstIndex: session.equipmentIndices[0], lastIndex: session.equipmentIndices.at(-1)!, proof: session.proof,
  }))
  for (const action of actionSpans) {
    const remaining = action.verticalIndices.filter(index => !covered.has(index))
    if (!remaining.length) continue
    if (remaining.length === 1) {
      inferredSessions.push({ type: action.type, firstIndex: remaining[0], lastIndex: remaining[0] })
      continue
    }
    unresolvedTypes.add(action.type)
    unresolvedEquipmentGroups += 1
    unresolvedEquipmentTransitions += remaining.length - 1
  }
  inferredSessions.sort((a, b) => a.firstIndex - b.firstIndex)
  for (const action of actionSpans) {
    const proofSessions = physicalSessions.filter(session => session.equipmentIndices.some(index => action.verticalIndices.includes(index)))
    const sessionProof = proofSessions.length === 1 && proofSessions[0].equipmentIndices.every(index => action.verticalIndices.includes(index))
      ? proofSessions[0].proof : undefined
    evidence.push({ metric: 'equipment', semanticAction: action.action, sessionProof,
      direction: action.action.verticalDirectionEvidence === 'complete' ? action.action.verticalDirection ?? 'unknown' : 'unknown',
      reason: proofSessions.length ? 'Source-backed physical session proof evaluated independently of display grouping'
        : action.verticalIndices.length === 1 ? 'One observable raw equipment traversal; physical identity unverified'
          : 'Multi-edge display grouping lacks complete physical session identity; physical use count unresolved' })
  }
  for (const type of ['stairs', 'escalator', 'elevator'] as const) {
    if (unresolvedTypes.has(type)) continue
    // A proof may expose multiple physical sessions inside one human-facing step.
    observedSemanticUses[type] = actionSpans.filter(action => action.type === type).length
  }
  let equipmentInstanceTransfers = 0
  let equipmentTypeChanges = 0
  for (let i = 1; i < inferredSessions.length; i += 1) {
    const previous = inferredSessions[i - 1], current = inferredSessions[i]
    const typeChange = previous.type !== current.type
    if (typeChange) equipmentTypeChanges += 1
    const differentInstance = typeChange || (previous.proof && current.proof && previous.proof.instanceKey !== current.proof.instanceKey)
    const sameInstance = previous.proof && current.proof && previous.proof.instanceKey === current.proof.instanceKey
    if (differentInstance) equipmentInstanceTransfers += 1
    else if (!sameInstance) unresolvedEquipmentTransitions += 1
    evidence.push({ metric: 'transition', routeIndices: [previous.lastIndex, current.firstIndex], reason:
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
    stairs: { uses: unresolvedTypes.has('stairs') ? null : inferredSessions.filter(session => session.type === 'stairs').length, steps: null, ascentMeters: null, descentMeters: null },
    escalatorUses: unresolvedTypes.has('escalator') ? null : inferredSessions.filter(session => session.type === 'escalator').length,
    elevatorUses: unresolvedTypes.has('elevator') ? null : inferredSessions.filter(session => session.type === 'elevator').length,
    equipmentBoardings: unresolvedEquipmentGroups ? null : inferredSessions.length,
    equipmentInstanceTransfers, equipmentTypeChanges, unresolvedEquipmentTransitions, unresolvedEquipmentGroups,
    observedSemanticUses, decisionPoints: decisionIndices.length, verticalActions, waitingSeconds: null, evidence,
  }
}
