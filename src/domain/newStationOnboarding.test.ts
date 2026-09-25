import { afterEach, describe, expect, it } from 'vitest'
import type { RawGtfsPathwaysStationData, IndoorGraph, IndoorRouteCompressionContext } from './indoorRouting'
import { buildGtfsStationGuide, buildIndoorGraph, findPlatformGateLevelConsensus } from './indoorRouting'
import { withStationGuidePresentation, withWalkDistanceInstructions } from './stationGuidePresentation'
import { presentOfficialHomeGuidance } from './officialGuidancePresentation'
import type { OfficialGuidance } from '../data/stationOfficialGuidance'
import { findBestElderlyRoute } from './elderlyRouteScoring'
import { buildRegisteredStationMapCompressionContext, registerStationMap, stationMapRegistry } from '../data/stationMaps/registry'
import type { StationRef } from './types'

const TEST_STATION_ID = 'test-generic-official-guidance'

const station: StationRef = { id: TEST_STATION_ID, name: 'テスト新駅', operator: 'test operator', line: 'test line' }

const testStationMapMetadata = {
  facilities: [{ id: 'test-stair-group', category: 'stairs', latitude: 35.0003, longitude: 139 }],
  spaces: [{ id: 'test-b1', floor: 'B1', polygon: [[139, 35], [139.0001, 35], [139.0001, 35.0001]] }],
  floors: [{ id: 'test-floor-b1', ordinal: -1, name: '地下1階' }],
} as const

/** A deliberately synthetic station: B2 platform → B1 gate → ground exit. */
const gtfsOnlyFixture: RawGtfsPathwaysStationData = {
  stationId: TEST_STATION_ID,
  stationName: station.name,
  source: { name: 'synthetic onboarding fixture', url: 'https://example.test/test-generic-station', license: 'test', feedVersion: 'test-1', retrievedAt: '2026-09-22' },
  levels: [-2, -1.75, -1.5, -1, 0],
  stops: [
    { id: 'test-platform', name: '1', latitude: 35, longitude: 139, locationType: 0, levelIndex: -2, platformCode: '1' },
    { id: 'test-boarding', latitude: 35.00001, longitude: 139, locationType: 4, parentPlatformId: 'test-platform', levelIndex: -2 },
    { id: 'test-walk-before', latitude: 35.00011, longitude: 139, locationType: 3, levelIndex: -2 },
    { id: 'test-stairs-a', latitude: 35.00021, longitude: 139, locationType: 3, levelIndex: -1.75 },
    { id: 'test-landing', latitude: 35.00031, longitude: 139, locationType: 3, levelIndex: -1.5 },
    { id: 'test-stairs-b', latitude: 35.00041, longitude: 139, locationType: 3, levelIndex: -1 },
    { id: 'test-gate-approach', latitude: 35.00051, longitude: 139, locationType: 3, levelIndex: -1 },
    { id: 'test-gate', latitude: 35.00061, longitude: 139, locationType: 3, levelIndex: -1 },
    { id: 'test-gate-after', latitude: 35.00071, longitude: 139, locationType: 3, levelIndex: -1 },
    { id: 'test-exit', name: 'A1', latitude: 35.00081, longitude: 139, locationType: 2, levelIndex: 0 },
  ],
  pathways: [
    { id: 'test-walk-1', fromStopId: 'test-boarding', toStopId: 'test-walk-before', mode: 1, isBidirectional: false, lengthMeters: 12 },
    { id: 'test-stairs-1', fromStopId: 'test-walk-before', toStopId: 'test-stairs-a', mode: 2, isBidirectional: false, lengthMeters: 4 },
    { id: 'test-landing-walk', fromStopId: 'test-stairs-a', toStopId: 'test-landing', mode: 1, isBidirectional: false, lengthMeters: 2 },
    { id: 'test-stairs-2', fromStopId: 'test-landing', toStopId: 'test-stairs-b', mode: 2, isBidirectional: false, lengthMeters: 4 },
    { id: 'test-walk-2', fromStopId: 'test-stairs-b', toStopId: 'test-gate-approach', mode: 1, isBidirectional: false, lengthMeters: 4 },
    { id: 'test-gate-edge', fromStopId: 'test-gate-approach', toStopId: 'test-gate', mode: 6, isBidirectional: false, lengthMeters: 1 },
    { id: 'test-walk-3', fromStopId: 'test-gate', toStopId: 'test-gate-after', mode: 1, isBidirectional: false, lengthMeters: 3 },
    { id: 'test-walk-4', fromStopId: 'test-gate-after', toStopId: 'test-exit', mode: 1, isBidirectional: false, lengthMeters: 12 },
  ],
}

function buildTestMapContext(graph: IndoorGraph): IndoorRouteCompressionContext {
  const pathwayIds = ['test-stairs-1', 'test-landing-walk', 'test-stairs-2']
  const byPathwayId = Object.fromEntries(pathwayIds.map(pathwayId => [pathwayId, { facilityId: testStationMapMetadata.facilities[0].id, facilityGroupId: testStationMapMetadata.facilities[0].id, spaceId: testStationMapMetadata.spaces[0].id }]))
  const nonBranchingNodeIds = new Set(graph.nodes.keys())
  return { byPathwayId, nonBranchingNodeIds, allowDecisionFreeStairBridges: true }
}

afterEach(() => {
  stationMapRegistry.delete(TEST_STATION_ID)
})

describe('new-station onboarding', () => {
  it('generates a basic guide from GTFS only, with no station registration', () => {
    const graph = buildIndoorGraph(gtfsOnlyFixture)
    const result = buildGtfsStationGuide(graph, station, { platformId: 'test-platform', exitNodeId: 'test-exit' })
    expect(result).toMatchObject({ ok: true })
    expect(findPlatformGateLevelConsensus(graph, 'test-platform', ['test-exit'])).toMatchObject({ platformLevel: -2, gateLevel: -1, direction: 'up', candidateCount: 1 })
    if (!result.ok) return
    const guide = withWalkDistanceInstructions(withStationGuidePresentation(result.guide), { enabled: true })
    expect(guide.sections?.map(section => section.id)).toEqual(['platform-to-gate', 'gate-to-exit', 'to-ground'])
    expect(guide.steps.some(step => step.facility === 'gate' && step.instruction === '改札を通る')).toBe(true)
    expect(guide.steps.filter(step => step.facility === 'stairs')).toHaveLength(2)
    expect(guide.steps.some(step => step.instruction.startsWith('通路を約'))).toBe(true)
  })

  it('enables map-backed stair grouping through the registry without App/runtime exceptions', () => {
    const graph = buildIndoorGraph(gtfsOnlyFixture)
    registerStationMap(TEST_STATION_ID, buildTestMapContext)
    const context = buildRegisteredStationMapCompressionContext(TEST_STATION_ID, graph)
    expect(context?.byPathwayId['test-stairs-1']?.facilityGroupId).toBe('test-stair-group')
    expect(findBestElderlyRoute(graph, 'test-platform', ['test-exit'], context)?.originId).toBe('test-boarding')
    const result = buildGtfsStationGuide(graph, station, { platformId: 'test-platform', exitNodeId: 'test-exit' }, 'shortest', context)
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) return
    const stairs = result.guide.steps.filter(step => step.facility === 'stairs')
    expect(stairs).toHaveLength(1)
    expect(stairs[0].instruction).toBe('階段を上がる')
    expect(stairs[0].evidence?.edgeIds).toEqual(['test-stairs-1', 'test-landing-walk', 'test-stairs-2'])
    expect(stairs[0].evidence?.mapLocations?.map(location => location.pathwayId)).toEqual(['test-stairs-1', 'test-landing-walk', 'test-stairs-2'])
  })

  it('falls back safely when the map registry has no entry', () => {
    const graph = buildIndoorGraph(gtfsOnlyFixture)
    expect(buildRegisteredStationMapCompressionContext(TEST_STATION_ID, graph)).toBeUndefined()
    const result = buildGtfsStationGuide(graph, station, { platformId: 'test-platform', exitNodeId: 'test-exit' }, 'shortest', undefined)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.guide.steps.filter(step => step.facility === 'stairs')).toHaveLength(2)
  })

  it('generates scoped official home guidance for an unknown station without station-specific runtime logic', () => {
    const graph = buildIndoorGraph(gtfsOnlyFixture)
    const consensus = findPlatformGateLevelConsensus(graph, 'test-platform', ['test-exit'])
    const officialGuidance: OfficialGuidance[] = [
      {
        scope: 'platform-to-gate',
        carPositions: ['5号車付近'],
        equipment: 'elevator',
        direction: null,
        source: { url: 'https://example.test/official-map' },
      },
      {
        scope: 'gate-to-exit',
        equipment: 'escalator',
        direction: null,
        source: { url: 'https://example.test/official-map' },
      },
    ]

    const presentation = presentOfficialHomeGuidance(officialGuidance, consensus?.direction)
    expect(presentation.carPositionHint).toBe('できれば5号車付近に乗る')
    expect(presentation.homeInstruction).toBe('エレベーターで改札階へ上がる')
    expect(presentation.homeInstruction).not.toContain('エスカレーター')
  })

  it('does not invent up/down when neither official direction nor GTFS consensus exists', () => {
    const guidance: OfficialGuidance[] = [{
      scope: 'platform-to-gate',
      carPositions: ['5号車付近'],
      equipment: 'elevator',
      direction: null,
      source: { url: 'https://example.test/official-map' },
    }]
    const presentation = presentOfficialHomeGuidance(guidance)
    expect(presentation.homeInstruction).toBe('エレベーターを使う')
    expect(presentation.homeInstruction).not.toMatch(/上がる|下りる/)
  })

  it('uses explicit official direction when present', () => {
    const guidance: OfficialGuidance[] = [{
      scope: 'platform-to-gate',
      equipment: 'escalator',
      direction: 'down',
      source: { url: 'https://example.test/official-map' },
    }]
    expect(presentOfficialHomeGuidance(guidance).homeInstruction).toBe('エスカレーターで改札階へ下りる')
  })
})
