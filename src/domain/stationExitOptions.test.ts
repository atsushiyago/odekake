import { describe, expect, it } from 'vitest'
import { loadedOedo2026IndoorDatasets } from '../data/catalogs/oedo2026IndoorDatasets'
import { outingCoursePresets } from '../data/coursePresets'
import { buildRegisteredStationMapCompressionContext } from '../data/stationMaps/registry'
import { stationOfficialGuidanceByStationId } from '../data/stationOfficialGuidance'
import { findBestElderlyRoute } from './elderlyRouteScoring'
import { buildHomeToGateGuideModel } from './homeToGateGuide'
import { buildGtfsStationGuideFromRoute, buildIndoorGraph } from './indoorRouting'
import { getStationExitGroups, isExitGroupMatchingPreferred } from './stationExitOptions'

describe('stationExitOptions', () => {
  it('extracts non-empty exit groups for every available station dataset', () => {
    for (const dataset of loadedOedo2026IndoorDatasets) {
      const graph = buildIndoorGraph(dataset.gtfs)
      const groups = getStationExitGroups(graph)
      expect(groups.length).toBeGreaterThan(0)
      for (const group of groups) {
        expect(group.label.length).toBeGreaterThan(0)
        expect(group.nodeIds.length).toBeGreaterThan(0)
        expect(typeof group.lat).toBe('number')
        expect(typeof group.lon).toBe('number')
        expect(group.lat).toBeGreaterThan(35)
        expect(group.lon).toBeGreaterThan(139)
      }
    }
  })

  it('identifies preferred exit group for all preset courses', () => {
    for (const course of outingCoursePresets) {
      if (!course.preferredExitId) continue
      const dataset = loadedOedo2026IndoorDatasets.find(
        (ds) => ds.station.id === course.arrivalStationId,
      )
      if (!dataset) continue
      const graph = buildIndoorGraph(dataset.gtfs)
      const groups = getStationExitGroups(graph, course.preferredExitId)
      const matching = groups.filter((g) =>
        isExitGroupMatchingPreferred(g, course.preferredExitId),
      )
      expect(matching.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('filters out underground connection points like Roppongi 4a while keeping true ground exits 5, 6, 7', () => {
    const dataset = loadedOedo2026IndoorDatasets.find((ds) => ds.station.id === '424')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const groups = getStationExitGroups(graph)
    const labels = groups.map((g) => g.label)

    // True surface exits in Roppongi
    expect(labels).toContain('5出口')
    expect(labels).toContain('6出口')
    expect(labels).toContain('7出口')

    // Underground metro connection 4a should be excluded
    expect(labels).not.toContain('4a出口')
  })

  it('splits Shinjuku Exit 4 escalators by shaft axis and resolves B4F and B3F floor labels', () => {
    const course = outingCoursePresets.find((c) => c.arrivalStationId === '428')!
    const dataset = loadedOedo2026IndoorDatasets.find((ds) => ds.station.id === '428')!
    const graph = buildIndoorGraph(dataset.gtfs)
    const compressionContext = buildRegisteredStationMapCompressionContext(dataset.station.id, graph)
    const exitGroups = getStationExitGroups(graph, course.preferredExitId)
    const exit4Group = exitGroups.find((g) => g.label === '4出口')!
    const platformId = '428P7'
    const elderlyScore = findBestElderlyRoute(graph, platformId, exit4Group.nodeIds, compressionContext)!
    const stationGuide = buildGtfsStationGuideFromRoute(
      graph,
      dataset.station,
      { platformId, exitNodeId: elderlyScore.exitId },
      elderlyScore.route,
      compressionContext,
    )
    expect(stationGuide.ok).toBe(true)
    if (!stationGuide.ok) return
    const model = buildHomeToGateGuideModel({
      guide: stationGuide.guide,
      graph,
      platformId,
      exitNodeIds: exit4Group.nodeIds,
      selectedRoute: elderlyScore.route,
      metadata: stationOfficialGuidanceByStationId['428'],
      humanizeWalkDistance: true,
      humanizeGateDirection: true,
      compressionContext,
    })

    const instructions = model.guide.steps.map((s) => s.instruction)
    expect(instructions).toEqual([
      'エスカレーターで地下4階へ上がる',
      '通路を約55m（約100歩）進む',
      'エスカレーターで地下3階へ上がる',
      '地下3階の改札を通る',
      '通路を約65m（約110歩）進む',
      'エスカレーターで地上へ上がる',
      '4へ出る',
    ])
  })
})
