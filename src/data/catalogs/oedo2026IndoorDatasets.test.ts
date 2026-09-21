import { describe, expect, it } from 'vitest'
import { buildIndoorGraph, buildVerifiedStationGuide, platformOriginNodes } from '../../domain/indoorRouting'
import { validateIndoorDatasets } from '../../domain/indoorDatasetValidation'
import { loadedOedo2026IndoorDatasets, oedo2026StationAvailability } from './oedo2026IndoorDatasets'

describe('Oedo 2026 indoor dataset registry', () => {
  it('registers every loaded dataset in one provider-neutral shape', () => {
    expect(loadedOedo2026IndoorDatasets).toHaveLength(12)
    expect(loadedOedo2026IndoorDatasets.map(dataset => dataset.key)).toEqual(oedo2026StationAvailability.map(station => station.key))
    expect(loadedOedo2026IndoorDatasets.every(dataset => dataset.station.id === dataset.gtfs.stationId)).toBe(true)
    expect(loadedOedo2026IndoorDatasets.every(dataset => dataset.gtfs.source.license === 'CC BY 4.0')).toBe(true)
    expect(oedo2026StationAvailability.every(station => station.importStatus === 'fixture-loaded' && station.dataset !== undefined)).toBe(true)
  })

  it('loads and graphs all 12 stations, then records only routes the common GTFS guide generator can prove', () => {
    const results = validateIndoorDatasets(loadedOedo2026IndoorDatasets)
    expect(results).toHaveLength(12)
    expect(results.every(result => result.loaded && result.graphNodeCount > 0 && result.graphEdgeCount > 0)).toBe(true)
    // A result is counted only when buildGtfsStationGuide found a common route;
    // failures remain recorded rather than receiving a fabricated fallback.
    expect(results.filter(result => result.routeGenerated).length).toBeGreaterThan(0)
    expect(results.filter(result => !result.routeGenerated).every(result => result.routeFailureReason)).toBe(true)
  })

  it('generates a StationGuide for Kokuritsu-kyogijo with the same reviewed-anchor flow', () => {
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.key === 'kokuritsu-kyogijo')
    expect(dataset).toBeDefined()
    if (!dataset) return
    const graph = buildIndoorGraph(dataset.gtfs)
    const platform = [...graph.nodes.values()].find(node => node.kind === 'platform')
    const exit = [...graph.nodes.values()].find(node => node.kind === 'entrance-exit')
    expect(platform).toBeDefined()
    expect(exit).toBeDefined()
    if (!platform || !exit) return
    const origin = platformOriginNodes(graph, platform.id).find(node => {
      const probe = buildVerifiedStationGuide(graph, dataset.station, {
        stationId: dataset.station.id, platformId: platform.id, boardingAreaId: node.id, exitNodeId: exit.id,
        verifiedBy: 'test reviewer', verifiedAt: '2026-09-20', evidenceUrl: 'https://example.invalid/official-map'
      }, { arrivalPlatformLabel: 'レビュー済みホーム', gateLabel: 'レビュー済み改札', exitLabel: exit.name ?? 'レビュー済み出口', safeAlternative: '駅係員にこの紙を見せて確認してください。' })
      return probe.ok
    })
    expect(origin).toBeDefined()
    if (!origin) return
    const result = buildVerifiedStationGuide(graph, dataset.station, {
      stationId: dataset.station.id, platformId: platform.id, boardingAreaId: origin.id, exitNodeId: exit.id,
      verifiedBy: 'test reviewer', verifiedAt: '2026-09-20', evidenceUrl: 'https://example.invalid/official-map'
    }, { arrivalPlatformLabel: 'レビュー済みホーム', gateLabel: 'レビュー済み改札', exitLabel: exit.name ?? 'レビュー済み出口', safeAlternative: '駅係員にこの紙を見せて確認してください。' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.guide.station.id).toBe('426')
      expect(result.guide.steps.some(step => step.evidence?.source === 'gtfs-pathways')).toBe(true)
      expect(result.guide.steps.at(-1)?.evidence?.source).toBe('manual-review')
    }
  })
})
