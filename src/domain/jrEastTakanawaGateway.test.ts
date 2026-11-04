import { describe, expect, it } from 'vitest'
import takanawaExtraction from '../data/fixtures/jr2026-takanawa-gateway-gtfs-pathways.json'
import { extractGtfsPathwaysStation, type GtfsPathwaysFeed } from '../data/adapters/gtfsPathwaysAdapter'
import { buildGtfsStationGuideFromRoute, buildIndoorGraph } from './indoorRouting'
import { findBestElderlyRoute } from './elderlyRouteScoring'
import { withStationGuidePresentation, withWalkDistanceInstructions } from './stationGuidePresentation'
import { staticGtfsRailJourneyRepository } from '../data/repositories/staticGtfsRailJourneyRepository'
import { allCoursePresets, outingCoursePresetById } from '../data/coursePresets'
import { allIndoorDatasets } from '../data/catalogs/oedo2026IndoorDatasets'
import { estimatePlatformCarPositionLabel } from './homeToGateGuide'
import { getStationExitGroups } from './stationExitOptions'
import type { StationRef } from './types'

describe('JR East Takanawa Gateway Station', () => {
  const station: StationRef = {
    id: '4229',
    name: '高輪ゲートウェイ',
    operator: '東日本旅客鉄道',
    line: '山手線',
  }

  const rawData = extractGtfsPathwaysStation(
    takanawaExtraction as GtfsPathwaysFeed,
    { id: '4229', name: '高輪ゲートウェイ' }
  )

  it('successfully extracts raw GTFS-Pathways data for Takanawa Gateway', () => {
    expect(rawData.stationId).toBe('4229')
    expect(rawData.stationName).toBe('高輪ゲートウェイ')
    expect(rawData.stops.length).toBeGreaterThan(100)
    expect(rawData.pathways.length).toBeGreaterThan(150)
  })

  it('scores elderly route and builds full guide from Platform 1 to South Gate', () => {
    const graph = buildIndoorGraph(rawData)
    const elderlyRoute = findBestElderlyRoute(graph, '4229P1', ['4229N0640'])

    expect(elderlyRoute).not.toBeNull()
    if (!elderlyRoute) return

    const result = buildGtfsStationGuideFromRoute(
      graph,
      station,
      { platformId: '4229P1', exitNodeId: elderlyRoute.exitId },
      elderlyRoute.route
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const presented = withWalkDistanceInstructions(
      withStationGuidePresentation(result.guide),
      { enabled: true }
    )

    expect(presented.steps.length).toBeGreaterThan(0)
    expect(presented.steps.some(step => step.instruction.includes('改札'))).toBe(true)
    expect(presented.steps.at(-1)?.instruction).toBe('南改札へ出る')
  })

  it('scores elderly route and builds full guide from Platform 1 to North Gate', () => {
    const graph = buildIndoorGraph(rawData)
    const elderlyRoute = findBestElderlyRoute(graph, '4229P1', ['4229N0756'])

    expect(elderlyRoute).not.toBeNull()
    if (!elderlyRoute) return

    const result = buildGtfsStationGuideFromRoute(
      graph,
      station,
      { platformId: '4229P1', exitNodeId: elderlyRoute.exitId },
      elderlyRoute.route
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const presented = withWalkDistanceInstructions(
      withStationGuidePresentation(result.guide),
      { enabled: true }
    )

    expect(presented.steps.length).toBeGreaterThan(0)
    expect(presented.steps.some(step => step.instruction.includes('改札'))).toBe(true)
    expect(presented.steps.at(-1)?.instruction).toBe('北改札へ出る')
  })

  it('finds direct Yamanote Line scheduled journey from Shinagawa to Takanawa Gateway', () => {
    const result = staticGtfsRailJourneyRepository.findDirectJourney({
      originName: '品川',
      destinationName: '高輪ゲートウェイ',
      departureDate: '2026-09-21',
      departureTime: '07:00',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.leg.tripId).toBe('4210622G')
    expect(result.leg.from.departureTime).toBe('07:02')
    expect(result.leg.to.arrivalTime).toBe('07:04')
    expect(result.leg.routeName).toBe('山手線')
  })

  it('registers the Sengakuji course preset and matches dataset', () => {
    const sengakujiCourse = allCoursePresets.find(c => c.id === 'shinagawa-takanawa-gateway-sengakuji')
    expect(sengakujiCourse).toBeDefined()
    expect(sengakujiCourse?.label).toBe('泉岳寺')
    expect(sengakujiCourse?.arrivalStationId).toBe('4229')

    const dataset = allIndoorDatasets.find(d => d.station.id === sengakujiCourse?.arrivalStationId)
    expect(dataset).toBeDefined()
    expect(dataset?.station.name).toBe('高輪ゲートウェイ')
    expect(dataset?.station.operator).toBe('東日本旅客鉄道')

    expect(outingCoursePresetById.get('shinagawa-takanawa-gateway-sengakuji')).toBeDefined()
  })

  it('estimates platform car position on 11-car scale for Takanawa Gateway', () => {
    const graph = buildIndoorGraph(rawData)
    const carPos = estimatePlatformCarPositionLabel(graph, '4229P1', '4229N0623')
    expect(carPos).toBeDefined()
    expect(carPos).toMatch(/\d+号車付近/)
  })

  it('extracts exit groups with South and North ticket gates', () => {
    const graph = buildIndoorGraph(rawData)
    const groups = getStationExitGroups(graph)
    const exitNames = groups.map(g => g.rawName)
    expect(exitNames).toContain('南改札')
    expect(exitNames).toContain('北改札')
  })
})
