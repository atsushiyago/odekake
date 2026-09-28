import { describe, expect, it } from 'vitest'
import type { ArrivalPlatformConnection, OfficialDeparturePlatformAssignment, ScheduledRailLeg } from './itineraryConnection'
import type { StationGuide } from './types'
import { buildTrainJourneyPaperPresentation, formatStationName } from './trainJourneyPaperPresentation'

const leg: ScheduledRailLeg = {
  tripId: 'fictional-trip', routeId: 'fictional-line', routeName: '架空線', serviceDay: 'weekday',
  directionId: 'outbound', headsign: '架空行', source: { url: 'https://example.test/rail', feedVersion: 'test', retrievedAt: 'test' },
  from: { stationId: 'test-origin', stationName: '架空出発', departureTime: '07:03', stopSequence: 1 },
  to: { stationId: 'test-arrival', stationName: '架空到着', arrivalTime: '07:05', stopSequence: 2 },
}
const arrivalConnection: ArrivalPlatformConnection = {
  leg, platformId: 'arrival-platform',
  assignment: { stationId: 'test-arrival', platformId: 'arrival-platform', routeId: leg.routeId,
    directionId: leg.directionId, headsign: leg.headsign, source: { url: 'https://example.test/arrival-platform', checkedAt: 'test', description: 'fixture' } },
}
const departurePlatform: OfficialDeparturePlatformAssignment = {
  stationId: 'test-origin', platformId: 'departure-platform', platformCode: '4', routeId: leg.routeId,
  directionId: leg.directionId, headsign: leg.headsign,
  source: { url: 'https://example.test/departure-platform', checkedAt: 'test', description: 'fixture' },
}

function guide(overrides: Partial<StationGuide> = {}): StationGuide {
  return {
    id: 'fictional-guide', station: { id: 'test-arrival', name: '架空到着駅', operator: 'test', line: '架空線' },
    arrivalPlatform: '2番ホーム', gate: '改札', exit: 'A出口', officialSourceUrl: 'https://example.test/gtfs',
    verifiedAt: 'test', confidence: 'needs-review', safeAlternative: '駅係員に確認する',
    steps: [{ id: 'es', facility: 'escalator', instruction: 'エスカレーターで上がる', evidence: {
      source: 'gtfs-pathways', sourceUrl: 'https://example.test/gtfs', edgeIds: ['es-path'], fromNodeId: 'p', toNodeId: 'g',
      routeOrder: [{ originNodeId: 'boarding', exitNodeId: 'exit', firstRouteIndex: 0, lastRouteIndex: 0,
        semanticType: 'vertical', traversals: [{ edgeId: 'es-path', fromNodeId: 'p', toNodeId: 'g' }] }],
    } }],
    ...overrides,
  }
}

const present = (stationGuide: StationGuide, options: {
  departurePlatform?: OfficialDeparturePlatformAssignment
  carPositionLabel?: string
  verifiedArrivalFloorLabel?: string
} = {}) => buildTrainJourneyPaperPresentation({
  stationGuide, arrivalConnection, ...options,
})

describe('generic chronological train header presentation', () => {
  it('A: separates departure platform/car advice from arrival platform and verified floor', () => {
    const result = present(guide(), { departurePlatform, carPositionLabel: '5号車付近', verifiedArrivalFloorLabel: '地下2階' })
    expect(result.departure).toMatchObject({
      stationName: '架空出発駅', time: '07:03', routeName: '架空線', headsign: '架空行',
      platformLabel: '4番ホーム', carPositionLabel: '5号車付近',
    })
    expect(result.arrival).toMatchObject({
      stationName: '架空到着駅', time: '07:05', platformLabel: '2番ホーム', floorLabel: '地下2階',
      platformDisplayLabel: '2番ホーム（地下2階）',
    })
    expect(result.departure.carPositionLabel).toBe('5号車付近')
    expect(result.arrival.platformDisplayLabel).not.toMatch(/で降りる$/)
  })

  it('B: omits only the car-position line when no official car advice exists', () => {
    const result = present(guide(), { departurePlatform })
    expect(result.departure.platformLabel).toBe('4番ホーム')
    expect(result.departure.carPositionLabel).toBeUndefined()
  })

  it('C: does not infer a physical arrival floor when no verified label is supplied', () => {
    const result = present(guide())
    expect(result.arrival.platformDisplayLabel).toBe('2番ホーム')
    expect(result.arrival.floorLabel).toBeUndefined()
  })

  it('D: presents alighting in the header and starts the unchanged guide with its first post-alighting action', () => {
    const sourceGuide = guide()
    const result = present(sourceGuide, { verifiedArrivalFloorLabel: '地下2階' })
    expect(result.arrival.platformDisplayLabel).toBe('2番ホーム（地下2階）')
    expect(result.stationGuide.steps[0].facility).toBe('escalator')
    expect(result.stationGuide.steps).toBe(sourceGuide.steps)
  })

  it('E: keeps gate, post-gate movement, SAFE REJOIN evidence, and Pathway order untouched', () => {
    const sourceGuide = guide({ steps: [
      { id: 'home', instruction: 'エレベーターで改札階へ上がる', evidence: { source: 'manual-review', sourceUrl: 'https://example.test/official',
        homeGuidance: { scope: 'platform-to-gate', sourceUrls: ['https://example.test/official'], rejoinSources: [
          { originNodeId: 'boarding', exitNodeId: 'exit', firstRouteIndex: 0, lastRouteIndex: 1, semanticType: 'vertical',
            traversals: [{ edgeId: 'lift', fromNodeId: 'boarding', toNodeId: 'landing' }, { edgeId: 'gate', fromNodeId: 'gate-in', toNodeId: 'gate-out' }] },
        ] } } },
      { id: 'gate', facility: 'gate', instruction: '改札を通る', evidence: { source: 'gtfs-pathways', sourceUrl: 'https://example.test/gtfs', edgeIds: ['gate'], fromNodeId: 'gate-in', toNodeId: 'gate-out' } },
      { id: 'turn', instruction: '左へ進む', evidence: { source: 'gtfs-pathways', sourceUrl: 'https://example.test/gtfs', direction: {
        previousNodeId: 'gate-in', currentNodeId: 'gate-out', nextNodeId: 'corridor', angleDegrees: 90, result: 'left', reason: 'fixture',
        routeContext: [{ originNodeId: 'boarding', exitNodeId: 'exit', approachRouteIndex: 0, gateRouteIndex: 1, movementRouteIndex: 2 }],
      } } },
      { id: 'exit', facility: 'exit', instruction: 'A出口へ出る', evidence: { source: 'gtfs-pathways', sourceUrl: 'https://example.test/gtfs', edgeIds: ['exit-link'] } },
    ] })
    const before = structuredClone(sourceGuide.steps)
    const result = present(sourceGuide, { verifiedArrivalFloorLabel: '地下2階' })
    expect(result.stationGuide.steps).toEqual(before)
    expect(result.stationGuide.steps.map(step => step.id)).toEqual(['home', 'gate', 'turn', 'exit'])
    expect(result.stationGuide.steps[1].evidence?.edgeIds).toEqual(['gate'])
    expect(result.stationGuide.steps[2].evidence?.direction?.result).toBe('left')
    expect(result.stationGuide.steps[0].evidence?.homeGuidance?.rejoinSources[0].traversals.map(item => item.edgeId)).toEqual(['lift', 'gate'])
  })

  it('F: applies unchanged to an unrelated fictional station ID', () => {
    const unknownStationGuide = guide({ station: { id: 'new-station-no-special-case', name: '新しい架空駅', operator: 'test', line: '架空線' } })
    const result = present(unknownStationGuide, { departurePlatform, verifiedArrivalFloorLabel: '地下2階' })
    expect(result.departure.stationName).toBe('架空出発駅')
    expect(result.arrival.stationName).toBe('架空到着駅')
    expect(result.arrival.platformDisplayLabel).toBe('2番ホーム（地下2階）')
  })

  it('formats station suffixes generically and never duplicates an existing suffix', () => {
    expect(formatStationName('大門')).toBe('大門駅')
    expect(formatStationName('大門駅')).toBe('大門駅')
    expect(formatStationName('  青山一丁目  ')).toBe('青山一丁目駅')
  })
})
