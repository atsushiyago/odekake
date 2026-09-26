import { describe, expect, it } from 'vitest'
import { loadedOedo2026IndoorDatasets } from '../data/catalogs/oedo2026IndoorDatasets'
import { buildGtfsStationGuide, buildGtfsStationGuideFromRoute, buildIndoorGraph, findPlatformGateLevelConsensus } from './indoorRouting'
import { buildRoppongiStationMapCompressionContext, buildRoppongiStationMapOverlay } from '../data/stationMaps/roppongi'
import { buildKokuritsuKyogijoStationMapCompressionContext, buildKokuritsuKyogijoStationMapOverlay } from '../data/stationMaps/kokuritsuKyogijo'
import { buildDaimonStationMapCompressionContext, buildDaimonStationMapOverlay } from '../data/stationMaps/daimon'
import { buildAzabuJubanStationMapCompressionContext, buildAzabuJubanStationMapOverlay } from '../data/stationMaps/azabuJuban'
import { buildAoyamaItchomeStationMapCompressionContext, buildAoyamaItchomeStationMapOverlay } from '../data/stationMaps/aoyamaItchome'
import { buildYoyogiStationMapCompressionContext, buildYoyogiStationMapOverlay } from '../data/stationMaps/yoyogi'
import { buildHigashiShinjukuStationMapCompressionContext, buildHigashiShinjukuStationMapOverlay } from '../data/stationMaps/higashiShinjuku'
import { buildShinjukuStationMapCompressionContext, buildShinjukuStationMapOverlay } from '../data/stationMaps/shinjuku'
import { buildShinjukuNishiguchiStationMapCompressionContext, buildShinjukuNishiguchiStationMapOverlay } from '../data/stationMaps/shinjukuNishiguchi'
import { buildUenoOkachimachiStationMapCompressionContext, buildUenoOkachimachiStationMapOverlay } from '../data/stationMaps/uenoOkachimachi'
import { buildTochomaeStationMapCompressionContext, buildTochomaeStationMapOverlay } from '../data/stationMaps/tochomae'
import { buildAkabanebashiStationMapCompressionContext } from '../data/stationMaps/akabanebashi'
import { summarizeStationGuide } from './stationGuidePresentation'
import { findBestElderlyRoute } from './elderlyRouteScoring'
import { findSafeGateRejoin } from './safeRejoin'

describe('course station guides', () => {
  it('finds the generic partial-escalator route for Daimon B2', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '421')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const score = findBestElderlyRoute(graph, '421P3', ['421N0015'], buildDaimonStationMapCompressionContext(graph))
    expect(score).toMatchObject({ stairs: 2, escalators: 4, elevators: 0 })
    expect(score?.distanceMeters).toBeCloseTo(193.8, 5)
    expect(score?.route.edges.map(edge => edge.id)).toContain('421L0168')
    expect(score?.route.edges.map(edge => edge.id)).toContain('421L0310')
  })

  it.each([
    ['421', '421P3', ['421N0012'], -5, -3],
    ['423', '423P2', ['423N0063'], -6, -4],
    ['427', '427P2', ['427N0084', '427N0032'], -3, -1],
    ['403', '403P2', ['403N0019', '403N0020'], -3, -2],
    ['402', '402P1', ['402N0048'], -4, -3],
    ['429', '429P4', ['429N0093'], -3, -2],
  ])('finds generic upward platform-to-gate consensus for station %s', (stationId, platformId, exitIds, platformLevel, gateLevel) => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === stationId)!
    const consensus = findPlatformGateLevelConsensus(buildIndoorGraph(dataset.gtfs), platformId, exitIds)
    expect(consensus).toMatchObject({ platformLevel, gateLevel, direction: 'up' })
    expect(consensus?.candidateCount).toBeGreaterThan(0)
  })

  it('builds the Roppongi platform 2 to exit 7 guide', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '424')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const result = buildGtfsStationGuide(graph, dataset.station, { platformId: '424P2', exitNodeId: '424N0053' }, 'shortest', buildRoppongiStationMapCompressionContext(graph))
    expect(result).toMatchObject({ ok: true, guide: { arrivalPlatform: '2番ホーム', exit: '7' } })
      if (result.ok) {
      const elevatorSteps = result.guide.steps.filter(step => step.facility === 'elevator')
      expect(elevatorSteps).toHaveLength(1)
      expect(elevatorSteps[0].instruction).toBe('エレベーターで上がる')
      expect(elevatorSteps[0].evidence?.edgeIds).toEqual(['424L0239', '424L0151', '424L0104'])
      expect(result.guide.steps).toHaveLength(8)
      expect(result.guide.steps.filter(step => step.facility === 'stairs').map(step => step.evidence?.edgeIds)).toEqual([
        ['424L0008', '424L0009', '424L0010', '424L0011', '424L0012', '424L0013', '424L0014'],
      ])
    }
  })

  it('maps the Roppongi elevator run to one published F012 facility', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '424')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const overlay = buildRoppongiStationMapOverlay(graph)
    expect(overlay.byPathwayId['424L0239']?.facilityId).toBeDefined()
    expect(overlay.byPathwayId['424L0151']?.facilityId).toBe(overlay.byPathwayId['424L0239']?.facilityId)
    expect(overlay.byPathwayId['424L0104']?.facilityId).toBe(overlay.byPathwayId['424L0239']?.facilityId)
    expect(buildRoppongiStationMapCompressionContext(graph).byPathwayId['424L0151']?.spaceId).toBeDefined()
  })

  it('selects a reachable A2 exit among duplicate GTFS exit nodes', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '426')!
    const result = buildGtfsStationGuide(buildIndoorGraph(dataset.gtfs), dataset.station, { platformId: '426P2', exitNodeId: ['426N0139', '426N0241'] })
    expect(result).toMatchObject({ ok: true, guide: { arrivalPlatform: '2番ホーム', exit: 'A2' } })
    if (result.ok) expect(['426N0139', '426N0241']).toContain(result.guide.steps.at(-1)?.evidence?.toNodeId)
  })

  it('applies map compression to Kokuritsu Kyogijo without merging different elevator facilities', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '426')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const overlay = buildKokuritsuKyogijoStationMapOverlay(graph)
    expect(overlay.byPathwayId['426L0165']?.facilityId).toBeDefined()
    expect(overlay.byPathwayId['426L0220']?.facilityId).toBe(overlay.byPathwayId['426L0290']?.facilityId)
    expect(overlay.byPathwayId['426L0165']?.facilityId).not.toBe(overlay.byPathwayId['426L0220']?.facilityId)
    const result = buildGtfsStationGuide(graph, dataset.station, { platformId: '426P2', exitNodeId: ['426N0139', '426N0241'] }, 'shortest', buildKokuritsuKyogijoStationMapCompressionContext(graph))
    expect(result).toMatchObject({ ok: true, guide: { arrivalPlatform: '2番ホーム', exit: 'A2' } })
    if (result.ok) {
      const elevators = result.guide.steps.filter(step => step.facility === 'elevator')
      expect(elevators).toHaveLength(1)
      expect(elevators[0].instruction).toBe('エレベーターで移動する')
      expect(elevators[0].evidence?.edgeIds).toEqual(['426L0165', '426L0220', '426L0290'])
      expect(elevators[0].evidence?.mapLocations?.map(location => location.facilityId)).toEqual([
        overlay.byPathwayId['426L0165']?.facilityId,
        overlay.byPathwayId['426L0220']?.facilityId,
        overlay.byPathwayId['426L0290']?.facilityId,
      ])
      expect(summarizeStationGuide(result.guide).elevatorCount).toBe(1)
      expect(result.guide.steps).toHaveLength(6)
    }
  })

  it('builds Daimon platform 3 to B2 with the published station-map overlay', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '421')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const overlay = buildDaimonStationMapOverlay(graph)
    expect(Object.keys(overlay.byPathwayId).length).toBeGreaterThan(0)
    const result = buildGtfsStationGuide(graph, dataset.station, { platformId: '421P3', exitNodeId: '421N0015' }, 'shortest', buildDaimonStationMapCompressionContext(graph))
    expect(result).toMatchObject({ ok: true, guide: { arrivalPlatform: '3番ホーム', exit: 'B2' } })
    if (result.ok) {
      expect(result.guide.steps.at(-1)?.instruction).toBe('B2へ出る')
      expect(result.guide.steps.every(step => step.evidence?.source === 'gtfs-pathways')).toBe(true)
      expect(result.guide.steps.length).toBeLessThanOrEqual(13)
    }
  })

  it('selects the Tocho-mae A4 route with the generic elderly scoring', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '429')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const score = findBestElderlyRoute(graph, '429P4', ['429N0093'], buildTochomaeStationMapCompressionContext(graph))
    expect(score).toMatchObject({ stairs: 1, escalators: 3, elevators: 0 })
    expect(score?.route.edges.map(edge => edge.id)).toContain('429L0254')
  })

  it('selects the Azabu-juban exit-side escalator alternative without station-specific rules', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '423')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const score = findBestElderlyRoute(graph, '423P2', ['423N0063'], buildAzabuJubanStationMapCompressionContext(graph))
    expect(score).toMatchObject({ stairs: 1, escalators: 4, elevators: 0 })
    const ids = score?.route.edges.map(edge => edge.id) ?? []
    expect(ids).toContain('423L0053')
    expect(ids).toContain('423L0058')
  })

  it('selects the Yoyogi exit-side escalator alternative without changing the official home guidance', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '427')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const score = findBestElderlyRoute(graph, '427P2', ['427N0084'], buildYoyogiStationMapCompressionContext(graph))
    expect(score).toMatchObject({ stairs: 3, escalators: 1, elevators: 1 })
    expect(score?.route.edges.map(edge => edge.id)).toContain('427L0012')
  })

  it('selects the Higashi Shinjuku A2 route with no post-gate stairs when the generic scorer can prove it', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '403')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const score = findBestElderlyRoute(graph, '403P2', ['403N0019'], buildHigashiShinjukuStationMapCompressionContext(graph))
    expect(score).toMatchObject({ stairs: 0, escalators: 3, elevators: 0 })
    const ids = score?.route.edges.map(edge => edge.id) ?? []
    expect(ids).toContain('403L0092')
    expect(ids).toContain('403L0083')
  })

  it('does not merge different Shinjuku-nishiguchi gates merely because each candidate crosses one gate', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '402')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const result = buildGtfsStationGuide(
      graph,
      dataset.station,
      { platformId: '402P1', exitNodeId: '402N0002' },
      'shortest',
      buildShinjukuNishiguchiStationMapCompressionContext(graph),
    )
    expect(result).toMatchObject({ ok: true })
    if (result.ok) {
      const gates = result.guide.steps.filter(step => step.facility === 'gate')
      expect(gates).toHaveLength(0)
      expect(findSafeGateRejoin(graph, '402P1', ['402N0002'])).toEqual({ ok: false, reason: 'different-gates' })
      expect(summarizeStationGuide(result.guide)).toMatchObject({ stairsCount: 1, fareGateCount: 0 })
    }
  })

  it('builds Azabu-juban platform 2 to exit 7 with the published station-map overlay', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '423')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const overlay = buildAzabuJubanStationMapOverlay(graph)
    expect(Object.keys(overlay.byPathwayId).length).toBeGreaterThan(0)
    const result = buildGtfsStationGuide(graph, dataset.station, { platformId: '423P2', exitNodeId: '423N0063' }, 'shortest', buildAzabuJubanStationMapCompressionContext(graph))
    expect(result).toMatchObject({ ok: true, guide: { arrivalPlatform: '2番ホーム', exit: '7' } })
    if (result.ok) {
      expect(result.guide.steps.at(-1)?.instruction).toBe('7へ出る')
      expect(result.guide.steps.every(step => step.evidence?.source === 'gtfs-pathways')).toBe(true)
      expect(result.guide.steps).toHaveLength(12)
      expect(summarizeStationGuide(result.guide)).toMatchObject({ stairsCount: 3, escalatorCount: 1, elevatorCount: 0, fareGateCount: 1 })
      const sameLevelStairs = result.guide.steps.find(step => step.evidence?.edgeIds?.includes('423L0061'))
      expect(sameLevelStairs?.instruction).toBe('階段を使う')
      expect(sameLevelStairs?.evidence?.edgeIds).toEqual(['423L0061', '423L0062', '423L0063'])
      expect(sameLevelStairs?.evidence?.fromLevelIndex).toBe(-0.5)
      expect(sameLevelStairs?.evidence?.toLevelIndex).toBe(-0.5)
      expect(sameLevelStairs?.evidence?.mapLocations?.map(location => location.facilityId)).toEqual([overlay.byPathwayId['423L0061']?.facilityId, undefined, overlay.byPathwayId['423L0063']?.facilityId])
      expect(overlay.byPathwayId['423L0061']?.facilityId).toBe(overlay.byPathwayId['423L0063']?.facilityId)
      expect(overlay.byPathwayId['423L0061']?.facilityId).not.toBe(overlay.byPathwayId['423L0050']?.facilityId)
      expect(overlay.byPathwayId['423L0061']?.facilityId).not.toBe(overlay.byPathwayId['423L0065']?.facilityId)
    }
  })

  it.each([
    ['425', '425P2', '425N0123', buildAoyamaItchomeStationMapOverlay, buildAoyamaItchomeStationMapCompressionContext],
    ['427', '427P2', '427N0084', buildYoyogiStationMapOverlay, buildYoyogiStationMapCompressionContext],
    ['403', '403P2', ['403N0019', '403N0020'], buildHigashiShinjukuStationMapOverlay, buildHigashiShinjukuStationMapCompressionContext],
    ['428', '428P7', '428N0193', buildShinjukuStationMapOverlay, buildShinjukuStationMapCompressionContext],
    ['402', '402P1', '402N0002', buildShinjukuNishiguchiStationMapOverlay, buildShinjukuNishiguchiStationMapCompressionContext],
    ['410', '410P1', '410N0016', buildUenoOkachimachiStationMapOverlay, buildUenoOkachimachiStationMapCompressionContext],
    ['429', '429P4', '429N0093', buildTochomaeStationMapOverlay, buildTochomaeStationMapCompressionContext],
  ] as const)('builds the %s guide from the registered station-map data', (stationId, platformId, exitNodeId, buildOverlay, buildContext) => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === stationId)!
    const graph = buildIndoorGraph(dataset.gtfs)
    const overlay = buildOverlay(graph)
    expect(Object.keys(overlay.byPathwayId).length).toBeGreaterThan(0)
    const result = buildGtfsStationGuide(graph, dataset.station, { platformId, exitNodeId: exitNodeId as string | string[] }, 'shortest', buildContext(graph))
    expect(result).toMatchObject({ ok: true })
    if (result.ok) expect(result.guide.steps.every(step => step.evidence?.source === 'gtfs-pathways')).toBe(true)
  })

  it('merges Aoyama 1-exit stair landings as one decision-free action', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '425')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const result = buildGtfsStationGuide(graph, dataset.station, { platformId: '425P2', exitNodeId: '425N0123' }, 'shortest', buildAoyamaItchomeStationMapCompressionContext(graph))
    expect(result).toMatchObject({ ok: true })
    if (result.ok) {
      const stairs = result.guide.steps.filter(step => step.facility === 'stairs')
      expect(stairs).toHaveLength(2)
      expect(stairs[0]?.evidence?.edgeIds).toEqual(expect.arrayContaining(['425L0232', '425L0279', '425L0233']))
      expect(stairs[1]?.evidence?.edgeIds).toEqual(['425L0235'])
      expect(summarizeStationGuide(result.guide).stairsCount).toBe(2)
      expect(stairs[0]?.evidence?.edgeIds).toHaveLength(8)
    }
  })

  it('does not infer one Ueno Okachimachi stair action from different candidate stair sequences', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '410')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const result = buildGtfsStationGuide(graph, dataset.station, { platformId: '410P1', exitNodeId: '410N0016' }, 'shortest', buildUenoOkachimachiStationMapCompressionContext(graph))
    expect(result).toMatchObject({ ok: true })
    if (result.ok) {
      const gateIndex = result.guide.steps.findIndex(step => step.facility === 'gate')
      expect(gateIndex).toBeGreaterThanOrEqual(0)
      expect(result.guide.steps.slice(0, gateIndex).some(step => step.facility === 'stairs')).toBe(false)
      expect(findSafeGateRejoin(graph, '410P1', ['410N0016'])).toMatchObject({ ok: true, candidateCount: 11 })
      const postGateStairs = result.guide.steps.slice(gateIndex + 1).filter(step => step.facility === 'stairs')
      expect(postGateStairs).toHaveLength(2)
      expect(postGateStairs.at(-1)?.evidence?.edgeIds).toEqual(['410L0164', '410L0165', '410L0166'])
    }
  })

  it.each([
    ['424', '424P2', '424N0053', buildRoppongiStationMapCompressionContext, '地下1階'],
    ['426', '426P2', '426N0139', buildKokuritsuKyogijoStationMapCompressionContext, '地下1階'],
    ['421', '421P3', '421N0015', buildDaimonStationMapCompressionContext, '地下3階'],
    ['423', '423P2', '423N0063', buildAzabuJubanStationMapCompressionContext, '地下4階'],
    ['425', '425P2', '425N0123', buildAoyamaItchomeStationMapCompressionContext, '地下1階'],
    ['427', '427P2', '427N0084', buildYoyogiStationMapCompressionContext, '地下1階'],
    ['403', '403P2', '403N0019', buildHigashiShinjukuStationMapCompressionContext, '地下2階'],
    ['428', '428P7', '428N0193', buildShinjukuStationMapCompressionContext, '地下3階'],
    ['410', '410P1', '410N0016', buildUenoOkachimachiStationMapCompressionContext, '地下1階'],
    ['429', '429P4', '429N0093', buildTochomaeStationMapCompressionContext, '地下2階'],
  ] as const)('resolves the visible fare-gate floor generically for station %s', (stationId, platformId, exitNodeId, buildContext, expectedFloor) => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === stationId)!
    const graph = buildIndoorGraph(dataset.gtfs)
    const result = buildGtfsStationGuide(graph, dataset.station, { platformId, exitNodeId }, 'shortest', buildContext(graph))
    expect(result).toMatchObject({ ok: true })
    if (result.ok) {
      const gate = result.guide.steps.find(step => step.facility === 'gate')
      expect(gate?.instruction).toBe(`${expectedFloor}の改札を通る`)
      expect(gate?.evidence?.officialFloor?.label).toBe(expectedFloor)
    }
  })

  it('uses the resolved fare-gate floor after the current candidate topology is unanimous', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '422')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const result = buildGtfsStationGuide(graph, dataset.station, { platformId: '422P2', exitNodeId: '422N0012' }, 'shortest', buildAkabanebashiStationMapCompressionContext(graph))
    expect(result).toMatchObject({ ok: true })
    if (result.ok) {
      const gate = result.guide.steps.find(step => step.facility === 'gate')
      expect(gate?.instruction).toBe('地下1階の改札を通る')
      expect(gate?.evidence?.officialFloor?.label).toBe('地下1階')
    }
  })

  it.each([
    ['424', '424P2', '424N0053', buildRoppongiStationMapCompressionContext, '地下1階'],
    ['426', '426P2', '426N0139', buildKokuritsuKyogijoStationMapCompressionContext, '地下1階'],
  ])('keeps official fare-gate floor on scored paper routes for station %s', (stationId, platformId, exitNodeId, buildContext, expectedFloor) => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === stationId)!
    const graph = buildIndoorGraph(dataset.gtfs)
    const score = findBestElderlyRoute(graph, platformId, [exitNodeId], buildContext(graph))
    expect(score).toBeTruthy()
    const result = score && buildGtfsStationGuideFromRoute(graph, dataset.station, { platformId, exitNodeId }, score.route, buildContext(graph))
    expect(result).toMatchObject({ ok: true })
    if (result?.ok) {
      const gate = result.guide.steps.find(step => step.facility === 'gate')
      expect(gate?.instruction).toBe(`${expectedFloor}の改札を通る`)
      expect(gate?.evidence?.officialFloor?.label).toBe(expectedFloor)
    }
  })
})
