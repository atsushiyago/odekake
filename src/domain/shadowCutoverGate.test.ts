import { describe, expect, it } from 'vitest'
import { MOBILITY_PROFILES, findBestElderlyRoute, scoreElderlyRoute,
  selectBestEvidenceAwareRoute, type MobilityRouteCandidate } from './elderlyRouteScoring'
import { computeRouteCost } from './routeCost'
import { buildGtfsStationGuideFromRoute, buildIndoorGraph, platformOriginNodes, type IndoorEdge,
  type IndoorGraph, type IndoorMovementType, type IndoorRoute } from './indoorRouting'
import { evaluateShadowCutover } from './shadowCutoverGate'
import { outingCoursePresets } from '../data/coursePresets'
import { loadedOedo2026IndoorDatasets } from '../data/catalogs/oedo2026IndoorDatasets'
import { buildRegisteredStationMapCompressionContext } from '../data/stationMaps/registry'
import { DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS, searchMultiObjectiveRoutesToTargets,
  type MultiObjectiveCandidate } from './multiObjectiveRouting'
import { buildVerifiedPathwayEnrichments } from '../data/verifiedPathwayCrosswalk'
import { withVerifiedPathwayEnrichment } from './verifiedPathwayEnrichment'
import { buildHomeToGateGuideModel } from './homeToGateGuide'
import { stationOfficialGuidanceByStationId } from '../data/stationOfficialGuidance'

function candidate(key: string, modes: IndoorMovementType[], distance: number, stairs = 0, decisions = 0): MobilityRouteCandidate {
  const nodes = Array.from({ length: modes.length + 1 }, (_, index) => ({ id: `${key}-n${index}`, name: key,
    latitude: 35, longitude: 139 + index / 10000, locationType: 3, kind: 'internal' as const, levelIndex: -index }))
  const edges: IndoorEdge[] = modes.map((movementType, index) => ({ id: `${key}-e${index}`, fromNodeId: nodes[index].id,
    toNodeId: nodes[index + 1].id, movementType, lengthMeters: index === 0 ? distance : 0, sourceType: 'gtfs-pathways' }))
  const route: IndoorRoute = { nodes, edges, distanceMeters: distance }
  const graph: IndoorGraph = { stationId: `fictional-${key}`, stationName: '架空駅', nodes: new Map(nodes.map(node => [node.id, node])), edges,
    adjacency: new Map(nodes.map((node, index) => [node.id, [...edges.filter(edge => edge.fromNodeId === node.id),
      ...(index === 0 && decisions ? Array.from({ length: decisions }, (_, n) => ({ ...edges[0], id: `${key}-branch-${n}` })) : [])]])),
    source: { name: 'fixture', url: 'fixture', license: 'fixture', feedVersion: 'fixture', retrievedAt: 'fixture' } }
  const count = (type: IndoorMovementType) => modes.filter(mode => mode === type).length
  const usage = modes.filter(mode => ['stairs', 'escalator', 'elevator'].includes(mode))
  const changes = usage.slice(1).reduce((sum, value, index) => sum + Number(value !== usage[index]), 0)
  const score = { originId: nodes[0].id, exitId: nodes.at(-1)!.id, route, stairs: count('stairs'), escalators: count('escalator'),
    elevators: count('elevator'), equipmentChanges: changes, decisionPoints: decisions, distanceMeters: distance,
    equipmentUses: usage.length, ranking: [count('stairs'), changes, decisions, distance, usage.length] as [number, number, number, number, number] }
  const rawCost = computeRouteCost(route, { graph })
  const resolvedCost = { ...rawCost, stairs: { ...rawCost.stairs, uses: count('stairs') }, escalatorUses: count('escalator'),
    elevatorUses: count('elevator'), equipmentBoardings: usage.length, equipmentInstanceTransfers: 0,
    equipmentTypeChanges: changes, unresolvedEquipmentTransitions: 0, unresolvedEquipmentGroups: 0,
    walkingMeters: modes.reduce((sum, mode, index) => sum + (mode === 'walk' ? edges[index].lengthMeters : 0), 0),
    totalPathwayMeters: distance, decisionPoints: decisions }
  return { score, cost: resolvedCost }
}

const uncertain = (item: MobilityRouteCandidate): MobilityRouteCandidate => ({ ...item, cost: {
  ...item.cost, stairs: { ...item.cost.stairs, uses: null }, unresolvedEquipmentGroups: 1,
  observedSemanticUses: { ...item.cost.observedSemanticUses, stairs: 0 },
} })

describe('shadow-only multi-objective production cutover gate', () => {
  it('A: adopts a confirmed new route that reduces stairs with other burdens no worse', () => {
    const newer = candidate('new-a', ['walk'], 100)
    const legacy = candidate('legacy-a', ['stairs'], 100, 1)
    const result = evaluateShadowCutover({ candidates: [newer], legacyCandidate: legacy, paperSemanticValidation: { safe: true } })
    expect(result.diagnostic.selectedSource).toBe('new')
    expect(result.diagnostic.routeCostDelta?.stairs).toBe(-1)
  })

  it('B: does not treat unresolved zero ES as better than a confirmed legacy ES use', () => {
    const newer = candidate('new-b', ['walk'], 100)
    newer.cost = { ...newer.cost, escalatorUses: null, equipmentBoardings: null, unresolvedEquipmentGroups: 1, unresolvedEquipmentTransitions: 1 }
    const legacy = candidate('legacy-b', ['escalator'], 100)
    const result = evaluateShadowCutover({ candidates: [newer], legacyCandidate: legacy, paperSemanticValidation: { safe: true } })
    expect(result.diagnostic.selectedSource).toBe('legacy-fallback')
    expect(result.diagnostic.fallbackReason).toBe('non-degradation-comparison-incomplete')
    expect(result.diagnostic.unresolvedReason).toContain('new:unresolved-equipment-groups=1')
  })

  it('C: adopts an otherwise equivalent, slightly shorter route using the existing distance semantics', () => {
    const newer = candidate('new-c', ['walk'], 103)
    const legacy = candidate('legacy-c', ['walk'], 108)
    expect(evaluateShadowCutover({ candidates: [newer], legacyCandidate: legacy, paperSemanticValidation: { safe: true } }).diagnostic.selectedSource).toBe('new')
  })

  it('does not accept an equipment-equivalent route outside the existing distance-equivalence window', () => {
    const newer = candidate('new-c-farther', ['walk'], 140)
    const legacy = candidate('legacy-c-shorter', ['walk'], 100)
    const result = evaluateShadowCutover({ candidates: [newer], legacyCandidate: legacy, paperSemanticValidation: { safe: true } })
    expect(result.diagnostic.selectedSource).toBe('legacy-fallback')
    expect(result.diagnostic.fallbackReason).toBe('new-candidate-not-selected-over-legacy')
  })

  it('D: follows established burden priority instead of introducing a new detour threshold', () => {
    const newer = candidate('new-d', ['walk'], 180)
    const legacy = candidate('legacy-d', ['stairs'], 100, 1)
    expect(evaluateShadowCutover({ candidates: [newer], legacyCandidate: legacy, paperSemanticValidation: { safe: true } }).diagnostic.selectedSource).toBe('new')
  })

  it('E: falls back when the evidence-aware selector has no proven winner', () => {
    const known = candidate('known-e', ['stairs'], 100, 1)
    const unresolved = uncertain(candidate('unresolved-e', ['walk'], 100))
    const legacy = candidate('legacy-e', ['walk'], 100)
    const result = evaluateShadowCutover({ candidates: [known, unresolved], legacyCandidate: legacy })
    expect(result.diagnostic.selectedSource).toBe('legacy-fallback')
    expect(result.newSelection.selected).toBeNull()
    expect(result.diagnostic.newSelectionBlockedBy).toBe('stairs')
  })

  it('F: an unknown GTFS-only candidate uses the same evidence fallback without station rules', () => {
    const newer = uncertain(candidate('unknown-station', ['walk'], 80))
    const legacy = candidate('legacy-f', ['escalator'], 100)
    const result = evaluateShadowCutover({ candidates: [newer], legacyCandidate: legacy, profile: MOBILITY_PROFILES['escalator-preferred'], paperSemanticValidation: { safe: true } })
    expect(result.diagnostic.selectedSource).toBe('legacy-fallback')
    expect(result.diagnostic.unresolvedReason).toContain('new:unresolved-equipment-groups=1')
  })

  it('is deterministic when candidate iteration order changes', () => {
    const candidates = [candidate('new-g1', ['walk'], 101), candidate('new-g2', ['walk'], 104)]
    const legacy = candidate('legacy-g', ['walk'], 105)
    for (const profile of Object.values(MOBILITY_PROFILES)) {
      const a = evaluateShadowCutover({ candidates, legacyCandidate: legacy, profile, paperSemanticValidation: { safe: true } }).diagnostic
      const b = evaluateShadowCutover({ candidates: [...candidates].reverse(), legacyCandidate: legacy, profile, paperSemanticValidation: { safe: true } }).diagnostic
      expect(b).toEqual(a)
    }
  })

  it('shadow-evaluates all supported courses at 50%/100% g+h budgets and validates paper route integrity', () => {
    const results = outingCoursePresets.map(course => {
      const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === course.arrivalStationId)!
      const graph = buildIndoorGraph(dataset.gtfs)
      const compression = buildRegisteredStationMapCompressionContext(dataset.station.id, graph)
      const platformId = course.arrivalPlatformAssignments[0].platformId
      const exits = [course.preferredExitId!].flat()
      const origins = [...new Set(platformOriginNodes(graph, platformId).map(origin => origin.id))].sort()
      const legacy = findBestElderlyRoute(graph, platformId, exits, compression)
      expect(legacy, course.label).toBeTruthy()
      const legacyCandidate = { score: legacy!, cost: computeRouteCost(legacy!.route, { graph, compression }) }

      const byBudget = [0.5, 1].map(factor => {
        const labelsPerOrigin = Math.max(1, Math.floor(DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS.maxTotalLabels * factor / Math.max(origins.length, 1)))
        const expansionsPerOrigin = Math.max(1, Math.floor(DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS.maxExpansions * factor / Math.max(origins.length, 1)))
        const completedPerOrigin = Math.max(1, Math.floor(DEFAULT_MULTI_OBJECTIVE_SEARCH_LIMITS.maxCompletedCandidates * factor / Math.max(origins.length, 1)))
        const searched = origins.map(origin => searchMultiObjectiveRoutesToTargets(graph, origin, exits, {
          compressionContext: compression, queueOrdering: 'distance-lower-bound', selectionMode: 'evidence-aware',
          limits: { maxTotalLabels: labelsPerOrigin, maxExpansions: expansionsPerOrigin, maxCompletedCandidates: completedPerOrigin },
        }))
        const found: MultiObjectiveCandidate[] = searched.flatMap(result => Object.values(result.exits).flatMap(exit => exit.candidates))
        const candidates: MobilityRouteCandidate[] = found.map(item => ({ score: scoreElderlyRoute(graph,
          item.originBoardingAreaId, item.targetExitId, item.route, compression), cost: item.routeCost }))
        const profiles = Object.values(MOBILITY_PROFILES).map(profile => {
          const selection = selectBestEvidenceAwareRoute(candidates, profile)
          let paperSemanticValidation: { safe: boolean; reason?: string } | undefined
          if (selection.selected) {
            const picked = selection.selected
            const built = buildGtfsStationGuideFromRoute(graph, dataset.station,
              { platformId, exitNodeId: picked.score.exitId }, picked.score.route, compression)
            if (!built.ok) paperSemanticValidation = { safe: false, reason: 'StationGuide generation failed for selected traversal' }
            else {
              const enriched = withVerifiedPathwayEnrichment(built.guide, graph, buildVerifiedPathwayEnrichments(graph))
              const paper = buildHomeToGateGuideModel({ guide: enriched, graph, platformId,
                exitNodeIds: [picked.score.exitId], selectedRoute: picked.score.route,
                metadata: stationOfficialGuidanceByStationId[dataset.station.id], compressionContext: compression,
                humanizeWalkDistance: true, humanizeGateDirection: true })
              const indices = paper.guide.steps.flatMap(step => step.evidence?.routeOrder?.flatMap(source =>
                source.traversals.map((_traversal, index) => source.firstRouteIndex + index)) ?? [])
              const ordered = indices.every((index, position) => position === 0 || indices[position - 1] <= index)
              const routeGateIds = picked.score.route.edges.filter(edge => edge.movementType === 'fare-gate').map(edge => edge.id)
              const paperGateIds = paper.guide.steps.filter(step => step.facility === 'gate').flatMap(step => step.evidence?.edgeIds ?? [])
              const gatesPreserved = JSON.stringify(paperGateIds) === JSON.stringify(routeGateIds)
              const actionGroupsValid = paper.guide.steps.every(step => {
                const types = new Set(step.evidence?.routeOrder?.map(source => source.semanticType) ?? [])
                return types.size <= 1
              })
              const enrichmentsValid = paper.guide.steps.every(step =>
                (step.evidence?.pathwayEnrichments ?? []).every(item => item.verified && picked.score.route.edges.some(edge => edge.id === item.pathwayId)))
              const rejoinSafe = !paper.hiddenHomeDetails || paper.safeRejoin.ok
              const safe = ordered && gatesPreserved && actionGroupsValid && enrichmentsValid && rejoinSafe
              paperSemanticValidation = { safe, reason: safe ? undefined : JSON.stringify({ ordered, gatesPreserved, actionGroupsValid, enrichmentsValid, rejoinSafe }) }
            }
          }
          const evaluated = evaluateShadowCutover({ candidates, legacyCandidate, profile, paperSemanticValidation })
          const key = (route: IndoorRoute | undefined) => route ? JSON.stringify(route.edges.map(edge => [edge.id, edge.fromNodeId, edge.toNodeId])) : null
          const pickedRoute = selection.selected?.score.route
          return { profile: profile.id, selectedSource: evaluated.diagnostic.selectedSource,
            fallbackReason: evaluated.diagnostic.fallbackReason ?? null,
            unresolvedReason: evaluated.diagnostic.unresolvedReason ?? null,
            newKey: key(pickedRoute), legacyKey: key(legacy!.route),
            routeCostDelta: evaluated.diagnostic.routeCostDelta,
            paperSemanticValidation: evaluated.diagnostic.paperSemanticValidation ?? null,
            candidates: candidates.length }
        })
        return { factor, complete: searched.every(result => result.complete), candidates: candidates.length,
          labels: searched.reduce((sum, result) => sum + result.exploredLabelCount, 0), profiles }
      })
      const stability = byBudget[0].profiles.map((low, index) => {
        const high = byBudget[1].profiles[index]
        return { profile: low.profile, stable: low.selectedSource === high.selectedSource && low.newKey === high.newKey }
      })
      return { course: course.label, station: dataset.station.name, origins: origins.length, exits: exits.length,
        budgets: byBudget, stability }
    })
    const selectedCount = results.flatMap(item => item.budgets[1].profiles).filter(item => item.selectedSource === 'new').length
    const fallbackCount = results.flatMap(item => item.budgets[1].profiles).filter(item => item.selectedSource === 'legacy-fallback').length
    const fallbackReasons = results.flatMap(item => item.budgets[1].profiles).reduce<Record<string, number>>((counts, item) => {
      const reason = item.fallbackReason ?? 'none'
      counts[reason] = (counts[reason] ?? 0) + 1
      return counts
    }, {})
    console.info('Shadow cutover assessment (diagnostic only)', JSON.stringify({ selectedCount, fallbackCount, fallbackReasons,
      stableProfileDecisions: results.flatMap(item => item.stability).filter(item => item.stable).length,
      totalProfileDecisions: results.flatMap(item => item.stability).length,
      courses: results.map(item => ({ course: item.course, station: item.station, origins: item.origins,
        budgets: item.budgets.map(budget => ({ percent: budget.factor * 100, complete: budget.complete,
          candidates: budget.candidates, labels: budget.labels, profiles: budget.profiles.map(({ newKey, legacyKey, ...profile }) => ({
            ...profile, newRouteDiffersFromLegacy: newKey !== null && newKey !== legacyKey,
          })) })), stability: item.stability })) }))
    expect(results).toHaveLength(12)
    expect(results.every(item => item.budgets.length === 2 && item.stability.length === 3)).toBe(true)
    expect(selectedCount + fallbackCount).toBe(36)
    expect(results.every(item => item.stability.every(profile => typeof profile.stable === 'boolean'))).toBe(true)
  }, 240_000)
})
