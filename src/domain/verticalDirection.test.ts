import { describe, expect, it } from 'vitest'
import type { IndoorMovementType, IndoorRoute } from './indoorRouting'
import { buildIndoorGraph, compactIndoorRouteSteps, findIndoorRoute, formatIndoorStep, resolveVerticalDirection, resolveVerticalDirectionConsensus, toIndoorRouteSteps } from './indoorRouting'
import { presentOfficialHomeGuidance } from './officialGuidancePresentation'

function route(levels: Array<number | undefined>, types: IndoorMovementType[], lengths?: number[]): IndoorRoute {
  const nodes = levels.map((levelIndex, index) => ({
    id: `node-${index}`,
    latitude: 35,
    longitude: 139 + index * 0.00001,
    levelIndex,
    locationType: 3,
    kind: 'internal' as const,
  }))
  const edges = types.map((movementType, index) => ({
    id: `edge-${index}`,
    fromNodeId: nodes[index].id,
    toNodeId: nodes[index + 1].id,
    lengthMeters: lengths?.[index] ?? (movementType === 'walk' ? 2 : 4),
    movementType,
    sourceType: 'gtfs-pathways' as const,
  }))
  return { nodes, edges, distanceMeters: edges.reduce((sum, edge) => sum + edge.lengthMeters, 0) }
}

function stairGroupingContext(ids: string[]) {
  return {
    byPathwayId: Object.fromEntries(ids.map(id => [id, { facilityId: 'fictional-stair-facility', spaceId: 'fictional-space' }])),
    allowDecisionFreeStairBridges: true,
    nonBranchingNodeIds: new Set(['node-1', 'node-2']),
  }
}

function elevatorGroupingContext(options: { mapped?: boolean; facilities?: string[]; facilityGroups?: string[]; nonBranching?: string[]; edgeCount?: number } = {}) {
  const ids = Array.from({ length: options.edgeCount ?? 3 }, (_, index) => `edge-${index}`)
  const byPathwayId = options.mapped === false ? {} : Object.fromEntries(ids.map((id, index) => [id, {
    facilityId: options.facilities?.[index] ?? 'fictional-elevator',
    facilityGroupId: options.facilityGroups?.[index],
    spaceId: 'fictional-space',
  }]))
  return { byPathwayId, nonBranchingNodeIds: new Set(options.nonBranching ?? ['node-0', 'node-1', 'node-2', 'node-3']) }
}

describe('generic vertical direction resolver', () => {
  it('A: resolves a single stair traversal upward', () => {
    const step = toIndoorRouteSteps(route([-3, -2], ['stairs']))[0]
    expect(resolveVerticalDirection(-3, -2)).toBe('up')
    expect(step.verticalDirection).toBe('up')
    expect(formatIndoorStep(step)).toBe('階段を上がる')
  })

  it('B: resolves a single escalator traversal downward', () => {
    const step = toIndoorRouteSteps(route([-1, -2], ['escalator']))[0]
    expect(step.verticalDirection).toBe('down')
    expect(formatIndoorStep(step)).toBe('エスカレーターで下りる')
  })

  it('C: leaves an equal-level vertical edge unknown', () => {
    const step = toIndoorRouteSteps(route([-0.5, -0.5], ['stairs']))[0]
    expect(step.verticalDirectionEvidence).toBe('incomplete')
    expect(formatIndoorStep(step)).toBe('階段を使う')
  })

  it('D: leaves missing endpoint levels unknown', () => {
    expect(resolveVerticalDirection(undefined, -2)).toBe('unknown')
    expect(resolveVerticalDirection(-3, undefined)).toBe('unknown')
    const step = toIndoorRouteSteps(route([-3, undefined], ['elevator']))[0]
    expect(step.verticalDirection).toBeUndefined()
    expect(formatIndoorStep(step)).toBe('エレベーターで移動する')
  })

  it('E: groups fully evidenced same-direction stair flights across a short landing', () => {
    const compact = compactIndoorRouteSteps(
      route([-3, -2, -2, -1], ['stairs', 'walk', 'stairs']),
      stairGroupingContext(['edge-0', 'edge-1', 'edge-2']),
    )
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirection).toBe('up')
    expect(formatIndoorStep(compact[0])).toBe('階段を上がる')
    expect(compact[0].evidence.edgeIds).toEqual(['edge-0', 'edge-1', 'edge-2'])
  })

  it('F: does not infer a net direction for a group with opposing flights', () => {
    const compact = compactIndoorRouteSteps(
      route([-3, -2, -2, -3], ['stairs', 'walk', 'stairs']),
      stairGroupingContext(['edge-0', 'edge-1', 'edge-2']),
    )
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirection).toBeUndefined()
    expect(formatIndoorStep(compact[0])).toBe('階段を使う')
  })

  it('G: an unknown vertical edge invalidates an otherwise upward group', () => {
    const compact = compactIndoorRouteSteps(
      route([-3, -2, -2, -2], ['stairs', 'walk', 'stairs']),
      stairGroupingContext(['edge-0', 'edge-1', 'edge-2']),
    )
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirectionEvidence).toBe('incomplete')
    expect(compact[0].verticalDirection).toBeUndefined()
    expect(formatIndoorStep(compact[0])).toBe('階段を使う')
  })

  it('does not discard an unverified same-level elevator edge inside a group', () => {
    const compact = compactIndoorRouteSteps(
      route([-3, -2, -2, -2], ['elevator', 'walk', 'elevator']),
      { byPathwayId: Object.fromEntries(['edge-0', 'edge-1', 'edge-2'].map(id => [id, { facilityId: 'elevator-group' }])),
        nonBranchingNodeIds: new Set(['node-0', 'node-1', 'node-2', 'node-3']) },
    )
    expect(compact[0].verticalDirectionEvidence).toBe('incomplete')
    expect(compact[0].verticalDirection).toBeUndefined()
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで移動する')
  })

  it('N1: groups a verified short same-equipment EV connector as neutral', () => {
    const compact = compactIndoorRouteSteps(route([-3, -2, -2, -1], ['elevator', 'elevator', 'elevator'], [4, 1.5, 4]), elevatorGroupingContext())
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirection).toBe('up')
    expect(compact[0].verticalDirectionEvidence).toBe('complete')
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで上がる')
    expect(compact[0].evidence.edgeIds).toEqual(['edge-0', 'edge-1', 'edge-2'])
  })

  it('N2: same-facility map evidence, not a 2m cutoff, validates a 2.4m connector', () => {
    const compact = compactIndoorRouteSteps(route([-3, -2, -2, -1], ['elevator', 'elevator', 'elevator'], [4, 2.4, 4]), elevatorGroupingContext())
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirection).toBe('up')
    expect(compact[0].evidence.mapLocations).toHaveLength(3)
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで上がる')
  })

  it('G: neutral classification is invariant across the former 2m boundary', () => {
    const below = compactIndoorRouteSteps(route([-3, -2, -2, -1], ['elevator', 'elevator', 'elevator'], [4, 1.99, 4]), elevatorGroupingContext())
    const above = compactIndoorRouteSteps(route([-3, -2, -2, -1], ['elevator', 'elevator', 'elevator'], [4, 2.01, 4]), elevatorGroupingContext())
    expect(below).toHaveLength(1)
    expect(above).toHaveLength(1)
    expect(below[0].verticalDirection).toBe('up')
    expect(above[0].verticalDirection).toBe('up')
    expect(above[0].evidence.edgeIds).toEqual(below[0].evidence.edgeIds)
  })

  it('N3: a branching connector is not neutral', () => {
    const compact = compactIndoorRouteSteps(route([-3, -2, -2, -1], ['elevator', 'elevator', 'elevator'], [4, 1.5, 4]), elevatorGroupingContext({ nonBranching: ['node-0', 'node-1', 'node-3'] }))
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirection).toBeUndefined()
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで移動する')
  })

  it('N4: a level-changing connector contributes vertical evidence rather than neutrality', () => {
    const compact = compactIndoorRouteSteps(route([-3, -2, -1, 0], ['elevator', 'elevator', 'elevator'], [4, 1.5, 4]), elevatorGroupingContext())
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirectionEvidence).toBe('complete')
    expect(compact[0].verticalDirection).toBe('up')
  })

  it('N5: without StationMap mapping a same-level edge is not presumed neutral', () => {
    const compact = compactIndoorRouteSteps(route([-3, -2, -2, -1], ['elevator', 'elevator', 'elevator'], [4, 1.5, 4]), elevatorGroupingContext({ mapped: false }))
    expect(compact).toHaveLength(3)
    expect(compact[1].verticalDirectionEvidence).toBe('incomplete')
    expect(formatIndoorStep(compact[1])).toBe('エレベーターで移動する')
  })

  it('N6: a connector between distinct Facilities does not combine the EV actions', () => {
    const compact = compactIndoorRouteSteps(route([-3, -2, -2, -1], ['elevator', 'elevator', 'elevator'], [4, 1.5, 4]), elevatorGroupingContext({ facilities: ['lift-a', 'connector-b', 'lift-c'] }))
    expect(compact).toHaveLength(3)
    expect(compact.some(step => step.evidence.edgeIds.length === 3)).toBe(false)
    expect(compact[1].verticalDirectionEvidence).toBe('incomplete')
  })

  it('N7: neutral connectors preserve a consistent downward EV group', () => {
    const compact = compactIndoorRouteSteps(route([-1, -2, -2, -3], ['elevator', 'elevator', 'elevator'], [4, 1.5, 4]), elevatorGroupingContext())
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirection).toBe('down')
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで下りる')
  })

  it('N8: neutral connectors do not hide opposing vertical directions', () => {
    const compact = compactIndoorRouteSteps(route([-3, -2, -2, -3], ['elevator', 'elevator', 'elevator'], [4, 1.5, 4]), elevatorGroupingContext())
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirection).toBeUndefined()
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで移動する')
  })

  it('A: accepts a same-Facility entrance connector before an upward EV flight', () => {
    const compact = compactIndoorRouteSteps(route([-3, -3, -2], ['elevator', 'elevator']), elevatorGroupingContext({ edgeCount: 2 }))
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirection).toBe('up')
    expect(compact[0].verticalDirectionEvidence).toBe('complete')
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで上がる')
  })

  it('B: accepts a same-Facility exit connector after an upward EV flight', () => {
    const compact = compactIndoorRouteSteps(route([-3, -2, -2], ['elevator', 'elevator']), elevatorGroupingContext({ edgeCount: 2 }))
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirection).toBe('up')
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで上がる')
  })

  it('C: applies the direction of the vertical flight across entrance and exit connectors', () => {
    const compact = compactIndoorRouteSteps(route([-1, -1, -2, -2], ['elevator', 'elevator', 'elevator']), elevatorGroupingContext())
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirection).toBe('down')
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで下りる')
  })

  it('D: does not neutralize a boundary connector when the adjacent EV has another Facility ID', () => {
    const compact = compactIndoorRouteSteps(route([-3, -3, -2], ['elevator', 'elevator']), elevatorGroupingContext({ edgeCount: 2, facilities: ['connector-facility', 'lift-facility'] }))
    expect(compact[0].verticalDirectionEvidence).toBe('incomplete')
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで移動する')
  })

  it('E: Facility-group similarity alone is not sufficient equipment identity', () => {
    const compact = compactIndoorRouteSteps(route([-3, -3, -2], ['elevator', 'elevator']), elevatorGroupingContext({
      edgeCount: 2,
      facilities: ['connector-facility', 'lift-facility'],
      facilityGroups: ['nearby-group', 'nearby-group'],
    }))
    expect(compact[0].verticalDirectionEvidence).toBe('incomplete')
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで移動する')
  })

  it('F: a branching endpoint prevents boundary-connector neutralization', () => {
    const compact = compactIndoorRouteSteps(route([-3, -3, -2], ['elevator', 'elevator']), elevatorGroupingContext({ edgeCount: 2, nonBranching: ['node-0', 'node-2'] }))
    expect(compact[0].verticalDirectionEvidence).toBe('incomplete')
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで移動する')
  })

  it('G: missing StationMap evidence prevents boundary-connector neutralization', () => {
    const compact = compactIndoorRouteSteps(route([-3, -3, -2], ['elevator', 'elevator']), elevatorGroupingContext({ edgeCount: 2, mapped: false }))
    expect(compact[0].verticalDirectionEvidence).toBe('incomplete')
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで移動する')
  })

  it('H: does not absorb an elevator connector that leads only to ordinary passage', () => {
    const compact = compactIndoorRouteSteps(route([-3, -3, -3], ['elevator', 'walk']), elevatorGroupingContext({ edgeCount: 2 }))
    expect(compact.map(step => formatIndoorStep(step))).toEqual(['エレベーターで移動する', '通路を進む'])
    expect(compact[0].verticalDirectionEvidence).toBe('incomplete')
  })

  it('I: neutral boundary connectors cannot supply missing direction evidence', () => {
    const compact = compactIndoorRouteSteps(route([-3, -3, undefined], ['elevator', 'elevator']), elevatorGroupingContext({ edgeCount: 2 }))
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirection).toBeUndefined()
    expect(compact[0].verticalDirectionEvidence).toBe('incomplete')
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで移動する')
  })

  it('J: both boundary connectors can surround one direction-known vertical EV flight', () => {
    const compact = compactIndoorRouteSteps(route([-3, -3, -2, -2], ['elevator', 'elevator', 'elevator']), elevatorGroupingContext())
    expect(compact).toHaveLength(1)
    expect(compact[0].verticalDirection).toBe('up')
    expect(compact[0].verticalDirectionEvidence).toBe('complete')
    expect(compact[0].evidence.edgeIds).toEqual(['edge-0', 'edge-1', 'edge-2'])
    expect(formatIndoorStep(compact[0])).toBe('エレベーターで上がる')
  })

  it('H: reverses direction when traversing a bidirectional pathway backwards', () => {
    const graph = buildIndoorGraph({
      stationId: 'fictional-reverse-route',
      stationName: '架空駅',
      source: { name: 'test', url: 'https://example.test', license: 'test', feedVersion: 'test', retrievedAt: '2026-09-25' },
      levels: [-2, -1],
      stops: [
        { id: 'lower', latitude: 35, longitude: 139, locationType: 3, levelIndex: -2 },
        { id: 'upper', latitude: 35, longitude: 139.0001, locationType: 3, levelIndex: -1 },
      ],
      pathways: [{ id: 'bidirectional-stairs', fromStopId: 'lower', toStopId: 'upper', mode: 2, isBidirectional: true, lengthMeters: 4 }],
    })
    const reverseRoute = findIndoorRoute(graph, 'upper', 'lower')!
    const step = toIndoorRouteSteps(reverseRoute)[0]
    expect(step.evidence.edgeIds).toEqual(['bidirectional-stairs'])
    expect(step.evidence.fromLevelIndex).toBe(-1)
    expect(step.evidence.toLevelIndex).toBe(-2)
    expect(step.verticalDirection).toBe('down')
    expect(formatIndoorStep(step)).toBe('階段を下りる')
  })

  it('I: rejects candidate direction consensus when candidates disagree', () => {
    expect(resolveVerticalDirectionConsensus(['up', 'down'])).toBe('unknown')
    expect(resolveVerticalDirectionConsensus(['up', 'unknown'])).toBe('unknown')
    expect(resolveVerticalDirectionConsensus(['up', 'up'])).toBe('up')
  })

  it('J: keeps official direction scoped to platform-to-gate guidance', () => {
    const presentation = presentOfficialHomeGuidance([
      { scope: 'platform-to-gate', equipment: 'elevator', direction: 'up', source: { url: 'https://example.test/home' } },
      { scope: 'gate-to-exit', equipment: 'escalator', direction: 'down', source: { url: 'https://example.test/exit' } },
    ])
    expect(presentation.homeInstruction).toBe('エレベーターで改札階へ上がる')
    expect(presentation.homeInstruction).not.toContain('エスカレーター')
    expect(presentation.homeInstruction).not.toContain('下りる')
  })
})
