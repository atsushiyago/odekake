import { describe, expect, it } from 'vitest'
import type { FacilityMappingEvidence, IndoorEdge, IndoorGraph, IndoorMovementType, IndoorNode, IndoorRoute, IndoorRouteCompressionContext } from './indoorRouting'
import { buildEquipmentSessionProofs, compareRouteCostWithGeneratedSessionProofs } from './equipmentSessionEvidence'
import { outingCoursePresets } from '../data/coursePresets'
import { loadedOedo2026IndoorDatasets } from '../data/catalogs/oedo2026IndoorDatasets'
import { buildRegisteredStationMapCompressionContext } from '../data/stationMaps/registry'
import { buildIndoorGraph } from './indoorRouting'
import { findBestElderlyRoute } from './elderlyRouteScoring'
import { DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS, searchMultiObjectiveRoutesToTargets } from './multiObjectiveRouting'
import { platformOriginNodes } from './indoorRouting'
import { scoreElderlyRoute, selectBestEvidenceAwareRoute } from './elderlyRouteScoring'

const sourceUrl = 'https://fixture.invalid/station-map'

function fixture(types: IndoorMovementType[], levels: (number | undefined)[], mapping: Record<number, {
  facilityId?: string; facilityGroupId?: string; spaceId?: string; facilityMapping?: FacilityMappingEvidence
}> = {}) {
  const nodes: IndoorNode[] = levels.map((levelIndex, index) => ({
    id: `fictional-node-${index}`, name: `node ${index}`, latitude: 35, longitude: 139 + index * 0.00001,
    locationType: 3, kind: 'internal', levelIndex,
  }))
  const edges: IndoorEdge[] = types.map((movementType, index) => ({
    id: `fictional-edge-${index}`, fromNodeId: nodes[index].id, toNodeId: nodes[index + 1].id,
    lengthMeters: movementType === 'walk' ? 2 : 6, movementType, sourceType: 'gtfs-pathways',
  }))
  const graph: IndoorGraph = {
    stationId: 'test-unrelated-fictional-station', stationName: '未登録駅',
    source: { name: 'synthetic', url: sourceUrl, license: 'test', feedVersion: 'test', retrievedAt: 'test' },
    nodes: new Map(nodes.map(node => [node.id, node])), edges,
    adjacency: new Map(nodes.map(node => [node.id, edges.filter(edge => edge.fromNodeId === node.id)])),
  }
  const route: IndoorRoute = { nodes, edges, distanceMeters: edges.reduce((sum, edge) => sum + edge.lengthMeters, 0) }
  const byPathwayId: IndoorRouteCompressionContext['byPathwayId'] = Object.fromEntries(edges.flatMap((edge, index) => {
    const evidence = mapping[index]
    return evidence ? [[edge.id, evidence]] : []
  }))
  const compression: IndoorRouteCompressionContext = {
    byPathwayId,
    nonBranchingNodeIds: new Set(nodes.map(node => node.id)),
  }
  return { graph, route, compression }
}

const strong = (facilityId: string, spaceId = 'space-main'): NonNullable<IndoorRouteCompressionContext['byPathwayId'][string]> => ({
  facilityId, spaceId, facilityMapping: { method: 'direct', identityStrength: 'strong', sourceUrl },
})

describe('generic EquipmentSessionProof builder (diagnostic only)', () => {
  it('A: strongly mapped connector→EV→connector is one proof with ordered connector indices', () => {
    const f = fixture(['elevator', 'walk', 'elevator'], [-3, -2, -2, -1], {
      0: strong('lift-A'), 1: strong('lift-A'), 2: strong('lift-A'),
    })
    const result = buildEquipmentSessionProofs(f.route, f.graph, f.compression)
    expect(result.proofs).toHaveLength(1)
    expect(result.proofs[0]).toMatchObject({ firstRouteIndex: 0, lastRouteIndex: 2, connectorRouteIndices: [1] })
    expect(result.sessions[0]).toMatchObject({ status: 'confirmed', direction: 'up', facilityCandidates: ['lift-A'] })
  })

  it('B: same equipment type with distinct explicit Facilities yields separate sessions and transfer evidence', () => {
    const f = fixture(['stairs', 'walk', 'stairs'], [-3, -2, -2, -1], {
      0: strong('stairs-A'), 1: { spaceId: 'space-main' }, 2: strong('stairs-B'),
    })
    const result = buildEquipmentSessionProofs(f.route, f.graph, f.compression)
    expect(result.proofs).toHaveLength(2)
    expect(result.instanceTransitions).toMatchObject([{ result: 'distinct-instances' }])
    const cost = compareRouteCostWithGeneratedSessionProofs(f.route, f.graph, f.compression).withProofs
    expect([cost.stairs.uses, cost.equipmentBoardings, cost.equipmentInstanceTransfers]).toEqual([2, 2, 1])
    expect(cost.observedSemanticUses.stairs).toBe(1) // human-facing grouping is independent
  })

  it('C: Facility group / Space alone cannot prove a physical equipment session', () => {
    const f = fixture(['elevator', 'elevator'], [-3, -2, -1], {
      0: { facilityGroupId: 'nearby-group', spaceId: 'space-main' },
      1: { facilityGroupId: 'nearby-group', spaceId: 'space-main' },
    })
    const result = buildEquipmentSessionProofs(f.route, f.graph, f.compression)
    expect(result.proofs).toHaveLength(0)
    expect(result.unresolved[0]?.unresolvedReason).toBe('unmapped-traversal')
  })

  it('D: nearest/proximity Facility mapping stays supporting and cannot produce a proof', () => {
    const nearest = (facilityId: string) => ({ facilityId, facilityMapping: { method: 'nearest' as const, identityStrength: 'supporting' as const, sourceUrl } })
    const f = fixture(['elevator', 'elevator'], [-3, -2, -1], { 0: nearest('lift-A'), 1: nearest('lift-A') })
    const result = buildEquipmentSessionProofs(f.route, f.graph, f.compression)
    expect(result.proofs).toHaveLength(0)
    expect(result.unresolved[0]?.unresolvedReason).toBe('weak-facility-mapping')
    expect(compareRouteCostWithGeneratedSessionProofs(f.route, f.graph, f.compression).withProofs)
      .toMatchObject({ elevatorUses: null, unresolvedEquipmentGroups: 1 })
    const strengthened = { ...f, compression: { ...f.compression, byPathwayId: Object.fromEntries(f.route.edges.map(edge => [edge.id, strong('lift-A')])) } }
    expect(buildEquipmentSessionProofs(strengthened.route, strengthened.graph, strengthened.compression).proofs).toHaveLength(1)
  })

  it('E: fully mapped multi-flight stairs are one proof; partial mapping remains unresolved', () => {
    const complete = fixture(['stairs', 'walk', 'stairs'], [-3, -2, -2, -1], {
      0: strong('stairwell-A'), 1: strong('stairwell-A'), 2: strong('stairwell-A'),
    })
    const completeResult = buildEquipmentSessionProofs(complete.route, complete.graph, complete.compression)
    expect(completeResult.proofs).toHaveLength(1)
    expect(compareRouteCostWithGeneratedSessionProofs(complete.route, complete.graph, complete.compression).withProofs.stairs.uses).toBe(1)
    const partial = fixture(['stairs', 'walk', 'stairs'], [-3, -2, -2, -1], {
      0: strong('stairwell-A'), 1: strong('stairwell-A'),
    })
    const partialResult = buildEquipmentSessionProofs(partial.route, partial.graph, partial.compression)
    expect(partialResult.proofs).toHaveLength(0)
    expect(partialResult.unresolved[0]?.unresolvedReason).toBe('unmapped-traversal')
    expect(compareRouteCostWithGeneratedSessionProofs(partial.route, partial.graph, partial.compression).withProofs.stairs.uses).toBe(2)
  })

  it('F: same type / Space / proximity is not proof of one instance; distinct strong IDs remain two sessions', () => {
    const strongDistinct = fixture(['stairs', 'walk', 'stairs'], [-3, -2, -2, -1], {
      0: strong('stairwell-A'), 1: { spaceId: 'space-main' }, 2: strong('stairwell-B'),
    })
    const distinctResult = buildEquipmentSessionProofs(strongDistinct.route, strongDistinct.graph, strongDistinct.compression)
    expect(distinctResult.proofs).toHaveLength(2)
    expect(distinctResult.instanceTransitions[0]?.result).toBe('distinct-instances')

    const weakSharedSpace = fixture(['stairs', 'walk', 'stairs'], [-3, -2, -2, -1], {
      0: { spaceId: 'space-main' }, 1: { spaceId: 'space-main' }, 2: { spaceId: 'space-main' },
    })
    expect(buildEquipmentSessionProofs(weakSharedSpace.route, weakSharedSpace.graph, weakSharedSpace.compression).proofs).toHaveLength(0)
  })

  it('G: strong identity can prove one equipment use without proving its direction', () => {
    const f = fixture(['elevator'], [undefined, undefined], { 0: strong('lift-A') })
    const result = buildEquipmentSessionProofs(f.route, f.graph, f.compression)
    expect(result.proofs).toHaveLength(1)
    expect(result.sessions[0]).toMatchObject({ status: 'confirmed', direction: 'unknown' })
    expect(compareRouteCostWithGeneratedSessionProofs(f.route, f.graph, f.compression).withProofs.verticalActions)
      .toEqual({ up: 0, down: 0, unknown: 1 })
  })

  it('H: GTFS-only route gets no physical session proof and keeps RouteCost fallback', () => {
    const f = fixture(['elevator', 'elevator'], [-3, -2, -1])
    const result = buildEquipmentSessionProofs(f.route, f.graph)
    expect(result.proofs).toHaveLength(0)
    expect(result.unresolved.map(session => session.unresolvedReason)).toEqual(['unmapped-traversal'])
    const comparison = compareRouteCostWithGeneratedSessionProofs(f.route, f.graph)
    expect(comparison.withProofs.elevatorUses).toBe(comparison.withoutProofs.elevatorUses)
    expect(comparison.withProofs.evidence.some(item => item.sessionProof)).toBe(false)
  })

  it('shadow-evaluates selected routes for all supported courses without changing selection or guide generation', () => {
    const reports = outingCoursePresets.map(course => {
      const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === course.arrivalStationId)!
      const graph = buildIndoorGraph(dataset.gtfs)
      const compression = buildRegisteredStationMapCompressionContext(dataset.station.id, graph)
      const selected = findBestElderlyRoute(graph, course.arrivalPlatformAssignments[0].platformId,
        (Array.isArray(course.preferredExitId) ? course.preferredExitId : [course.preferredExitId!]), compression)
      if (!selected) return { station: dataset.station.name, selectionUnavailable: true, proofCount: 0, unresolved: [] }
      const comparison = compareRouteCostWithGeneratedSessionProofs(selected.route, graph, compression)
      expect(comparison.withProofs).toEqual(comparison.withoutProofs)
      return {
        station: dataset.station.name,
        routeEdges: selected.route.edges.length,
        proofCount: comparison.evidence.proofs.length,
        unresolved: comparison.evidence.unresolved.map(item => ({
          equipment: item.equipmentType, edgeIds: item.edgeIds, reason: item.unresolvedReason,
          facilities: item.facilityCandidates, methods: item.mappingMethods,
        })),
        before: { stairs: comparison.withoutProofs.stairs.uses, ES: comparison.withoutProofs.escalatorUses,
          EV: comparison.withoutProofs.elevatorUses, boardings: comparison.withoutProofs.equipmentBoardings,
          transfers: comparison.withoutProofs.equipmentInstanceTransfers, groups: comparison.withoutProofs.unresolvedEquipmentGroups,
          transitions: comparison.withoutProofs.unresolvedEquipmentTransitions },
        shadowAfter: { stairs: comparison.withProofs.stairs.uses, ES: comparison.withProofs.escalatorUses,
          EV: comparison.withProofs.elevatorUses, boardings: comparison.withProofs.equipmentBoardings,
          transfers: comparison.withProofs.equipmentInstanceTransfers, groups: comparison.withProofs.unresolvedEquipmentGroups,
          transitions: comparison.withProofs.unresolvedEquipmentTransitions },
      }
    })
    expect(reports).toHaveLength(12)
    expect(reports.reduce((sum, item) => sum + (item.unresolved?.length ?? 0), 0)).toBeGreaterThan(0)
  })

  it('shadow-evaluates g+h balanced selections without feeding proofs back into search', () => {
    const reports = outingCoursePresets.flatMap(course => {
      const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === course.arrivalStationId)!
      const graph = buildIndoorGraph(dataset.gtfs)
      const compression = buildRegisteredStationMapCompressionContext(dataset.station.id, graph)
      const platformId = course.arrivalPlatformAssignments[0].platformId
      const targets = Array.isArray(course.preferredExitId) ? course.preferredExitId : [course.preferredExitId!]
      const origins = [...new Set(platformOriginNodes(graph, platformId).map(origin => origin.id))].sort()
      const limits = {
        maxTotalLabels: Math.max(1, Math.floor(DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS.maxTotalLabels / Math.max(origins.length, 1))),
        maxExpansions: Math.max(1, Math.floor(DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS.maxExpansions / Math.max(origins.length, 1))),
        maxCompletedCandidates: Math.max(1, Math.floor(DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS.maxCompletedCandidates / Math.max(origins.length, 1))),
      }
      const results = origins.map(origin => searchMultiObjectiveRoutesToTargets(graph, origin, targets, {
          compressionContext: compression, limits, queueOrdering: 'distance-lower-bound', selectionMode: 'evidence-aware',
        }))
      return targets.flatMap(target => {
        const candidateSet = results.flatMap(result => result.exits[target]?.candidates ?? [])
          .map(candidate => ({ candidate, cost: candidate.routeCost,
            score: scoreElderlyRoute(graph, candidate.originBoardingAreaId, target, candidate.route, compression) }))
        const selected = selectBestEvidenceAwareRoute(candidateSet.map(({ cost, score }) => ({ cost, score }))).selected
        if (!selected) return []
        const routeSelection = candidateSet.find(({ score }) => JSON.stringify(score.route.edges.map(edge => edge.id))
          === JSON.stringify(selected.score.route.edges.map(edge => edge.id)))?.candidate
        if (!routeSelection) return []
        const comparison = compareRouteCostWithGeneratedSessionProofs(routeSelection.route, graph, compression)
        const evidence = comparison.evidence
        return [{ station: dataset.station.name, origin: routeSelection.originBoardingAreaId, exit: target,
            proofCount: evidence.proofs.length, unresolved: evidence.unresolved.map(item => ({
              type: item.equipmentType, ids: item.edgeIds, reason: item.unresolvedReason,
            })),
            costBefore: { stairs: comparison.withoutProofs.stairs.uses, ES: comparison.withoutProofs.escalatorUses,
              EV: comparison.withoutProofs.elevatorUses, boardings: comparison.withoutProofs.equipmentBoardings,
              transfers: comparison.withoutProofs.equipmentInstanceTransfers, groups: comparison.withoutProofs.unresolvedEquipmentGroups,
              transitions: comparison.withoutProofs.unresolvedEquipmentTransitions },
            costAfter: { stairs: comparison.withProofs.stairs.uses, ES: comparison.withProofs.escalatorUses,
              EV: comparison.withProofs.elevatorUses, boardings: comparison.withProofs.equipmentBoardings,
              transfers: comparison.withProofs.equipmentInstanceTransfers, groups: comparison.withProofs.unresolvedEquipmentGroups,
              transitions: comparison.withProofs.unresolvedEquipmentTransitions },
          }]
      })
    })
    expect(reports.length).toBeGreaterThan(0)
    expect(reports).toHaveLength(6)
    expect(reports.reduce((sum, item) => sum + item.unresolved.length, 0)).toBe(17)
    expect(reports.reduce((sum, item) => sum + item.proofCount, 0)).toBe(0)
    expect(reports.map(item => item.costAfter)).toEqual(reports.map(item => item.costBefore))
  }, 120_000)
})
