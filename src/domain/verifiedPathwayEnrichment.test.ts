import { describe, expect, it } from 'vitest'
import audit from '../../reports/gtfs-walking-pathway-crosswalk-audit.json'
import { loadedOedo2026IndoorDatasets } from '../data/catalogs/oedo2026IndoorDatasets'
import { buildVerifiedPathwayEnrichments } from '../data/verifiedPathwayCrosswalk'
import { buildGtfsStationGuide, buildIndoorGraph, findIndoorRoute } from './indoorRouting'
import { buildGtfsStationGuideFromRoute } from './indoorRouting'
import { withVerifiedPathwayEnrichment } from './verifiedPathwayEnrichment'
import { buildRegisteredStationMapCompressionContext } from '../data/stationMaps/registry'
import { findBestElderlyRoute } from './elderlyRouteScoring'
import { buildHomeToGateGuideModel } from './homeToGateGuide'
import { stationOfficialGuidanceByStationId } from '../data/stationOfficialGuidance'
import { outingCoursePresets } from '../data/coursePresets'

const dataset = (stationId: string) => loadedOedo2026IndoorDatasets.find(item => item.station.id === stationId)!

describe('audited selective Pathway enrichment', () => {
  it('adds walking link evidence to verified GTFS steps without changing the route or wording', () => {
    const data = dataset('423'), graph = buildIndoorGraph(data.gtfs)
    const matches = buildVerifiedPathwayEnrichments(graph)
    expect(matches.size).toBeGreaterThan(0)
    const built = buildGtfsStationGuide(graph, data.station, { platformId: '423P2', exitNodeId: '423N0063' })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const enriched = withVerifiedPathwayEnrichment(built.guide, graph, matches)
    expect(enriched.steps.map(step => step.instruction)).toEqual(built.guide.steps.map(step => step.instruction))
    expect(enriched.steps.map(step => step.evidence?.edgeIds)).toEqual(built.guide.steps.map(step => step.evidence?.edgeIds))
    expect(enriched.steps.some(step => step.evidence?.pathwayEnrichments?.length)).toBe(true)
    for (const step of enriched.steps) for (const item of step.evidence?.pathwayEnrichments ?? []) {
      expect(item.verified).toBe(true)
      expect(item.walkingLinkId).toBeTruthy()
      expect(step.evidence?.edgeIds).toContain(item.pathwayId)
    }
  })

  it.each(['floor_unresolved', 'mode_mismatch', 'node_ambiguous'] as const)('%s remains GTFS-only', reason => {
    const station = audit.stations.find(item => item.completeness === 'full' && item.pathways.some(path => path.reason === reason))!
    const data = dataset(station.station === '麻布十番' ? '423' :
      loadedOedo2026IndoorDatasets.find(item => item.station.name === station.station)!.station.id)
    const matches = buildVerifiedPathwayEnrichments(buildIndoorGraph(data.gtfs))
    const path = station.pathways.find(item => item.reason === reason)!
    expect(matches.has(path.pathwayId)).toBe(false)
  })

  it('does not certify the Akabanebashi subset or a stale feed', () => {
    const graph = buildIndoorGraph(dataset('422').gtfs)
    expect(buildVerifiedPathwayEnrichments(graph).size).toBe(0)
    const stale = { ...buildIndoorGraph(dataset('423').gtfs), source: { ...dataset('423').gtfs.source, feedVersion: 'stale' } }
    expect(buildVerifiedPathwayEnrichments(stale).size).toBe(0)
  })

  it('loads exactly the 2,354 full-data audited Pathways and keeps a one-way escalator one-way', () => {
    const count = loadedOedo2026IndoorDatasets.reduce((sum, data) => sum + buildVerifiedPathwayEnrichments(buildIndoorGraph(data.gtfs)).size, 0)
    expect(count).toBe(2354)
    const source = dataset('423').gtfs.source
    const graph = buildIndoorGraph({ source, stationId: 'fictional', stationName: 'fictional', levels: [-2, -1],
      stops: [
        { id: 'lower', latitude: 35, longitude: 139, locationType: 3, levelIndex: -2 },
        { id: 'upper', latitude: 35, longitude: 139.0001, locationType: 3, levelIndex: -1 },
      ],
      pathways: [{ id: 'one-way-es', fromStopId: 'lower', toStopId: 'upper', mode: 4, isBidirectional: false, lengthMeters: 10 }],
    })
    expect(findIndoorRoute(graph, 'lower', 'upper')).not.toBeNull()
    expect(findIndoorRoute(graph, 'upper', 'lower')).toBeNull()
  })

  it('keeps verified walking evidence even if Facility resolution throws', () => {
    const graph = buildIndoorGraph(dataset('423').gtfs)
    const matches = buildVerifiedPathwayEnrichments(graph, () => { throw new Error('map unavailable') })
    expect(matches.size).toBeGreaterThan(0)
    expect([...matches.values()].some(item => item.facilityKind === 'elevator' && item.facilityId === null)).toBe(true)
  })

  it('leaves a step without verified Pathways byte-for-byte unchanged', () => {
    const data = dataset('422'), graph = buildIndoorGraph(data.gtfs)
    const built = buildGtfsStationGuide(graph, data.station, { platformId: '422P2', exitNodeId: '422N0012' })
    expect(built.ok).toBe(true)
    if (built.ok) expect(withVerifiedPathwayEnrichment(built.guide, graph, buildVerifiedPathwayEnrichments(graph))).toBe(built.guide)
  })

  it.each([
    ['赤羽橋', '422', '422P2', '422N0012'],
    ['麻布十番', '423', '423P2', '423N0063'],
    ['六本木', '424', '424P2', '424N0053'],
    ['新宿', '428', '428P7', '428N0193'],
  ])('%s representative paper route only rewords eligible vertical steps and reports verified steps', (name, stationId, platformId, exitId) => {
    const data = dataset(stationId), graph = buildIndoorGraph(data.gtfs)
    const context = buildRegisteredStationMapCompressionContext(stationId, graph)
    const score = context && findBestElderlyRoute(graph, platformId, [exitId], context)
    expect(score).toBeTruthy()
    const built = buildGtfsStationGuideFromRoute(graph, data.station, { platformId, exitNodeId: exitId }, score!.route, context)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const original = buildHomeToGateGuideModel({ guide: built.guide, graph, platformId, exitNodeIds: [exitId], selectedRoute: score!.route,
      metadata: stationOfficialGuidanceByStationId[stationId], compressionContext: context, humanizeWalkDistance: true, humanizeGateDirection: true })
    const enhanced = buildHomeToGateGuideModel({ guide: withVerifiedPathwayEnrichment(built.guide, graph, buildVerifiedPathwayEnrichments(graph)),
      graph, platformId, exitNodeIds: [exitId], selectedRoute: score!.route,
      metadata: stationOfficialGuidanceByStationId[stationId], compressionContext: context, humanizeWalkDistance: true, humanizeGateDirection: true })
    expect(enhanced.guide.steps.map(step => step.evidence?.edgeIds)).toEqual(original.guide.steps.map(step => step.evidence?.edgeIds))
    for (let i = 0; i < original.guide.steps.length; i++) {
      if (enhanced.guide.steps[i].instruction !== original.guide.steps[i].instruction) {
        expect(['elevator', 'escalator']).toContain(original.guide.steps[i].facility)
      }
    }
    const verified = enhanced.guide.steps.flatMap(step => (step.evidence?.pathwayEnrichments ?? []).map(item => ({
      step: step.instruction, pathwayId: item.pathwayId, walkingLinkId: item.walkingLinkId,
      kind: item.facilityKind ?? 'walk/other', direction: item.walkingDirection,
      spaceId: item.spaceId ?? null, facilityId: item.facilityId ?? null, method: item.matchMethod ?? null,
    })))
    if (stationId === '422') expect(verified).toHaveLength(0)
    else expect(verified.length).toBeGreaterThan(0)
    expect(name).toBeTruthy()
  })

  it('preserves the final paper wording of all 12 courses', () => {
    const expectedDiffs: Record<string, string[]> = {
      '国立新美術館': ['エスカレーターで上がる → エスカレーターで上の階へ進む'],
      '旧芝離宮恩賜庭園': ['エスカレーターで上がる → エスカレーターで地下2階へ上がる', 'エスカレーターで上がる → エスカレーターで地下1階へ上がる'],
      'パティオ十番': ['エスカレーターで上がる → エスカレーターで地下1階へ上がる', 'エスカレーターで上がる → エスカレーターで上の階へ進む'],
    }
    for (const course of outingCoursePresets) {
      const data = dataset(course.arrivalStationId), graph = buildIndoorGraph(data.gtfs)
      const platformId = course.arrivalPlatformAssignments[0].platformId
      const exits = Array.isArray(course.preferredExitId) ? course.preferredExitId : [course.preferredExitId!]
      const context = buildRegisteredStationMapCompressionContext(data.station.id, graph)
      const score = context ? findBestElderlyRoute(graph, platformId, exits, context) : null
      const built = score
        ? buildGtfsStationGuideFromRoute(graph, data.station, { platformId, exitNodeId: score.exitId }, score.route, context)
        : buildGtfsStationGuide(graph, data.station, { platformId, exitNodeId: exits }, 'shortest', context)
      expect(built.ok, course.label).toBe(true)
      if (!built.ok) continue
      const options = { graph, platformId, exitNodeIds: exits, selectedRoute: score?.route,
        metadata: stationOfficialGuidanceByStationId[data.station.id], compressionContext: context, humanizeWalkDistance: true, humanizeGateDirection: true }
      const before = buildHomeToGateGuideModel({ ...options, guide: built.guide })
      const after = buildHomeToGateGuideModel({ ...options, guide: withVerifiedPathwayEnrichment(built.guide, graph, buildVerifiedPathwayEnrichments(graph)) })
      expect(after.guide.steps.map(step => step.id), course.label).toEqual(before.guide.steps.map(step => step.id))
      expect(after.guide.steps.map(step => step.facility), course.label).toEqual(before.guide.steps.map(step => step.facility))
      expect(after.guide.steps.map(step => step.evidence?.edgeIds), course.label).toEqual(before.guide.steps.map(step => step.evidence?.edgeIds))
      expect(after.guide.steps.map(step => step.evidence?.routeOrder), course.label).toEqual(before.guide.steps.map(step => step.evidence?.routeOrder))
      expect(after.guide.steps.every(step => !/(?:です|ます|でした|ました|ください)/.test(step.instruction)), course.label).toBe(true)
      const diffs: string[] = []
      for (let i = 0; i < before.guide.steps.length; i++) {
        const beforeStep = before.guide.steps[i], afterStep = after.guide.steps[i]
        if (beforeStep.instruction !== afterStep.instruction) {
          expect(['elevator', 'escalator'], course.label).toContain(beforeStep.facility)
          diffs.push(`${beforeStep.instruction} → ${afterStep.instruction}`)
        }
        if (beforeStep.facility !== 'elevator' && beforeStep.facility !== 'escalator') expect(afterStep.instruction, course.label).toBe(beforeStep.instruction)
      }
      expect(diffs, course.label).toEqual(expectedDiffs[course.label] ?? [])
    }
  })
})
