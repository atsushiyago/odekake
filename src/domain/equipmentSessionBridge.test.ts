import { describe, expect, it } from 'vitest'
import type { IndoorEdge, IndoorGraph, IndoorMovementType, IndoorNode, IndoorRoute } from './indoorRouting'
import { buildEquipmentSessionProofsFromBridge } from './equipmentSessionEvidence'
import { outingCoursePresets } from '../data/coursePresets'
import { loadedOedo2026IndoorDatasets } from '../data/catalogs/oedo2026IndoorDatasets'
import { buildIndoorGraph, platformOriginNodes } from './indoorRouting'
import { findBestElderlyRoute } from './elderlyRouteScoring'
import type { EquipmentSessionBridgeData, GtfsDirectedTraversalRef, GtfsWalkingCrosswalk, WalkingFacilityRelation } from './equipmentSessionBridge'

const gtfsDataset = 'fictional-gtfs-feed', gtfsVersion = 'v-test'
const walkingDataset = 'fictional-walking-network', walkingVersion = 'v-test'
const facilityDataset = 'fictional-station-map', facilityVersion = 'v-test'
const provenance = 'fictional authoritative source relation'

function fixture(types: IndoorMovementType[], levels: Array<number | undefined>) {
  const nodes: IndoorNode[] = levels.map((levelIndex, i) => ({ id: `node-${i}`, name: `node ${i}`, latitude: 35, longitude: 139 + i / 100000,
    locationType: 3, kind: 'internal', levelIndex }))
  const edges: IndoorEdge[] = types.map((movementType, i) => ({ id: `path-${i}`, fromNodeId: nodes[i].id, toNodeId: nodes[i + 1].id,
    movementType, sourceType: 'gtfs-pathways', lengthMeters: 1 }))
  const graph: IndoorGraph = { stationId: 'fictional-bridge-station', stationName: '仮想駅',
    source: { name: gtfsDataset, url: 'test:', license: 'test', feedVersion: gtfsVersion, retrievedAt: 'test' },
    nodes: new Map(nodes.map(node => [node.id, node])), edges,
    adjacency: new Map(nodes.map(node => [node.id, edges.filter(edge => edge.fromNodeId === node.id)])) }
  const route: IndoorRoute = { nodes, edges, distanceMeters: edges.length }
  return { graph, route }
}

function refs(route: IndoorRoute, index: number): GtfsDirectedTraversalRef {
  const edge = route.edges[index]
  return { dataset: gtfsDataset, version: gtfsVersion, pathwayId: edge.id, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId }
}
function gtfsRel(route: IndoorRoute, index: number, linkId: string, overrides: Partial<GtfsWalkingCrosswalk> = {}): GtfsWalkingCrosswalk {
  return { relationId: `gtfs-walk-${index}-${linkId}`, gtfs: refs(route, index), walkingLink: { dataset: walkingDataset, version: walkingVersion, linkId },
    traversalCoverage: 'exact-directed', direction: 'same', method: 'authoritative-crosswalk', strength: 'strong', status: 'asserted',
    meaning: 'same-traversal', provenance, ...overrides }
}
function facilityRel(linkId: string, facilityId: string, overrides: Partial<WalkingFacilityRelation> = {}): WalkingFacilityRelation {
  return { relationId: `walk-facility-${linkId}-${facilityId}`, walkingLink: { dataset: walkingDataset, version: walkingVersion, linkId },
    facility: { dataset: facilityDataset, version: facilityVersion, facilityId, equipmentType: 'elevator' }, direction: 'direction-independent',
    method: 'explicit-reference', strength: 'strong', status: 'asserted', meaning: 'component-of', provenance, ...overrides }
}
function bridgeFor(route: IndoorRoute, facilityIds: string[], unmapped = new Set<number>()): EquipmentSessionBridgeData {
  return { gtfsToWalking: route.edges.flatMap((_edge, i) => unmapped.has(i) ? [] : [gtfsRel(route, i, `walk-${i}`)]),
    walkingToFacility: route.edges.flatMap((_edge, i) => unmapped.has(i) ? [] : [facilityRel(`walk-${i}`, facilityIds[i])]) }
}

describe('generic GTFS → walking-network → Facility evidence bridge', () => {
  it('A: proves one EV session only when every equipment and connector traversal has a strong chain', () => {
    const f = fixture(['elevator', 'walk', 'elevator'], [-3, -2, -2, -1])
    const result = buildEquipmentSessionProofsFromBridge(f.route, f.graph, bridgeFor(f.route, ['EV-1', 'EV-1', 'EV-1']))
    expect(result.bridge.traversals.map(item => item.status)).toEqual(['confirmed-chain', 'confirmed-chain', 'confirmed-chain'])
    expect(result.evidence.proofs).toHaveLength(1)
    expect(result.evidence.sessions[0]).toMatchObject({ status: 'confirmed', direction: 'up' })
    expect(result.evidence.sessions[0].bridgeChains).toHaveLength(3)
    expect(result.evidence.sessions[0].bridgeChains?.[0]).toMatchObject({
      gtfsToWalkingRelation: { relationId: 'gtfs-walk-0-walk-0' }, walkingToFacilityRelation: { relationId: 'walk-facility-walk-0-EV-1' },
    })
  })

  it('B: preserves two explicitly distinct equipment instances and their transfer evidence', () => {
    const f = fixture(['elevator', 'walk', 'elevator'], [-3, -2, -2, -1])
    const result = buildEquipmentSessionProofsFromBridge(f.route, f.graph, bridgeFor(f.route, ['EV-1', 'connector', 'EV-2']))
    expect(result.evidence.proofs).toHaveLength(2)
    expect(result.evidence.sessions.map(session => session.facilityCandidates)).toEqual([['EV-1'], ['EV-2']])
    expect(result.evidence.instanceTransitions).toMatchObject([{ result: 'distinct-instances' }])
  })

  it('C: a strong GTFS crosswalk plus nearest-only Facility suggestion stays unresolved', () => {
    const f = fixture(['elevator'], [-2, -1])
    const weak = facilityRel('walk-0', 'EV-nearest', { relationId: 'nearest-only', method: 'nearest', strength: 'supporting', meaning: 'near' })
    const result = buildEquipmentSessionProofsFromBridge(f.route, f.graph, { gtfsToWalking: [gtfsRel(f.route, 0, 'walk-0')], walkingToFacility: [weak] })
    expect(result.bridge.traversals[0].status).toBe('weak-only-evidence')
    expect(result.evidence.proofs).toHaveLength(0)
  })

  it('D: an explicit Facility relation cannot compensate for weak GTFS-to-walking matching', () => {
    const f = fixture(['elevator'], [-2, -1])
    const weak = gtfsRel(f.route, 0, 'walk-0', { method: 'nearest', strength: 'supporting', meaning: 'proximity' })
    const result = buildEquipmentSessionProofsFromBridge(f.route, f.graph, { gtfsToWalking: [weak], walkingToFacility: [facilityRel('walk-0', 'EV-1')] })
    expect(result.bridge.traversals[0].status).toBe('weak-only-evidence')
    expect(result.evidence.proofs).toHaveLength(0)
  })

  it('E: multiple strong walking-link candidates are ambiguous and none is selected', () => {
    const f = fixture(['elevator'], [-2, -1])
    const result = buildEquipmentSessionProofsFromBridge(f.route, f.graph, { gtfsToWalking: [gtfsRel(f.route, 0, 'walk-A'), gtfsRel(f.route, 0, 'walk-B')],
      walkingToFacility: [facilityRel('walk-A', 'EV-1'), facilityRel('walk-B', 'EV-1')] })
    expect(result.bridge.traversals[0].status).toBe('ambiguous-walking-mapping')
    expect(result.evidence.proofs).toHaveLength(0)
  })

  it('F: one unmapped connector prevents proving the whole multi-edge session; no identity is copied', () => {
    const f = fixture(['elevator', 'walk', 'elevator'], [-3, -2, -2, -1])
    const result = buildEquipmentSessionProofsFromBridge(f.route, f.graph, bridgeFor(f.route, ['EV-1', 'EV-1', 'EV-1'], new Set([1])))
    expect(result.bridge.traversals[1].status).toBe('missing-gtfs-walking-relation')
    expect(result.evidence.proofs).toHaveLength(0)
    expect(result.evidence.unresolved[0]).toMatchObject({ unresolvedReason: 'unmapped-traversal' })
  })

  it('G: confirms identity while keeping vertical direction unknown', () => {
    const f = fixture(['elevator'], [undefined, undefined])
    const result = buildEquipmentSessionProofsFromBridge(f.route, f.graph, bridgeFor(f.route, ['EV-1']))
    expect(result.evidence.sessions[0]).toMatchObject({ status: 'confirmed', direction: 'unknown' })
    expect(result.evidence.proofs).toHaveLength(1)
  })

  it('H: GTFS-only stations have no chain or physical session proof', () => {
    const f = fixture(['elevator'], [-2, -1])
    const result = buildEquipmentSessionProofsFromBridge(f.route, f.graph, { gtfsToWalking: [], walkingToFacility: [] })
    expect(result.bridge.traversals[0]).toMatchObject({ status: 'missing-gtfs-walking-relation' })
    expect(result.evidence.proofs).toHaveLength(0)
  })

  it('keeps reverse traversal distinct unless the crosswalk explicitly covers both directions', () => {
    const f = fixture(['elevator'], [-2, -1])
    const reversedRoute: IndoorRoute = { nodes: [...f.route.nodes].reverse(), edges: [{ ...f.route.edges[0], fromNodeId: 'node-1', toNodeId: 'node-0' }], distanceMeters: 1 }
    const exactOnly = gtfsRel(f.route, 0, 'walk-0')
    const missing = buildEquipmentSessionProofsFromBridge(reversedRoute, f.graph, { gtfsToWalking: [exactOnly], walkingToFacility: [facilityRel('walk-0', 'EV-1')] })
    expect(missing.bridge.traversals[0].status).toBe('missing-gtfs-walking-relation')
    const both = { ...exactOnly, traversalCoverage: 'bidirectional' as const, direction: 'reverse' as const }
    const accepted = buildEquipmentSessionProofsFromBridge(reversedRoute, f.graph, { gtfsToWalking: [both], walkingToFacility: [facilityRel('walk-0', 'EV-1')] })
    expect(accepted.bridge.traversals[0]).toMatchObject({ status: 'confirmed-chain', chain: { gtfsToWalkingRelation: { direction: 'reverse' } } })
  })

  it('retains weaker conflicting suggestions while refusing conflicting strong Facility relations', () => {
    const f = fixture(['elevator'], [-2, -1])
    const strong = facilityRel('walk-0', 'EV-authoritative')
    const weak = facilityRel('walk-0', 'EV-nearest', { relationId: 'weak-nearest', method: 'nearest', strength: 'supporting', meaning: 'near' })
    const resolved = buildEquipmentSessionProofsFromBridge(f.route, f.graph, { gtfsToWalking: [gtfsRel(f.route, 0, 'walk-0')], walkingToFacility: [strong, weak] })
    expect(resolved.bridge.traversals[0].status).toBe('confirmed-chain')
    expect(resolved.bridge.traversals[0].chain?.weakConflicts).toEqual([{ relationId: 'weak-nearest', side: 'walking-to-facility', entityId: 'EV-nearest', method: 'nearest', provenance }])
    expect(resolved.evidence.proofs).toHaveLength(1)
    const conflict = facilityRel('walk-0', 'EV-other', { relationId: 'strong-conflict', status: 'conflict' })
    const rejected = buildEquipmentSessionProofsFromBridge(f.route, f.graph, { gtfsToWalking: [gtfsRel(f.route, 0, 'walk-0')], walkingToFacility: [strong, conflict] })
    expect(rejected.bridge.traversals[0].status).toBe('conflicting-strong-evidence')
    expect(rejected.evidence.proofs).toHaveLength(0)
  })

  it('only resolves exact source-qualified dataset/version relations', () => {
    const f = fixture(['elevator'], [-2, -1])
    const wrongVersion = { ...gtfsRel(f.route, 0, 'walk-0'), gtfs: { ...refs(f.route, 0), version: 'other' } }
    const result = buildEquipmentSessionProofsFromBridge(f.route, f.graph, { gtfsToWalking: [wrongVersion], walkingToFacility: [facilityRel('walk-0', 'EV-1')] })
    expect(result.bridge.traversals[0].status).toBe('missing-gtfs-walking-relation')
    expect(result.evidence.proofs).toHaveLength(0)
  })

  it('does not create strong proofs for any supported station without supplied crosswalk data', () => {
    for (const course of outingCoursePresets) {
      const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === course.arrivalStationId)!
      const graph = buildIndoorGraph(dataset.gtfs)
      const origin = platformOriginNodes(graph, course.arrivalPlatformAssignments[0].platformId)[0]
      const targets = Array.isArray(course.preferredExitId) ? course.preferredExitId : [course.preferredExitId!]
      const selected = origin && findBestElderlyRoute(graph, origin.id, targets)
      if (!selected) continue
      const result = buildEquipmentSessionProofsFromBridge(selected.route, graph, { gtfsToWalking: [], walkingToFacility: [] })
      expect(result.evidence.proofs, course.destination.name).toHaveLength(0)
      expect(result.bridge.traversals.every(item => item.status !== 'confirmed-chain'), course.destination.name).toBe(true)
    }
  }, 120_000)
})
