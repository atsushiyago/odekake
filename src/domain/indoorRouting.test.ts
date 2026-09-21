import { describe, expect, it } from 'vitest'
import { akabanebashiGtfsPathways } from '../data/fixtures/akabanebashi-gtfs-pathways'
import { buildAkabanebashiStationMapCompressionContext, buildAkabanebashiStationMapOverlay } from '../data/stationMaps/akabanebashi'
import { buildGtfsStationGuide, buildIndoorGraph, buildVerifiedStationGuide, commonRouteSuffix, compactIndoorRouteSteps, findIndoorRoute, findRoutesFromPlatform, formatIndoorStep, isValidVerifiedIndoorRouteAnchor, platformOriginNodes, resolveVerifiedIndoorRoute, routePreferenceSupport } from './indoorRouting'
import { buildWalkingNetworkGraph, type RawWalkingNetworkStationData } from './walkingNetwork'

describe('indoor routing safety gates', () => {
  it('does not manufacture a shared suffix when candidate routes have none', () => {
    const routes = [
      { edges: [{ id: 'a' }, { id: 'b' }] },
      { edges: [{ id: 'c' }, { id: 'd' }] }
    ] as never
    expect(commonRouteSuffix(routes)).toEqual([])
  })

  it('rejects an unreviewed origin that is not a boarding area on the stated platform', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    const result = resolveVerifiedIndoorRoute(graph, {
      stationId: '422', platformId: '422P1', boardingAreaId: 'invented-node', exitNodeId: '422N0012',
      verifiedBy: 'test', verifiedAt: '2026-09-20', evidenceUrl: 'https://example.invalid/evidence'
    })
    expect(result).toEqual({ ok: false, reason: 'origin-not-on-platform' })
  })

  it('rejects an anchor with missing review evidence even if its graph nodes are valid', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    const origin = platformOriginNodes(graph, '422P1')[0]
    const anchor = { stationId: '422', platformId: '422P1', boardingAreaId: origin.id, exitNodeId: '422N0012', verifiedBy: '', verifiedAt: 'not-a-date', evidenceUrl: 'not-a-url' }
    expect(isValidVerifiedIndoorRouteAnchor(anchor)).toBe(false)
    expect(resolveVerifiedIndoorRoute(graph, anchor)).toEqual({ ok: false, reason: 'invalid-review-record' })
  })

  it('requires a real calendar date and HTTPS review evidence', () => {
    const anchor = { stationId: '422', platformId: '422P1', boardingAreaId: '422N0001', exitNodeId: '422N0012', verifiedBy: 'reviewer', verifiedAt: '2026-99-99', evidenceUrl: 'http://example.invalid/evidence' }
    expect(isValidVerifiedIndoorRouteAnchor(anchor)).toBe(false)
  })

  it('resolves a route only after an exact valid boarding area is supplied', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    const origin = platformOriginNodes(graph, '422P1')[0]
    const result = resolveVerifiedIndoorRoute(graph, {
      stationId: '422', platformId: '422P1', boardingAreaId: origin.id, exitNodeId: '422N0012',
      verifiedBy: 'test', verifiedAt: '2026-09-20', evidenceUrl: 'https://example.invalid/evidence'
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.route.edges.length).toBeGreaterThan(0)
  })

  it('omits walking-network links whose direction is unknown', () => {
    const raw: RawWalkingNetworkStationData = {
      source: { name: 'test', url: 'https://example.invalid', license: 'test', feedVersion: 'test', retrievedAt: '2026-09-20' }, stationId: 'test', stationName: 'test',
      nodes: [{ id: 'a', latitude: 0, longitude: 0 }, { id: 'b', latitude: 0, longitude: 1 }],
      links: [{ id: 'unknown-direction', startNodeId: 'a', endNodeId: 'b', distanceMeters: 1, routeType: 1, direction: 99 }]
    }
    const result = buildWalkingNetworkGraph(raw)
    expect(result.graph.edges).toHaveLength(0)
    expect(result.skippedUnknownDirectionLinkIds).toEqual(['unknown-direction'])
  })

  it('merges only contiguous route edges of the same movement type', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    const origin = platformOriginNodes(graph, '422P1')[0]
    const resolved = resolveVerifiedIndoorRoute(graph, {
      stationId: '422', platformId: '422P1', boardingAreaId: origin.id, exitNodeId: '422N0012',
      verifiedBy: 'test', verifiedAt: '2026-09-20', evidenceUrl: 'https://example.invalid/evidence'
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    const compact = compactIndoorRouteSteps(resolved.route)
    expect(compact.length).toBeLessThanOrEqual(resolved.route.edges.length)
    expect(compact.flatMap(step => step.evidence.edgeIds)).toEqual(resolved.route.edges.map(edge => edge.id))
  })

  it('does not invent an up or down direction when the source levels cannot establish one', () => {
    expect(formatIndoorStep({ type: 'stairs', distanceMeters: 2, evidence: { edgeIds: ['e'], fromNodeId: 'a', toNodeId: 'b' } })).toBe('階段を使う')
    expect(formatIndoorStep({ type: 'exit-gate', distanceMeters: 1, evidence: { edgeIds: ['gate'], fromNodeId: 'a', toNodeId: 'b' } })).toBe('改札を通る')
  })

  it('does not label a route wheelchair-accessible from elevator edges alone', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    expect(routePreferenceSupport('wheelchair-accessible')).toEqual({ supported: false, reason: expect.any(String) })
    expect(findIndoorRoute(graph, '422N0000', '422N0012', 'wheelchair-accessible')).toBeNull()
  })

  it('builds a printable StationGuide only from an exact reviewed anchor and reviewed labels', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    const origin = platformOriginNodes(graph, '422P1')[0]
    const result = buildVerifiedStationGuide(graph, { id: '422', name: '赤羽橋', operator: '東京都交通局', line: '大江戸線' }, {
      stationId: '422', platformId: '422P1', boardingAreaId: origin.id, exitNodeId: '422N0012', verifiedBy: 'reviewer', verifiedAt: '2026-09-20', evidenceUrl: 'https://example.invalid/official-map'
    }, {
      arrivalPlatformLabel: '1番ホーム', gateLabel: '確認済み改札', exitLabel: '赤羽橋口', safeAlternative: '駅係員にこの紙を見せて確認してください。'
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.guide.confidence).toBe('verified')
      expect(result.guide.steps.at(-1)?.instruction).toBe('赤羽橋口へ進む。')
      expect(result.guide.officialSourceUrl).toBe('https://example.invalid/official-map')
      expect(result.guide.steps[0].evidence?.source).toBe('gtfs-pathways')
      expect(result.guide.steps.at(-1)?.evidence?.source).toBe('manual-review')
    }
  })

  it('retains GTFS fare gates as semantic events even when an exceptional boarding area bypasses them', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    const result = buildGtfsStationGuide(graph, { id: '422', name: '赤羽橋', operator: '東京都交通局', line: '大江戸線' }, { platformId: '422P2', exitNodeId: '422N0012' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.guide.confidence).toBe('needs-review')
    expect(result.guide.verifiedBy).toBeUndefined()
    expect(result.guide.gate).toBe('')
    expect(result.guide.arrivalPlatform).toBe('2番ホーム')
    expect(result.guide.exit).toBe('赤羽橋口')
    expect(result.guide.dataSource).toMatchObject({ type: 'gtfs-pathways', humanReviewed: false, scope: 'semantic-event-backbone', feedVersion: '20260917' })
    expect(result.guide.steps.every(step => step.evidence?.source === 'gtfs-pathways')).toBe(true)
    const gate = result.guide.steps.find(step => step.evidence?.edgeIds?.includes('422L0070'))
    expect(gate).toMatchObject({ instruction: '改札を通る', facility: 'gate' })
    expect(gate?.evidence?.candidateCoverage).toEqual({ matchingOrigins: 11, totalOrigins: 12, allRoutesHaveEvent: false })
    expect(result.guide.steps.flatMap(step => step.evidence?.edgeIds ?? [])).toContain('422L0070')
    expect(result.guide.steps.at(-1)).toMatchObject({ instruction: '赤羽橋口へ出る', facility: 'exit' })
  })

  it('can safely absorb a short walkway only when published map overlay proves one facility and one space', () => {
    const route = {
      nodes: [
        { id: 'a', latitude: 0, longitude: 0, locationType: 3, kind: 'internal' }, { id: 'b', latitude: 0, longitude: 0.0001, locationType: 3, kind: 'internal' },
        { id: 'c', latitude: 0, longitude: 0.00011, locationType: 3, kind: 'internal' }, { id: 'd', latitude: 0, longitude: 0.0002, locationType: 3, kind: 'internal' }
      ],
      edges: [
        { id: 'stairs-a', fromNodeId: 'a', toNodeId: 'b', lengthMeters: 2, movementType: 'stairs', sourceType: 'gtfs-pathways' },
        { id: 'landing', fromNodeId: 'b', toNodeId: 'c', lengthMeters: 1, movementType: 'walk', sourceType: 'gtfs-pathways' },
        { id: 'stairs-b', fromNodeId: 'c', toNodeId: 'd', lengthMeters: 2, movementType: 'stairs', sourceType: 'gtfs-pathways' }
      ], distanceMeters: 5
    } as never
    const compact = compactIndoorRouteSteps(route, { byPathwayId: {
      'stairs-a': { facilityId: 'stairs-1', spaceId: 'space-1' }, landing: { spaceId: 'space-1' }, 'stairs-b': { facilityId: 'stairs-1', spaceId: 'space-1' }
    } })
    expect(compact).toHaveLength(1)
    expect(compact[0].evidence.edgeIds).toEqual(['stairs-a', 'landing', 'stairs-b'])
  })

  it('does not merge separate facilities just because they have the same movement type', () => {
    const route = {
      nodes: [
        { id: 'a', latitude: 0, longitude: 0, locationType: 3, kind: 'internal' }, { id: 'b', latitude: 0, longitude: 0.0001, locationType: 3, kind: 'internal' },
        { id: 'c', latitude: 0, longitude: 0.00011, locationType: 3, kind: 'internal' }, { id: 'd', latitude: 0, longitude: 0.0002, locationType: 3, kind: 'internal' }
      ],
      edges: [
        { id: 'stairs-a', fromNodeId: 'a', toNodeId: 'b', lengthMeters: 2, movementType: 'stairs', sourceType: 'gtfs-pathways' },
        { id: 'landing', fromNodeId: 'b', toNodeId: 'c', lengthMeters: 1, movementType: 'walk', sourceType: 'gtfs-pathways' },
        { id: 'stairs-b', fromNodeId: 'c', toNodeId: 'd', lengthMeters: 2, movementType: 'stairs', sourceType: 'gtfs-pathways' }
      ], distanceMeters: 5
    } as never
    const compact = compactIndoorRouteSteps(route, { byPathwayId: {
      'stairs-a': { facilityId: 'stairs-1', spaceId: 'space-1' }, landing: { spaceId: 'space-1' }, 'stairs-b': { facilityId: 'stairs-2', spaceId: 'space-2' }
    } })
    expect(compact).toHaveLength(3)
  })

  it('compresses contiguous elevator edges in one verified facility into one upward action', () => {
    const route = {
      nodes: [
        { id: 'a', latitude: 0, longitude: 0, levelIndex: -5, locationType: 3, kind: 'internal' },
        { id: 'b', latitude: 0, longitude: 0, levelIndex: -5, locationType: 3, kind: 'internal' },
        { id: 'c', latitude: 0, longitude: 0, levelIndex: -1, locationType: 3, kind: 'internal' },
        { id: 'd', latitude: 0, longitude: 0, levelIndex: -1, locationType: 3, kind: 'internal' },
      ],
      edges: [
        { id: 'elevator-board', fromNodeId: 'a', toNodeId: 'b', lengthMeters: 1.4, movementType: 'elevator', sourceType: 'gtfs-pathways' },
        { id: 'elevator-rise', fromNodeId: 'b', toNodeId: 'c', lengthMeters: 0.1, movementType: 'elevator', sourceType: 'gtfs-pathways' },
        { id: 'elevator-exit', fromNodeId: 'c', toNodeId: 'd', lengthMeters: 1.3, movementType: 'elevator', sourceType: 'gtfs-pathways' },
      ], distanceMeters: 2.8,
    } as never
    const compact = compactIndoorRouteSteps(route, { byPathwayId: {
      'elevator-board': { facilityId: 'F012-test', spaceId: 'space-elevator' },
      'elevator-rise': { facilityId: 'F012-test', spaceId: 'space-elevator' },
      'elevator-exit': { facilityId: 'F012-test', spaceId: 'space-elevator' },
    } })
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirection).toBe('up')
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで上がる')
    expect(compact[0].evidence.edgeIds).toEqual(['elevator-board', 'elevator-rise', 'elevator-exit'])
    expect(compact[0].evidence.fromLevelIndex).toBe(-5)
    expect(compact[0].evidence.toLevelIndex).toBe(-1)
  })

  it('absorbs a short non-branching same-level elevator connector without merging facilities', () => {
    const route = {
      nodes: [
        { id: 'a', latitude: 0, longitude: 0, levelIndex: -1, locationType: 3, kind: 'internal' },
        { id: 'b', latitude: 0, longitude: 0, levelIndex: -1, locationType: 3, kind: 'internal' },
        { id: 'c', latitude: 0, longitude: 0, levelIndex: 0, locationType: 3, kind: 'internal' },
      ],
      edges: [
        { id: 'connector', fromNodeId: 'a', toNodeId: 'b', lengthMeters: 1.6, movementType: 'elevator', sourceType: 'gtfs-pathways' },
        { id: 'vertical', fromNodeId: 'b', toNodeId: 'c', lengthMeters: 0.3, movementType: 'elevator', sourceType: 'gtfs-pathways' },
      ], distanceMeters: 1.9,
    } as never
    const compact = compactIndoorRouteSteps(route, {
      byPathwayId: {
        connector: { facilityId: 'facility-a', spaceId: 'space-a' },
        vertical: { facilityId: 'facility-b', spaceId: 'space-b' },
      },
      nonBranchingNodeIds: new Set(['b']),
    })
    expect(compact).toHaveLength(1)
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで上がる')
    expect(compact[0].evidence.edgeIds).toEqual(['connector', 'vertical'])
    expect(compact[0].evidence.mapLocations?.map(location => location.facilityId)).toEqual(['facility-a', 'facility-b'])
    expect(compact[0].evidence.fromLevelIndex).toBe(-1)
    expect(compact[0].evidence.toLevelIndex).toBe(0)
  })

  it('does not absorb a same-level elevator connector when the intermediate node branches', () => {
    const route = {
      nodes: [
        { id: 'a', latitude: 0, longitude: 0, levelIndex: -1, locationType: 3, kind: 'internal' },
        { id: 'b', latitude: 0, longitude: 0, levelIndex: -1, locationType: 3, kind: 'internal' },
        { id: 'c', latitude: 0, longitude: 0, levelIndex: 0, locationType: 3, kind: 'internal' },
      ],
      edges: [
        { id: 'connector', fromNodeId: 'a', toNodeId: 'b', lengthMeters: 1.6, movementType: 'elevator', sourceType: 'gtfs-pathways' },
        { id: 'vertical', fromNodeId: 'b', toNodeId: 'c', lengthMeters: 0.3, movementType: 'elevator', sourceType: 'gtfs-pathways' },
      ], distanceMeters: 1.9,
    } as never
    const compact = compactIndoorRouteSteps(route, {
      byPathwayId: {
        connector: { facilityId: 'facility-a', spaceId: 'space-a' },
        vertical: { facilityId: 'facility-b', spaceId: 'space-b' },
      },
      nonBranchingNodeIds: new Set(),
    })
    expect(compact).toHaveLength(2)
  })

  it('absorbs a short non-branching connector between same-direction stairs', () => {
    const route = {
      nodes: [
        { id: 'a', latitude: 0, longitude: 0, levelIndex: 0, locationType: 3, kind: 'internal' },
        { id: 'b', latitude: 0, longitude: 0.0001, levelIndex: 1, locationType: 3, kind: 'internal' },
        { id: 'c', latitude: 0, longitude: 0.00011, levelIndex: 1, locationType: 3, kind: 'internal' },
        { id: 'd', latitude: 0, longitude: 0.0002, levelIndex: 2, locationType: 3, kind: 'internal' },
      ],
      edges: [
        { id: 'stairs-a', fromNodeId: 'a', toNodeId: 'b', lengthMeters: 4, movementType: 'stairs', sourceType: 'gtfs-pathways' },
        { id: 'short-landing', fromNodeId: 'b', toNodeId: 'c', lengthMeters: 2, movementType: 'walk', sourceType: 'gtfs-pathways' },
        { id: 'stairs-b', fromNodeId: 'c', toNodeId: 'd', lengthMeters: 4, movementType: 'stairs', sourceType: 'gtfs-pathways' },
      ], distanceMeters: 10,
    } as never
    const context = { byPathwayId: {
      'stairs-a': { facilityId: 'F011-same', spaceId: 'space-a' },
      'short-landing': { spaceId: 'space-landing' },
      'stairs-b': { facilityId: 'F011-same', spaceId: 'space-b' },
    }, nonBranchingNodeIds: new Set(['b', 'c']) }
    const compact = compactIndoorRouteSteps(route, context)
    expect(compact).toHaveLength(1)
    expect(compact[0].evidence.edgeIds).toEqual(['stairs-a', 'short-landing', 'stairs-b'])
    expect(formatIndoorStep(compact[0])).toBe('階段を上がる')
    expect(compact[0].evidence.fromLevelIndex).toBe(0)
    expect(compact[0].evidence.toLevelIndex).toBe(2)
  })

  it('does not absorb a short connector when branch evidence is unavailable', () => {
    const route = {
      nodes: [
        { id: 'a', latitude: 0, longitude: 0, levelIndex: 0, locationType: 3, kind: 'internal' },
        { id: 'b', latitude: 0, longitude: 0.0001, levelIndex: 1, locationType: 3, kind: 'internal' },
        { id: 'c', latitude: 0, longitude: 0.00011, levelIndex: 1, locationType: 3, kind: 'internal' },
        { id: 'd', latitude: 0, longitude: 0.0002, levelIndex: 2, locationType: 3, kind: 'internal' },
      ],
      edges: [
        { id: 'stairs-a', fromNodeId: 'a', toNodeId: 'b', lengthMeters: 4, movementType: 'stairs', sourceType: 'gtfs-pathways' },
        { id: 'short-landing', fromNodeId: 'b', toNodeId: 'c', lengthMeters: 2, movementType: 'walk', sourceType: 'gtfs-pathways' },
        { id: 'stairs-b', fromNodeId: 'c', toNodeId: 'd', lengthMeters: 4, movementType: 'stairs', sourceType: 'gtfs-pathways' },
      ], distanceMeters: 10,
    } as never
    const compact = compactIndoorRouteSteps(route, { byPathwayId: {
      'stairs-a': { facilityId: 'F011-same', spaceId: 'space-a' },
      'short-landing': { spaceId: 'space-landing' },
      'stairs-b': { facilityId: 'F011-same', spaceId: 'space-b' },
    } })
    expect(compact).toHaveLength(3)
  })

  it('merges a cross-facility stair bridge when the published Space is continuous', () => {
    const route = {
      nodes: [
        { id: 'a', latitude: 0, longitude: 0, levelIndex: 0, locationType: 3, kind: 'internal' },
        { id: 'b', latitude: 0, longitude: 0.0001, levelIndex: 1, locationType: 3, kind: 'internal' },
        { id: 'c', latitude: 0, longitude: 0.00011, levelIndex: 1, locationType: 3, kind: 'internal' },
        { id: 'd', latitude: 0, longitude: 0.0002, levelIndex: 2, locationType: 3, kind: 'internal' },
      ],
      edges: [
        { id: 'stairs-a', fromNodeId: 'a', toNodeId: 'b', lengthMeters: 4, movementType: 'stairs', sourceType: 'gtfs-pathways' },
        { id: 'landing', fromNodeId: 'b', toNodeId: 'c', lengthMeters: 1.5, movementType: 'walk', sourceType: 'gtfs-pathways' },
        { id: 'stairs-b', fromNodeId: 'c', toNodeId: 'd', lengthMeters: 4, movementType: 'stairs', sourceType: 'gtfs-pathways' },
      ], distanceMeters: 9.5,
    } as never
    const compact = compactIndoorRouteSteps(route, { nonBranchingNodeIds: new Set(['b', 'c']), byPathwayId: {
      'stairs-a': { facilityId: 'F011-a', spaceId: 'continuous-space' }, landing: { spaceId: 'continuous-space' }, 'stairs-b': { facilityId: 'F011-b', spaceId: 'continuous-space' },
    } })
    expect(compact).toHaveLength(1)
    expect(compact[0].evidence.edgeIds).toEqual(['stairs-a', 'landing', 'stairs-b'])
  })

  it('can merge different same-direction stair facilities only with the explicit decision-free trial flag', () => {
    const route = {
      nodes: [
        { id: 'a', latitude: 0, longitude: 0, levelIndex: 0, locationType: 3, kind: 'internal' },
        { id: 'b', latitude: 0, longitude: 0.0001, levelIndex: 1, locationType: 3, kind: 'internal' },
        { id: 'c', latitude: 0, longitude: 0.00011, levelIndex: 1, locationType: 3, kind: 'internal' },
        { id: 'd', latitude: 0, longitude: 0.0002, levelIndex: 2, locationType: 3, kind: 'internal' },
      ],
      edges: [
        { id: 'stairs-a', fromNodeId: 'a', toNodeId: 'b', lengthMeters: 4, movementType: 'stairs', sourceType: 'gtfs-pathways' },
        { id: 'landing', fromNodeId: 'b', toNodeId: 'c', lengthMeters: 1.5, movementType: 'walk', sourceType: 'gtfs-pathways' },
        { id: 'stairs-b', fromNodeId: 'c', toNodeId: 'd', lengthMeters: 4, movementType: 'stairs', sourceType: 'gtfs-pathways' },
      ], distanceMeters: 9.5,
    } as never
    const compact = compactIndoorRouteSteps(route, { allowDecisionFreeStairBridges: true, nonBranchingNodeIds: new Set(['b', 'c']), byPathwayId: { 'stairs-a': { facilityId: 'F011-a' }, landing: { spaceId: 'landing' }, 'stairs-b': { facilityId: 'F011-b' } } })
    expect(compact).toHaveLength(1)
    expect(compact[0].evidence.edgeIds).toEqual(['stairs-a', 'landing', 'stairs-b'])
  })

  it('uses a neutral elevator instruction when a merged run changes direction ambiguously', () => {
    const route = {
      nodes: [
        { id: 'a', latitude: 0, longitude: 0, levelIndex: -1, locationType: 3, kind: 'internal' },
        { id: 'b', latitude: 0, longitude: 0, levelIndex: -2, locationType: 3, kind: 'internal' },
        { id: 'c', latitude: 0, longitude: 0, levelIndex: -1, locationType: 3, kind: 'internal' },
      ],
      edges: [
        { id: 'down', fromNodeId: 'a', toNodeId: 'b', lengthMeters: 1, movementType: 'elevator', sourceType: 'gtfs-pathways' },
        { id: 'up', fromNodeId: 'b', toNodeId: 'c', lengthMeters: 1, movementType: 'elevator', sourceType: 'gtfs-pathways' },
      ], distanceMeters: 2,
    } as never
    const compact = compactIndoorRouteSteps(route, { byPathwayId: { down: { facilityId: 'F012-test' }, up: { facilityId: 'F012-test' } } })
    expect(compact).toHaveLength(1)
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで移動する')
    expect(compact[0].verticalDirection).toBeUndefined()
  })

  it('maps the real Akabanebashi GeoJSON to pathway provenance without changing routing', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    const overlay = buildAkabanebashiStationMapOverlay(graph)
    expect(Object.keys(overlay.byPathwayId).length).toBeGreaterThan(0)
    expect(overlay.byPathwayId['422L0039']?.facilityId).toBeDefined()
    const context = buildAkabanebashiStationMapCompressionContext(graph)
    const result = buildGtfsStationGuide(graph, { id: '422', name: '赤羽橋', operator: '東京都交通局', line: '大江戸線' }, { platformId: '422P2', exitNodeId: '422N0012' }, 'shortest', context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.guide.steps.some(step => step.facility === 'gate' && step.evidence?.edgeIds?.includes('422L0070'))).toBe(true)
    expect(result.guide.steps.some(step => step.facility === 'escalator' && (step.evidence?.mapLocations?.some(location => location.facilityId)))).toBe(true)
    expect(result.guide.steps.flatMap(step => step.evidence?.edgeIds ?? [])).toContain('422L0070')
  })

  it('records the one real boarding-area exception instead of treating fare gate coverage as 12/12', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    const candidates = findRoutesFromPlatform(graph, '422P2', '422N0012')
    expect(candidates).toHaveLength(12)
    const exception = candidates.find(candidate => candidate.origin.id === '422N0080')
    expect(exception).toBeDefined()
    expect(exception?.route.edges.some(edge => edge.id === '422L0070')).toBe(false)
    expect(exception?.route.edges.map(edge => edge.id)).toEqual(['422L0046', '422L0055', '422L0052', '422L0053', '422L0044', '422L0115', '422L0116', '422L0107', '422L0108', '422L0109', '422L0110', '422L0111', '422L0112', '422L0130', '422L0136'])
    expect(candidates.filter(candidate => candidate.route.edges.some(edge => edge.id === '422L0070'))).toHaveLength(11)
  })
})
