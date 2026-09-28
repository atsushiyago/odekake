import { describe, expect, it } from 'vitest'
import { buildGtfsStationGuideFromRoute, buildIndoorGraph, findIndoorRoute, type RawGtfsPathwaysStationData } from './indoorRouting'
import { buildHomeToGateGuideModel } from './homeToGateGuide'
import { withFareGateExitDirections } from './stationGuidePresentation'
import type { GuideStep, StationGuide, StationRef } from './types'

const station: StationRef = { id: 'test-generic-gate-movement', name: '架空駅', operator: 'test', line: 'test' }
const source = { name: 'fictional GTFS', url: 'https://example.test/gtfs', license: 'test', feedVersion: 'test', retrievedAt: '2026-09-28' }

function fixture(turn: 'left' | 'ambiguous' = 'left') {
  const approach = { latitude: 35.0001, longitude: 139.0001 }
  const turnPoint = turn === 'left'
    ? { latitude: 35.0002, longitude: 139.0001 }
    : { latitude: 35.00015, longitude: 139.0001866 }
  const raw: RawGtfsPathwaysStationData = {
    source, stationId: station.id, stationName: station.name, levels: [-2, -1, 0],
    stops: [
      { id: 'platform', latitude: 35, longitude: 139, locationType: 0, platformCode: '1', levelIndex: -2 },
      { id: 'boarding', latitude: 35, longitude: 139, locationType: 4, parentPlatformId: 'platform', levelIndex: -2 },
      { id: 'landing', latitude: 35.0001, longitude: 139, locationType: 3, levelIndex: -1 },
      { id: 'gate-in', ...approach, locationType: 3, levelIndex: -1 },
      { id: 'gate-out', ...approach, locationType: 3, levelIndex: -1 },
      { id: 'turn-point', ...turnPoint, locationType: 3, levelIndex: -1 },
      { id: 'upper', ...turnPoint, locationType: 3, levelIndex: 0 },
      { id: 'exit', latitude: turnPoint.latitude + 0.0001, longitude: turnPoint.longitude, locationType: 2, name: 'A出口', levelIndex: 0 },
    ],
    pathways: [
      { id: 'home-lift', fromStopId: 'boarding', toStopId: 'landing', mode: 5, isBidirectional: false, lengthMeters: 4 },
      { id: 'approach-walk', fromStopId: 'landing', toStopId: 'gate-in', mode: 1, isBidirectional: false, lengthMeters: 12 },
      { id: 'fare-gate', fromStopId: 'gate-in', toStopId: 'gate-out', mode: 6, isBidirectional: false, lengthMeters: 1 },
      { id: 'post-gate-walk', fromStopId: 'gate-out', toStopId: 'turn-point', mode: 1, isBidirectional: false, lengthMeters: 10 },
      { id: 'after-turn-stairs', fromStopId: 'turn-point', toStopId: 'upper', mode: 2, isBidirectional: false, lengthMeters: 5 },
      { id: 'exit-walk', fromStopId: 'upper', toStopId: 'exit', mode: 1, isBidirectional: false, lengthMeters: 5 },
    ],
  }
  const graph = buildIndoorGraph(raw)
  const route = findIndoorRoute(graph, 'boarding', 'exit')!
  const guideResult = buildGtfsStationGuideFromRoute(graph, station, { platformId: 'platform', exitNodeId: 'exit' }, route, {
    byPathwayId: {}, officialFloorsByLevelIndex: { [-1]: { label: '地下1階', sourceUrl: 'https://example.test/floors' } },
  })
  if (!guideResult.ok) throw new Error(guideResult.reason)
  return { graph, route, guide: guideResult.guide }
}

const emptyGuide = (steps: GuideStep[]): StationGuide => ({
  id: 'fictional', station, arrivalPlatform: '1番ホーム', gate: '改札', exit: 'A出口', steps,
  officialSourceUrl: source.url, verifiedAt: source.retrievedAt, confidence: 'needs-review', safeAlternative: '駅係員に聞く',
})

describe('generic fare-gate and post-gate movement presentation', () => {
  it('A: leaves a gate-only guide as one action', () => {
    const gate = { id: 'gate', instruction: '地下1階の改札を通る', facility: 'gate' as const,
      evidence: { source: 'gtfs-pathways' as const, sourceUrl: source.url, fromNodeId: 'gate-in', toNodeId: 'gate-out', edgeIds: ['fare-gate'] } }
    const result = withFareGateExitDirections(emptyGuide([gate]), fixture().graph, { enabled: true })
    expect(result.steps.map(step => step.instruction)).toEqual(['地下1階の改札を通る'])
  })

  it('B: separates only a route-proven left turn and keeps gate and movement provenance distinct', () => {
    const { graph, guide } = fixture()
    const result = withFareGateExitDirections(guide, graph, { enabled: true })
    const gateIndex = result.steps.findIndex(step => step.facility === 'gate')
    const gate = result.steps[gateIndex]
    const movement = result.steps[gateIndex + 1]
    const followingWalk = result.steps[gateIndex + 2]
    expect(gate.instruction).toBe('地下1階の改札を通る')
    expect(movement.instruction).toBe('左へ進む')
    expect(gate.evidence?.edgeIds).toEqual(['fare-gate'])
    expect(gate.evidence?.direction).toBeUndefined()
    expect(movement.evidence?.edgeIds).toBeUndefined()
    expect(movement.evidence?.routeOrder).toBeUndefined()
    expect(movement.evidence?.direction?.routeContext).toEqual([{
      originNodeId: 'boarding', exitNodeId: 'exit', approachRouteIndex: 1, gateRouteIndex: 2, movementRouteIndex: 3,
    }])
    expect(followingWalk.evidence?.edgeIds).toEqual(['post-gate-walk'])
    expect(followingWalk.evidence?.routeOrder?.[0].traversals.map(item => item.edgeId)).toEqual(['post-gate-walk'])
  })

  it('C: does not guess when route geometry is ambiguous', () => {
    const { graph, guide } = fixture('ambiguous')
    const result = withFareGateExitDirections(guide, graph, { enabled: true })
    const gateIndex = result.steps.findIndex(step => step.facility === 'gate')
    expect(result.steps[gateIndex].instruction).toBe('地下1階の改札を通る')
    expect(result.steps[gateIndex + 1].id).not.toBe(`${result.steps[gateIndex].id}-post-gate-movement`)
    expect(result.steps.some(step => ['左へ進む', '右へ進む', 'まっすぐ進む'].includes(step.instruction))).toBe(false)
  })

  it('D: safe rejoin keeps the same gate boundary, then the movement and GTFS continuation in route order', () => {
    const { graph, route, guide } = fixture()
    const model = buildHomeToGateGuideModel({
      guide, graph, platformId: 'platform', exitNodeIds: ['exit'], selectedRoute: route,
      metadata: {
        targetGate: '出口方面', preGatePresentation: 'safe-rejoin',
        officialGuidance: [{ scope: 'platform-to-gate', equipment: 'elevator', direction: null, source: { url: 'https://example.test/official' } }],
      },
      humanizeGateDirection: true,
    })
    expect(model.safeRejoin.ok).toBe(true)
    expect(model.hiddenHomeDetails).toBe(true)
    expect(model.guide.steps.map(step => step.instruction)).toEqual([
      'エレベーターで改札階へ上がる', '地下1階の改札を通る', '左へ進む', '通路を進む', '階段を上がる', '通路を進む', 'A出口へ出る',
    ])
    const gate = model.guide.steps.find(step => step.facility === 'gate')!
    const movement = model.guide.steps[model.guide.steps.indexOf(gate) + 1]
    expect(gate.evidence?.routeOrder?.[0].traversals).toEqual([{ edgeId: 'fare-gate', fromNodeId: 'gate-in', toNodeId: 'gate-out' }])
    expect(movement.evidence?.direction?.routeContext?.[0].gateRouteIndex).toBe(gate.evidence?.routeOrder?.[0].firstRouteIndex)
    expect(model.guide.steps.slice(model.guide.steps.indexOf(gate) + 2).flatMap(step => step.evidence?.edgeIds ?? []))
      .toEqual(['post-gate-walk', 'after-turn-stairs', 'exit-walk', 'exit-walk'])
  })
})
