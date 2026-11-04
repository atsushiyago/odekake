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
      const groups = getStationExitGroups(graph)
      const matching = groups.filter((g) =>
        isExitGroupMatchingPreferred(g, course.preferredExitId),
      )
      expect(matching.length).toBeGreaterThanOrEqual(1)
    }
  })
})
