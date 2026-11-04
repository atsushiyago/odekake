import { describe, expect, it } from 'vitest'
import { loadedOedo2026IndoorDatasets } from '../data/catalogs/oedo2026IndoorDatasets'
import { outingCoursePresets } from '../data/coursePresets'
import { buildIndoorGraph } from './indoorRouting'
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
})
