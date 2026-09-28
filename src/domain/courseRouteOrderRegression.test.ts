import { describe, expect, it } from 'vitest'
import { outingCoursePresets } from '../data/coursePresets'
import { loadedOedo2026IndoorDatasets } from '../data/catalogs/oedo2026IndoorDatasets'
import { buildRegisteredStationMapCompressionContext } from '../data/stationMaps/registry'
import { stationOfficialGuidanceByStationId } from '../data/stationOfficialGuidance'
import { staticGtfsRailJourneyRepository } from '../data/repositories/staticGtfsRailJourneyRepository'
import { findBestElderlyRoute } from './elderlyRouteScoring'
import { buildGtfsStationGuide, buildGtfsStationGuideFromRoute, buildIndoorGraph } from './indoorRouting'
import { buildHomeToGateGuideModel } from './homeToGateGuide'
import { resolveArrivalPlatform, resolveDeparturePlatform } from './itineraryConnection'
import { buildTrainJourneyPaperPresentation, formatStationName } from './trainJourneyPaperPresentation'
import { withFareGateExitDirections, withWalkDistanceInstructions } from './stationGuidePresentation'

// Test data only: before/after actual paper wording and directed route digests.
// No station-specific expected behavior appears in the engine.
const regression = [
  {"station":"赤羽橋","id":"422","routeHash":"9f74ea506d3364b7382f22b64609ca70c7ddc8f7e07cf5b80e7f93e0e7740130","before":["エレベーターで改札階へ上がる","地下1階の改札を通る","通路を約35m（約60歩）進む","エスカレーターで上がる","通路を約3m（約10歩）進む","階段を使う","通路を約4m（約10歩）進む","エスカレーターで上がる","通路を約20m（約40歩）進む","赤羽橋口へ出る"],"after":["エレベーターで改札階へ上がる","地下1階の改札を通る","通路を約35m（約60歩）進む","エスカレーターで上がる","通路を約3m（約10歩）進む","階段を使う","通路を約4m（約10歩）進む","エスカレーターで上がる","通路を約20m（約40歩）進む","赤羽橋口へ出る"],"car":"できれば4号車付近に乗る","rejoin":true,"coverage":11},
  {"station":"六本木","id":"424","routeHash":"b99caf1d9d83a040a112fa4f9deffb5558105a45b0b196dd596c707f464164cc","before":["エレベーターで改札階へ上がる","地下1階の改札を通ったら左へ進む","通路を約15m（約30歩）進む","エスカレーターで上がる","通路を約6m（約15歩）進む","7へ出る"],"after":["エレベーターで改札階へ上がる","地下1階の改札を通ったら左へ進む","通路を約15m（約30歩）進む","エスカレーターで上がる","通路を約6m（約15歩）進む","7へ出る"],"car":"できれば8号車付近に乗る","rejoin":true,"coverage":4},
  {"station":"国立競技場","id":"426","routeHash":"e0acf4bab0c7ab1a8fb6b4a7506265fdbda4138251298eee6490f49976af60a9","before":["エレベーターで改札階へ上がる","通路を約4m（約10歩）進む","エレベーターで移動する","通路を約25m（約40歩）進む","地下1階の改札を通ったら左へ進む","通路を約55m（約90歩）進む","エレベーターで移動する","通路を約2m（約5歩）進む","A2へ出る"],"after":["通路を約4m（約10歩）進む","エレベーターで移動する","通路を約25m（約40歩）進む","地下1階の改札を通ったら左へ進む","通路を約55m（約90歩）進む","エレベーターで移動する","通路を約2m（約5歩）進む","A2へ出る"],"car":"できれば4号車付近に乗る","rejoin":true,"coverage":36},
  {"station":"大門","id":"421","routeHash":"3f973fabfb92fda0dbc9d1c452110feb6987c072a96cca421cd49fb501a65284","before":["エレベーターで改札階へ上がる","地下3階の改札を通る","通路を約70m（約120歩）進む","エスカレーターで上がる","通路を約15m（約30歩）進む","エスカレーターで上がる","通路を約3m（約5歩）進む","階段を上がる","通路を約2m（約5歩）進む","階段を上がる","B2へ出る"],"after":["エレベーターで改札階へ上がる","地下3階の改札を通る","通路を約70m（約120歩）進む","エスカレーターで上がる","通路を約15m（約30歩）進む","エスカレーターで上がる","通路を約3m（約5歩）進む","階段を上がる","通路を約2m（約5歩）進む","階段を上がる","B2へ出る"],"car":"できれば5号車付近に乗る","rejoin":true,"coverage":15},
  {"station":"麻布十番","id":"423","routeHash":"90b00a560a65efcc7121ef3f9f7b00fc83847f224a03aa76c734756d736df09f","before":["エレベーターで改札階へ上がる","地下4階の改札を通る","通路を約35m（約60歩）進む","エスカレーターで上がる","通路を約15m（約30歩）進む","エスカレーターで上がる","通路を約8m（約15歩）進む","エスカレーターを使う","通路を約5m（約10歩）進む","階段を使う","通路を約3m（約5歩）進む","7へ出る"],"after":["エレベーターで改札階へ上がる","地下4階の改札を通る","通路を約35m（約60歩）進む","エスカレーターで上がる","通路を約15m（約30歩）進む","エスカレーターで上がる","通路を約8m（約15歩）進む","エスカレーターを使う","通路を約5m（約10歩）進む","階段を使う","通路を約3m（約5歩）進む","7へ出る"],"car":"できれば4号車付近に乗る","rejoin":true,"coverage":14},
  {"station":"青山一丁目","id":"425","routeHash":"c5bbd4b135049db20303a2db81e15b3bde16a2c83598788bc3f10d6df866edd3","before":["エスカレーターで改札階へ上がる","地下1階の改札を通る","通路を約45m（約80歩）進む","階段を使う","通路を約1m（約5歩）進む","階段を上がる","通路を約2m（約5歩）進む","1へ出る"],"after":["エスカレーターで改札階へ上がる","地下1階の改札を通る","通路を約45m（約80歩）進む","階段を使う","通路を約1m（約5歩）進む","階段を上がる","通路を約2m（約5歩）進む","1へ出る"],"car":"できれば3号車・6号車付近に乗る","rejoin":true,"coverage":15},
  {"station":"代々木","id":"427","routeHash":"105b0de51a025b0e1ca571d3d43fcf09172889e63697769cb45538d48a1b38cd","before":["エレベーターで改札階へ上がる","地下1階の改札を通る","通路を約75m（約130歩）進む","階段を上がる","通路を約8m（約15歩）進む","エスカレーターを使う","通路を約10m（約20歩）進む","階段を使う","通路を約3m（約5歩）進む","階段を使う","A2へ出る"],"after":["エレベーターで改札階へ上がる","地下1階の改札を通る","通路を約75m（約130歩）進む","階段を上がる","通路を約8m（約15歩）進む","エスカレーターを使う","通路を約10m（約20歩）進む","階段を使う","通路を約3m（約5歩）進む","階段を使う","A2へ出る"],"car":"できれば5号車付近に乗る","rejoin":true,"coverage":13},
  {"station":"東新宿","id":"403","routeHash":"a43fedac4efa76bf4206e1d5a85ba66b4e5ebe396d265c6c4ba259e9a69f284e","before":["エレベーターで改札階へ上がる","地下2階の改札を通る","通路を約65m（約110歩）進む","エレベーターで上がる","通路を約1m（約5歩）進む","A2へ出る"],"after":["エレベーターで改札階へ上がる","地下2階の改札を通る","通路を約65m（約110歩）進む","エレベーターで上がる","通路を約1m（約5歩）進む","A2へ出る"],"car":"できれば5号車付近に乗る","rejoin":true,"coverage":22},
  {"station":"新宿","id":"428","routeHash":"1cb5ac52bc3c7623ae88ce3dd0ff066f24637940d7c4bc7b8c8d7c572cb41916","before":["エレベーターで改札階へ上がる","地下3階の改札を通る","通路を約75m（約130歩）進む","エスカレーターで上がる","通路を約2m（約5歩）進む","エスカレーターを使う","通路を約15m（約30歩）進む","エスカレーターを使う","通路を約10m（約20歩）進む","エスカレーターを使う","通路を約3m（約5歩）進む","A1へ出る"],"after":["エレベーターで改札階へ上がる","地下3階の改札を通る","通路を約75m（約130歩）進む","エスカレーターで上がる","通路を約2m（約5歩）進む","エスカレーターを使う","通路を約15m（約30歩）進む","エスカレーターを使う","通路を約10m（約20歩）進む","エスカレーターを使う","通路を約3m（約5歩）進む","A1へ出る"],"car":"できれば1号車付近に乗る","rejoin":true,"coverage":5},
  {"station":"新宿西口","id":"402","routeHash":"dd1e6c02ffae41436fd443075bc308802fe0c5f22c9ca3b78f95c58bb11905cb","before":["エスカレーターで改札階へ上がる","地下3階の改札を通る","通路を約45m（約80歩）進む","エスカレーターで上がる","通路を約50m（約90歩）進む","階段を上がる","通路を約8m（約15歩）進む","階段を使う","通路を約2m（約5歩）進む","階段を使う","D3へ出る"],"after":["通路を約7m（約15歩）進む","エスカレーターで上がる","通路を約25m（約50歩）進む","地下3階の改札を通る","通路を約45m（約80歩）進む","エスカレーターで上がる","通路を約50m（約90歩）進む","階段を上がる","通路を約8m（約15歩）進む","階段を使う","通路を約2m（約5歩）進む","階段を使う","D3へ出る"],"car":"できれば7号車付近に乗る","rejoin":false,"coverage":0},
  {"station":"上野御徒町","id":"410","routeHash":"105f469bd191e9e4248e5bbaf65127bd0b6f04e6ee159c81f5e39a21b119e42a","before":["エスカレーターで改札階へ上がる","地下1階の改札を通る","通路を約130m（約220歩）進む","階段を使う","通路を約15m（約30歩）進む","階段を使う","通路を約3m（約10歩）進む","A7へ出る"],"after":["エスカレーターで改札階へ上がる","地下1階の改札を通る","通路を約130m（約220歩）進む","階段を使う","通路を約15m（約30歩）進む","階段を使う","通路を約3m（約10歩）進む","A7へ出る"],"car":"できれば6号車付近に乗る","rejoin":true,"coverage":11},
  {"station":"都庁前","id":"429","routeHash":"d2a8d2f6fdaa055fa5ec9ff0fdfd3813e072facf060036469878694326fa7d7d","before":["エレベーターで改札階へ上がる","地下2階の改札を通ったら左へ進む","通路を約90m（約150歩）進む","エスカレーターで上がる","通路を約20m（約40歩）進む","エスカレーターで上がる","通路を約20m（約40歩）進む","階段を使う","通路を約4m（約10歩）進む","A4へ出る"],"after":["エレベーターで改札階へ上がる","地下2階の改札を通ったら左へ進む","通路を約90m（約150歩）進む","エスカレーターで上がる","通路を約20m（約40歩）進む","エスカレーターで上がる","通路を約20m（約40歩）進む","階段を使う","通路を約4m（約10歩）進む","A4へ出る"],"car":"できれば4号車付近に乗る","rejoin":true,"coverage":13},
]

/** Historical paper snapshots predate the evidence-backed gate/turn split. */
function splitLegacyGateTurnExpectation(instructions: string[]) {
  return instructions.flatMap(instruction => {
    const match = instruction.match(/^(.*の改札)を通ったら(左|右|まっすぐ)へ進む$/)
    return match ? [`${match[1]}を通る`, `${match[2]}へ進む`] : [instruction]
  })
}

describe('all supported courses through the domain paper model', () => {
  it.each(regression)('$station: preserves route truth, post-gate detail, ordered provenance and audited paper wording', async expected => {
    const course = outingCoursePresets.find(course => course.arrivalStationId === expected.id)!
    const dataset = loadedOedo2026IndoorDatasets.find(dataset => dataset.station.id === expected.id)!
    const graph = buildIndoorGraph(dataset.gtfs)
    const context = buildRegisteredStationMapCompressionContext(dataset.station.id, graph)
    const platformId = course.arrivalPlatformAssignments[0].platformId
    const exitNodeIds = [course.preferredExitId!].flat()
    const score = findBestElderlyRoute(graph, platformId, exitNodeIds, context)!
    expect(score).toBeTruthy()
    const route = score.route
    const routeKey = route.edges.map(edge => edge.id + ':' + edge.fromNodeId + '>' + edge.toNodeId)
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(routeKey)))
    expect(Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')).toBe(expected.routeHash)
    const built = buildGtfsStationGuideFromRoute(graph, dataset.station, { platformId, exitNodeId: score.exitId }, route, context)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    // Every raw traversal remains in order, including edges absorbed in groups.
    const body = built.guide.steps.filter(step => step.id !== 'gtfs-scored-exit')
    expect(body.flatMap(step => step.evidence!.routeOrder![0].traversals.map(edge => edge.edgeId))).toEqual(route.edges.map(edge => edge.id))
    let last = -1
    for (const step of built.guide.steps) {
      const source = step.evidence!.routeOrder![0]
      expect(source.firstRouteIndex).toBe(last + 1)
      expect(source.lastRouteIndex).toBeGreaterThanOrEqual(source.firstRouteIndex)
      last = source.lastRouteIndex
    }
    const before = JSON.stringify(built.guide)
    const model = buildHomeToGateGuideModel({
      guide: built.guide, graph, platformId, exitNodeIds, selectedRoute: route,
      metadata: stationOfficialGuidanceByStationId[dataset.station.id],
      arrivalPlatformFloor: course.arrivalPlatformFloor,
      humanizeWalkDistance: true, humanizeGateDirection: true,
    })
    expect(JSON.stringify(built.guide)).toBe(before)
    expect(model.guide.steps.map(step => step.instruction)).toEqual(splitLegacyGateTurnExpectation(expected.after))
    expect(model.carPositionHint).toBe(expected.car)
    expect(model.carPositionLabel).toBe(expected.car?.replace(/^できれば/, '').replace(/に乗る$/, ''))
    expect(model.safeRejoin.ok).toBe(expected.rejoin)
    if (model.safeRejoin.ok) expect(model.safeRejoin.candidateCount).toBe(expected.coverage)
    expect(model.guide.steps.filter(step => step.facility === 'gate')).toHaveLength(1)
    const original = withWalkDistanceInstructions(withFareGateExitDirections(built.guide, graph, { enabled: true }), { enabled: true })
    const originalGate = original.steps.findIndex(step => step.facility === 'gate')
    const visibleGate = model.guide.steps.findIndex(step => step.facility === 'gate')
    expect(model.guide.steps.slice(visibleGate)).toEqual(original.steps.slice(originalGate))
    expect(model.sections.flatMap(section => section.steps.map(entry => entry.step))).toEqual(model.guide.steps)

    const journey = staticGtfsRailJourneyRepository.findDirectJourney({
      originName: course.originStationName, destinationName: course.arrivalStationName,
      departureDate: '2026-09-21', departureTime: '07:00',
    })
    expect(journey.ok, `${expected.station}: train leg`).toBe(true)
    if (!journey.ok) return
    const arrival = resolveArrivalPlatform(journey.leg, course.arrivalStationId, course.arrivalPlatformAssignments)
    const departure = resolveDeparturePlatform(journey.leg, course.originStationId, course.departurePlatformAssignments)
    expect(arrival.ok, `${expected.station}: official arrival platform`).toBe(true)
    expect(departure.ok, `${expected.station}: official departure platform`).toBe(true)
    if (!arrival.ok || !departure.ok) return
    const trainPaper = buildTrainJourneyPaperPresentation({
      stationGuide: model.guide, arrivalConnection: arrival.connection, departurePlatform: departure.assignment,
      carPositionLabel: model.carPositionLabel, verifiedArrivalFloorLabel: model.arrivalFloorLabel,
    })
    expect(trainPaper.departure).toMatchObject({
      stationName: formatStationName(journey.leg.from.stationName),
      time: journey.leg.from.departureTime,
      routeName: journey.leg.routeName,
      headsign: journey.leg.headsign,
      platformLabel: `${departure.assignment.platformCode}番ホーム`,
      carPositionLabel: expected.car?.replace(/^できれば/, '').replace(/に乗る$/, ''),
      platformSourceUrl: departure.assignment.source.url,
    })
    expect(trainPaper.arrival).toMatchObject({
      stationName: formatStationName(journey.leg.to.stationName),
      time: journey.leg.to.arrivalTime,
      platformLabel: model.guide.arrivalPlatform,
      floorLabel: model.arrivalFloorLabel,
      platformSourceUrl: arrival.connection.assignment.source.url,
    })
    expect(trainPaper.stationGuide).toBe(model.guide)
    expect(trainPaper.stationGuide.steps).toHaveLength(splitLegacyGateTurnExpectation(expected.after).length)
    expect(trainPaper.stationGuide.steps.map(step => step.id)).toEqual(model.guide.steps.map(step => step.id))
    expect(trainPaper.stationGuide.steps.map(step => step.evidence?.edgeIds)).toEqual(model.guide.steps.map(step => step.evidence?.edgeIds))
    expect(trainPaper.stationGuide.steps.map(step => step.evidence?.routeOrder)).toEqual(model.guide.steps.map(step => step.evidence?.routeOrder))

    // Also exercise the unselected candidate-merge path, not only the scorer.
    const merged = buildGtfsStationGuide(graph, dataset.station, { platformId, exitNodeId: course.preferredExitId! }, 'shortest', context)
    expect(merged.ok).toBe(true)
    if (!merged.ok) return
    const positions = new Map<string, number>()
    for (const step of merged.guide.steps) for (const source of step.evidence?.routeOrder ?? []) {
      const key = source.originNodeId + ':' + source.exitNodeId
      expect(source.firstRouteIndex).toBeGreaterThan(positions.get(key) ?? -1)
      positions.set(key, source.lastRouteIndex)
    }
  })
})
