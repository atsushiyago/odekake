import { describe, expect, it } from 'vitest'
import { buildGtfsStationGuide, buildIndoorGraph } from './indoorRouting'
import { withStationGuidePresentation, buildStationGuideSections, countVisibleFareGateSteps, formatFareGateSummary, summarizeStationGuide, summarizeVisiblePostGateSteps, withFareGateExitDirections, withWalkDistanceInstructions } from './stationGuidePresentation'
import { akabanebashiGtfsPathways } from '../data/fixtures/akabanebashi-gtfs-pathways'
import { buildAkabanebashiStationMapCompressionContext } from '../data/stationMaps/akabanebashi'
import { buildDaimonStationMapCompressionContext } from '../data/stationMaps/daimon'
import { loadedOedo2026IndoorDatasets } from '../data/catalogs/oedo2026IndoorDatasets'

describe('station guide presentation', () => {
  it('adds distance and approximate steps to every measured walkway when enabled', () => {
    const guide = { id: 'distance', station: { id: '421', name: '大門', operator: '東京都交通局', line: '大江戸線' }, arrivalPlatform: '3番ホーム', gate: '', exit: 'B2', steps: [
      { id: 'short', instruction: '通路を進む', evidence: { source: 'gtfs-pathways' as const, sourceUrl: 'https://example.test', distanceMeters: 7.9 } },
      { id: 'long', instruction: '通路を進む', evidence: { source: 'gtfs-pathways' as const, sourceUrl: 'https://example.test', distanceMeters: 14.7 } },
      { id: 'very-long', instruction: '通路を進む', evidence: { source: 'gtfs-pathways' as const, sourceUrl: 'https://example.test', distanceMeters: 68 } },
      { id: 'stairs', instruction: '階段を上がる', facility: 'stairs' as const, evidence: { source: 'gtfs-pathways' as const, sourceUrl: 'https://example.test', distanceMeters: 12 } },
    ], officialSourceUrl: 'https://example.test', verifiedAt: '2026-09-21', confidence: 'needs-review' as const, safeAlternative: '案内表示を確認する' }
    expect(withWalkDistanceInstructions(guide, { enabled: false }).steps.map(step => step.instruction)).toEqual(['通路を進む', '通路を進む', '通路を進む', '階段を上がる'])
    expect(withWalkDistanceInstructions(guide, { enabled: true }).steps.map(step => step.instruction)).toEqual(['通路を約8m（約15歩）進む', '通路を約15m（約30歩）進む', '通路を約70m（約120歩）進む', '階段を上がる'])
    expect(withWalkDistanceInstructions(guide, { enabled: true }).steps[1].evidence?.distanceMeters).toBe(14.7)
  })
  it('humanizes only the experimental Daimon B2 guide and keeps gate direction evidence', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '421')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const result = buildGtfsStationGuide(graph, dataset.station, { platformId: '421P3', exitNodeId: '421N0015' }, 'shortest', buildDaimonStationMapCompressionContext(graph))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const presented = withWalkDistanceInstructions(withFareGateExitDirections(result.guide, graph, { enabled: true }), { enabled: true })
    const directed = withStationGuidePresentation(presented)
    expect(directed.steps.some(step => step.instruction === '通路を約70m（約120歩）進む')).toBe(true)
    const gate = directed.steps.find(step => step.facility === 'gate')
    expect(gate?.instruction).toBe('地下3階の改札を通ったら左へ進む')
    const withoutExperiment = withWalkDistanceInstructions(result.guide, { enabled: false })
    expect(withoutExperiment.steps.some(step => step.instruction.includes('約68m'))).toBe(false)
  })
  it('uses presence wording for one fare gate and count wording for multiple', () => {
    expect(formatFareGateSummary(0)).toBeUndefined()
    expect(formatFareGateSummary(1)).toBe('改札あり')
    expect(formatFareGateSummary(2)).toBe('改札2回')
  })
  it('summarizes only visible post-gate equipment actions', () => {
    const steps = [
      { id: 'gate', instruction: '改札を通る', facility: 'gate' as const },
      { id: 'stairs-1', instruction: '階段を上がる', facility: 'stairs' as const },
      { id: 'stairs-2', instruction: '階段を使う', facility: 'stairs' as const },
      { id: 'elevator', instruction: 'エレベーターで上がる', facility: 'elevator' as const },
    ]
    expect(summarizeVisiblePostGateSteps(steps.slice(1))).toBe('階段2回・エレベーター1回')
    expect(summarizeVisiblePostGateSteps([{ id: 'walk', instruction: '通路を進む' }])).toBeUndefined()
  })

  it('counts a fare gate in the paper even when candidate safety is unresolved', () => {
    expect(countVisibleFareGateSteps([
      { id: 'gate', instruction: '改札を通る', facility: 'gate' as const },
      { id: 'exit', instruction: '出口へ出る', facility: 'exit' as const },
    ])).toBe(1)
  })
  it('summarizes compressed semantic steps and current fare-gate topology', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    const result = buildGtfsStationGuide(graph, { id: '422', name: '赤羽橋', operator: '東京都交通局', line: '大江戸線' }, { platformId: '422P2', exitNodeId: '422N0012' }, 'shortest', buildAkabanebashiStationMapCompressionContext(graph))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const presented = withStationGuidePresentation(result.guide)
    expect(presented.summary).toMatchObject({ stairsCount: 2, escalatorCount: 1, fareGateCount: 1 })
    expect(presented.sections?.map(section => section.title)).toEqual(['ホームから改札へ', '改札から出口へ', '地上へ'])
    expect(presented.sections?.flatMap(section => section.steps)).toHaveLength(result.guide.steps.length)
  })

  it('uses a confirmed fare gate as the semantic boundary', () => {
    const guide = { id: 'g', station: { id: '1', name: '駅', operator: '事業者', line: '線' }, arrivalPlatform: '1番ホーム', gate: '', exit: 'A出口', steps: [
      { id: 'walk', instruction: '通路を進む', evidence: { source: 'gtfs-pathways' as const, sourceUrl: 'https://example.test' } },
      { id: 'gate', instruction: '改札を通る', facility: 'gate' as const, evidence: { source: 'gtfs-pathways' as const, sourceUrl: 'https://example.test', candidateCoverage: { matchingOrigins: 2, totalOrigins: 2 } } },
      { id: 'exit', instruction: 'A出口へ出る', facility: 'exit' as const, evidence: { source: 'gtfs-pathways' as const, sourceUrl: 'https://example.test' } },
    ], officialSourceUrl: 'https://example.test', verifiedAt: '2026-09-20', confidence: 'needs-review' as const, safeAlternative: '係員に聞く' }
    expect(buildStationGuideSections(guide).map(section => section.title)).toEqual(['ホームから改札へ', '地上へ'])
    expect(summarizeStationGuide(guide).fareGateCount).toBe(1)
  })

  it('counts one merged elevator facility once in the summary', () => {
    const guide = { id: 'elevator', station: { id: '1', name: '駅', operator: '事業者', line: '線' }, arrivalPlatform: '2番ホーム', gate: '', exit: '7出口', steps: [
      { id: 'lift', instruction: 'エレベーターで上がる', facility: 'elevator' as const, evidence: { source: 'gtfs-pathways' as const, sourceUrl: 'https://example.test', edgeIds: ['424L0239', '424L0151', '424L0104'], mapLocations: [{ pathwayId: '424L0239', facilityId: 'F012' }, { pathwayId: '424L0151', facilityId: 'F012' }, { pathwayId: '424L0104', facilityId: 'F012' }] } },
      { id: 'exit', instruction: '7へ出る', facility: 'exit' as const, evidence: { source: 'gtfs-pathways' as const, sourceUrl: 'https://example.test' } },
    ], officialSourceUrl: 'https://example.test', verifiedAt: '2026-09-20', confidence: 'needs-review' as const, safeAlternative: '係員に聞く' }
    expect(summarizeStationGuide(guide).elevatorCount).toBe(1)
  })
})
