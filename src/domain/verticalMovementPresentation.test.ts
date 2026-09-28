import { describe, expect, it } from 'vitest'
import { buildIndoorGraph, type IndoorGraph } from './indoorRouting'
import type { GuideStep, PathwayEnrichment, StationGuide } from './types'
import { formatVerticalMovementInstruction, withVerifiedVerticalMovementInstructions } from './verticalMovementPresentation'

const graphFor = (fromLevel: number, toLevel: number): IndoorGraph => buildIndoorGraph({
  source: { name: 'fictional', url: 'fixture', license: 'test', feedVersion: 'test', retrievedAt: 'test' },
  stationId: 'test-generic-vertical-wording', stationName: '架空駅', levels: [fromLevel, toLevel],
  stops: [
    { id: 'from', latitude: 35, longitude: 139, locationType: 3, levelIndex: fromLevel },
    { id: 'to', latitude: 35, longitude: 139.001, locationType: 3, levelIndex: toLevel },
  ],
  pathways: [{ id: 'path', fromStopId: 'from', toStopId: 'to', mode: 5, isBidirectional: true, lengthMeters: 4 }],
})

const enrichment = (overrides: Partial<PathwayEnrichment> = {}): PathwayEnrichment => ({
  pathwayId: 'path', verified: true, walkingLinkId: 'walk', walkingDirection: 1, pathwayMode: 5, routeType: 4,
  fromStopId: 'from', toStopId: 'to', walkingFromNodeId: 'walk-from', walkingToNodeId: 'walk-to',
  fromWalkingFloor: -2, toWalkingFloor: -1, facilityKind: 'elevator', matchMethod: 'intersection', facilityId: null,
  ...overrides,
})

const guideFor = (facility: GuideStep['facility'], item = enrichment()): StationGuide => ({
  id: 'fixture', station: { id: 'test-generic-vertical-wording', name: '架空駅', operator: 'test', line: 'test' },
  arrivalPlatform: 'platform', gate: 'gate', exit: 'exit', officialSourceUrl: 'test', verifiedAt: 'test',
  confidence: 'unknown', safeAlternative: 'test',
  steps: [{ id: 'vertical', facility, instruction: '従来のGTFS案内', evidence: {
    source: 'gtfs-pathways', sourceUrl: 'test', edgeIds: ['path'], fromNodeId: 'from', toNodeId: 'to',
    routeOrder: [{ originNodeId: 'from', exitNodeId: 'to', firstRouteIndex: 0, lastRouteIndex: 0, semanticType: 'vertical',
      traversals: [{ edgeId: 'path', fromNodeId: 'from', toNodeId: 'to' }] }],
    pathwayEnrichments: [item],
  } }],
})

const present = (guide: StationGuide, graph: IndoorGraph, floorLabels: Record<number, { label: string; sourceUrl: string }> = {}) =>
  withVerifiedVerticalMovementInstructions(guide, graph, floorLabels).steps[0].instruction

describe('verified vertical movement print wording', () => {
  it.each([
    ['elevator up', 'elevator', -2, -1, '地下1階', 'エレベーターで地下1階へ上がる'],
    ['elevator down', 'elevator', -1, -2, '地下2階', 'エレベーターで地下2階へ下りる'],
    ['escalator up', 'escalator', -2, -1, '地下1階', 'エスカレーターで地下1階へ上がる'],
    ['escalator down', 'escalator', -1, -2, '地下2階', 'エスカレーターで地下2階へ下りる'],
  ] as const)('%s uses the destination floor and a direct action sentence', (_name, mode, fromLevel, toLevel, label, expected) => {
    const graph = graphFor(fromLevel, toLevel)
    const item = enrichment({ facilityKind: mode, fromWalkingFloor: fromLevel, toWalkingFloor: toLevel })
    expect(present(guideFor(mode, item), graph, { [toLevel]: { label, sourceUrl: 'official' } })).toBe(expected)
  })

  it('keeps an official B2 destination while using dictionary-form wording', () => {
    expect(formatVerticalMovementInstruction({ mode: 'elevator', movementDirection: 'up', verified: true,
      directionAligned: true, toFloorLabel: 'B2F' })).toBe('エレベーターで地下2階へ上がる')
  })

  it('checks a one-way escalator against the actual traversal direction', () => {
    const graph = graphFor(-2, -1)
    const item = enrichment({ facilityKind: 'escalator', walkingDirection: 2 })
    expect(present(guideFor('escalator', item), graph, { [-1]: { label: '地下1階', sourceUrl: 'official' } }))
      .toBe('エスカレーターで地下1階へ上がる')
    const reverseGuide = guideFor('escalator', item)
    reverseGuide.steps[0].evidence!.routeOrder![0].traversals[0] = { edgeId: 'path', fromNodeId: 'to', toNodeId: 'from' }
    expect(present(reverseGuide, graph)).toBe('従来のGTFS案内')
  })

  it('keeps the existing wording for unverified or resolver-unmatched pathways', () => {
    const graph = graphFor(-2, -1)
    const withoutVerifiedEvidence = guideFor('elevator')
    withoutVerifiedEvidence.steps[0].evidence!.pathwayEnrichments = []
    expect(present(withoutVerifiedEvidence, graph)).toBe('従来のGTFS案内')
    expect(present(guideFor('elevator', enrichment({ matchMethod: 'unmatched' })), graph)).toBe('従来のGTFS案内')
  })

  it('does not require a Facility ID when the verified spatial match is usable', () => {
    const graph = graphFor(-2, -1)
    expect(present(guideFor('elevator', enrichment({ facilityId: null, matchMethod: 'intersection' })), graph))
      .toBe('エレベーターで上の階へ進む')
  })

  it('uses a dictionary-form relative direction when no human floor label is available', () => {
    expect(formatVerticalMovementInstruction({ mode: 'escalator', movementDirection: 'up', verified: true,
      directionAligned: true })).toBe('エスカレーターで上の階へ進む')
  })

  it('never turns an intermediate walking floor into a printed fractional floor label', () => {
    const graph = graphFor(-1, 0)
    const item = enrichment({ facilityKind: 'escalator', fromWalkingFloor: -1.5, toWalkingFloor: -0.5 })
    expect(present(guideFor('escalator', item), graph, { [-0.5]: { label: '地下0.5階', sourceUrl: 'bad' } }))
      .toBe('エスカレーターで上の階へ進む')
  })

  it('does not alter non-equipment instructions', () => {
    const graph = graphFor(-2, -1)
    const guide = guideFor(undefined)
    expect(withVerifiedVerticalMovementInstructions(guide, graph)).toBe(guide)
  })

  it('uses a short ground-level destination phrase', () => {
    expect(formatVerticalMovementInstruction({ mode: 'elevator', movementDirection: 'up', verified: true,
      directionAligned: true, toFloorLabel: '地上階' })).toBe('エレベーターで地上へ上がる')
  })
})
