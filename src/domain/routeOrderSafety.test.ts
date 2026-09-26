import { describe, expect, it } from 'vitest'
import { buildGtfsStationGuide, buildGtfsStationGuideFromRoute, buildIndoorGraph, commonRouteSuffix, findPlatformGateLevelConsensus, mergeOrderedCandidatePrefix, type IndoorGraph, type IndoorRoute, type PathwayMode, type RawGtfsPathwaysStationData } from './indoorRouting'
import { buildHomeToGateGuideModel } from './homeToGateGuide'
import { proveSafeGateRejoin } from './safeRejoin'
import type { StationOfficialGuidance } from '../data/stationOfficialGuidance'
import type { GuideStep, StationRef } from './types'

const station: StationRef = { id: 'fictional-order-and-rejoin', name: '架空の順序検証駅', operator: 'test', line: 'test' }
const source = { name: 'fictional', url: 'https://example.test/topology', feedVersion: 'test', retrievedAt: '2026-09-26', license: 'test' }
const metadata: StationOfficialGuidance = {
  targetGate: '出口方面', preGatePresentation: 'safe-rejoin',
  officialGuidance: [{ scope: 'platform-to-gate', carPositions: ['5号車付近'], equipment: 'elevator', source: { url: 'https://example.test/official' } }],
}
type Link = [string, string, string, PathwayMode]

/** Explicit traversals, not an ID whitelist. Paths may diverge after a gate. */
function fixture(paths: Link[][]) {
  const links = [...new Map(paths.flat().map(link => [link[0], link])).values()]
  const ids = [...new Set(links.flatMap(link => link.slice(1, 3) as string[]))]
  const origins = paths.map(path => path[0][1])
  const exits = paths.map(path => path.at(-1)![2])
  const raw: RawGtfsPathwaysStationData = {
    stationId: station.id, stationName: station.name, source, levels: [-2, -1, 0],
    stops: [
      { id: 'platform', latitude: 35, longitude: 139, locationType: 0, platformCode: '1', levelIndex: -2 },
      ...ids.map((id, index) => ({ id, latitude: 35, longitude: 139 + index * 0.0001,
        locationType: origins.includes(id) ? 4 : exits.includes(id) ? 2 : 3,
        parentPlatformId: origins.includes(id) ? 'platform' : undefined,
        name: exits.includes(id) ? id : undefined,
        levelIndex: origins.includes(id) || id === 'low' ? -2 : id === 'high' || exits.includes(id) ? 0 : -1,
      })),
    ],
    pathways: links.map(([id, fromStopId, toStopId, mode]) => ({ id, fromStopId, toStopId, mode, lengthMeters: 4, isBidirectional: false })),
  }
  const graph = buildIndoorGraph(raw)
  const routes: IndoorRoute[] = paths.map(path => {
    const edges = path.map(([id]) => graph.edges.find(edge => edge.id === id)!)
    return { edges, nodes: [graph.nodes.get(edges[0].fromNodeId)!, ...edges.map(edge => graph.nodes.get(edge.toNodeId)!)], distanceMeters: edges.length * 4 }
  })
  return { graph, routes }
}

function sharedActions(first: PathwayMode = 2, second: PathwayMode = 4): Link[][] {
  return ['a', 'b'].map(suffix => [
    [`approach-${suffix}`, `origin-${suffix}`, 'low', 1],
    ['first-equipment', 'low', 'gate-in', first],
    ['shared-gate', 'gate-in', 'gate-out', 6],
    ['second-equipment', 'gate-out', 'high', second],
    [`after-${suffix}`, 'high', `corridor-${suffix}`, 1],
    [`merge-${suffix}`, `corridor-${suffix}`, 'merge', 1],
    ['tail', 'merge', 'exit', 1],
  ])
}

function mergedPrefix(graph: IndoorGraph, routes: IndoorRoute[]) {
  return mergeOrderedCandidatePrefix(graph, routes.map(route => ({ route })), commonRouteSuffix(routes).length, { byPathwayId: {}, allowSemanticConsensusVerticalRestoration: true })
}

function expectOrdered(steps: GuideStep[]) {
  const lastByRoute = new Map<string, number>()
  for (const step of steps) for (const position of step.evidence?.routeOrder ?? []) {
    const key = `${position.originNodeId}:${position.exitNodeId}`
    expect(position.firstRouteIndex).toBeGreaterThan(lastByRoute.get(key) ?? -1)
    expect(position.lastRouteIndex).toBeGreaterThanOrEqual(position.firstRouteIndex)
    lastByRoute.set(key, position.lastRouteIndex)
  }
}

function paper(graph: IndoorGraph, route: IndoorRoute, exitIds = [route.nodes.at(-1)!.id]) {
  const built = buildGtfsStationGuideFromRoute(graph, station, { platformId: 'platform', exitNodeId: route.nodes.at(-1)!.id }, route)
  if (!built.ok) throw new Error(built.reason)
  return { original: built.guide, model: buildHomeToGateGuideModel({ guide: built.guide, graph, platformId: 'platform', exitNodeIds: exitIds, selectedRoute: route, metadata }) }
}

describe('unknown-station action order and safe rejoin', () => {
  it.each([
    ['A', 2, 4, ['stairs', 'gate', 'escalator']],
    ['B', 4, 2, ['escalator', 'gate', 'stairs']],
  ] as const)('%s: preserves equipment → gate → equipment through candidate restoration and final guides', (_, first, second, expected) => {
    const { graph, routes } = fixture(sharedActions(first, second))
    const prefix = mergedPrefix(graph, routes)
    expect(prefix.map(step => step.facility)).toEqual(expected)
    expectOrdered(prefix)
    expect(prefix.every(step => step.evidence?.routeOrder?.length === 2)).toBe(true)
    const built = buildGtfsStationGuide(graph, station, { platformId: 'platform', exitNodeId: 'exit' }, 'shortest', { byPathwayId: {}, allowSemanticConsensusVerticalRestoration: true })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.guide.steps.filter(step => step.facility && step.facility !== 'exit').map(step => step.facility)).toEqual(expected)
    expectOrdered(built.guide.steps)
  })

  it('C: resumes at the proven shared gate, keeping all post-gate actions in order', () => {
    const { graph, routes } = fixture(sharedActions())
    expect(proveSafeGateRejoin(routes)).toMatchObject({ ok: true, candidateCount: 2, fromNodeId: 'gate-in', toNodeId: 'gate-out' })
    const { original, model } = paper(graph, routes[0])
    expect(model.hiddenHomeDetails).toBe(true)
    expect(model.guide.steps[0].instruction).toBe('エレベーターで改札階へ上がる')
    expect(model.guide.steps.slice(1)).toEqual(original.steps.slice(original.steps.findIndex(step => step.facility === 'gate')))
    expect(model.guide.steps[0].evidence?.homeGuidance?.rejoinSources).toHaveLength(2)
  })

  it('D: different gates on the same level do not justify hiding details or mixing official equipment', () => {
    const paths: Link[][] = ['a', 'b'].map(s => [
      [`stairs-${s}`, `origin-${s}`, `in-${s}`, 2],
      [`gate-${s}`, `in-${s}`, `out-${s}`, 6],
      [`es-${s}`, `out-${s}`, 'merge', 4], ['tail', 'merge', 'exit', 1],
    ])
    const { graph, routes } = fixture(paths)
    expect(findPlatformGateLevelConsensus(graph, 'platform', ['exit'])).toMatchObject({ direction: 'up', candidateCount: 2 })
    expect(proveSafeGateRejoin(routes)).toEqual({ ok: false, reason: 'different-gates' })
    const { original, model } = paper(graph, routes[0])
    expect(model.hiddenHomeDetails).toBe(false)
    expect(model.guide.steps).toEqual(original.steps)
    expect(model.carPositionHint).toBe('できれば5号車付近に乗る')
    expect(mergedPrefix(graph, routes)).toEqual([])
  })

  it('E: equal equipment sets with a different gate order are not the same action sequence', () => {
    // Even the very same stairs, gate and ES edges occur in a different order.
    const stairs: Link = ['stairs', 'low', 'stairs-out', 2]
    const gate: Link = ['gate', 'gate-in', 'gate-out', 6]
    const es: Link = ['es', 'es-in', 'es-out', 4]
    const tail: Link = ['tail', 'merge', 'exit', 1]
    const a: Link[] = [['wa', 'oa', 'low', 1], stairs, ['to-gate', 'stairs-out', 'gate-in', 1], gate, ['gate-es', 'gate-out', 'es-in', 1], es, ['es-merge', 'es-out', 'merge', 1], tail]
    const b: Link[] = [['wb', 'ob', 'low', 1], stairs, ['to-es', 'stairs-out', 'es-in', 1], es, ['es-gate', 'es-out', 'gate-in', 1], gate, ['gate-merge', 'gate-out', 'merge', 1], tail]
    const { graph, routes } = fixture([a, b])
    expect(mergedPrefix(graph, routes).map(step => step.facility)).toEqual(['gate'])
    expectOrdered(mergedPrefix(graph, routes))
  })

  it('F: multiple exits may share one gate while each selected suffix retains its own order', () => {
    const base: Link[] = [['stairs', 'origin', 'gate-in', 2], ['gate', 'gate-in', 'gate-out', 6]]
    const { graph, routes } = fixture([
      [...base, ['es', 'gate-out', 'high', 4], ['exit-a-path', 'high', 'exit-a', 1]],
      [...base, ['down', 'gate-out', 'low', 2], ['exit-b-path', 'low', 'exit-b', 1]],
    ])
    expect(proveSafeGateRejoin(routes).ok).toBe(true)
    for (const route of routes) {
      const { original, model } = paper(graph, route, ['exit-a', 'exit-b'])
      expect(model.hiddenHomeDetails).toBe(true)
      expect(model.guide.steps.slice(1)).toEqual(original.steps.slice(1))
      expectOrdered(model.guide.steps)
    }
  })

  it('G: a candidate without a gate prevents rejoin and detail removal', () => {
    const { graph, routes } = fixture([
      [['stairs', 'oa', 'gate-in', 2], ['gate', 'gate-in', 'merge', 6], ['tail', 'merge', 'exit', 1]],
      [['bypass', 'ob', 'merge', 2], ['tail', 'merge', 'exit', 1]],
    ])
    expect(proveSafeGateRejoin(routes)).toEqual({ ok: false, reason: 'missing-gate' })
    const { original, model } = paper(graph, routes[0])
    expect(model.guide.steps).toEqual(original.steps)
    expect(model.hiddenHomeDetails).toBe(false)
  })

  it('H: unknown gate identity falls back, even with a gate label and same level', () => {
    const { routes } = fixture([[['walk', 'origin', 'gate', 1], ['ambiguous', 'gate', 'gate', 6], ['tail', 'gate', 'exit', 1]]])
    expect(proveSafeGateRejoin(routes)).toEqual({ ok: false, reason: 'unknown-gate-identity' })
  })

  it('accepts parallel gate records only when they share the same directed crossing', () => {
    const paths = sharedActions()
    paths[1] = paths[1].map(link => link[0] === 'shared-gate' ? ['parallel-gate-record', link[1], link[2], 6] : link)
    const { graph, routes } = fixture(paths)
    expect(proveSafeGateRejoin(routes).ok).toBe(true)
    expect(mergedPrefix(graph, routes)[1].evidence?.edgeIds).toEqual(['shared-gate', 'parallel-gate-record'])
  })

  it('does not omit unreachable boarding areas from rejoin coverage', () => {
    const { graph, routes } = fixture(sharedActions())
    graph.nodes.set('unreachable', { id: 'unreachable', latitude: 35, longitude: 139, locationType: 4, kind: 'boarding-area', parentPlatformId: 'platform', levelIndex: -2 })
    expect(paper(graph, routes[0]).model.safeRejoin).toEqual({ ok: false, reason: 'incomplete-candidates' })
  })

  it('does not mistake reverse traversal of a bidirectional edge for a common suffix', () => {
    const { routes } = fixture(sharedActions())
    const reverse = structuredClone(routes[0])
    const last = reverse.edges.at(-1)!
    ;[last.fromNodeId, last.toNodeId] = [last.toNodeId, last.fromNodeId]
    expect(commonRouteSuffix([routes[0], reverse])).toEqual([])
  })

  it('checks the scored route too, not only shortest candidates', () => {
    const alternative: Link[] = [
      ['detour-1', 'origin-a', 'd1', 1], ['detour-2', 'd1', 'd2', 1],
      ['detour-3', 'd2', 'd3', 1], ['detour-4', 'd3', 'd4', 1],
      ['other-stairs', 'd4', 'other-in', 2], ['other-gate', 'other-in', 'other-out', 6],
      ['detour-5', 'other-out', 'd5', 1], ['detour-6', 'd5', 'merge', 1], ['tail', 'merge', 'exit', 1],
    ]
    const { graph, routes } = fixture([...sharedActions(), alternative])
    const { original, model } = paper(graph, routes[2])
    expect(model.safeRejoin).toEqual({ ok: false, reason: 'different-gates' })
    expect(model.hiddenHomeDetails).toBe(false)
    expect(model.guide.steps).toEqual(original.steps)
  })

  it('does not hide an earlier different gate by rejoining at a later common gate', () => {
    const { routes } = fixture(['a', 'b'].map(s => [
      [`first-${s}`, `origin-${s}`, `out-${s}`, 6], [`walk-${s}`, `out-${s}`, 'common-in', 1],
      ['common', 'common-in', 'common-out', 6], ['tail', 'common-out', 'exit', 1],
    ]))
    expect(proveSafeGateRejoin(routes)).toEqual({ ok: false, reason: 'different-gates' })
  })

  it('does not hide a loop that returns to the gate boundary', () => {
    const { routes } = fixture([[
      ['walk', 'origin', 'gate-in', 1], ['gate', 'gate-in', 'gate-out', 6],
      ['loop-out', 'gate-out', 'loop', 1], ['loop-back', 'loop', 'gate-in', 1], ['tail', 'gate-in', 'exit', 1],
    ]])
    expect(proveSafeGateRejoin(routes)).toEqual({ ok: false, reason: 'repeated-gate' })
  })

  it('does not prepend an independent official EV route when GTFS home details are retained', () => {
    const { graph, routes } = fixture(sharedActions())
    const { original } = paper(graph, routes[0])
    const model = buildHomeToGateGuideModel({
      guide: original, graph, platformId: 'platform', exitNodeIds: ['exit'], selectedRoute: routes[0],
      metadata: { ...metadata, preGatePresentation: 'retain-gtfs-details' },
    })
    expect(model.safeRejoin.ok).toBe(true)
    expect(model.hiddenHomeDetails).toBe(false)
    expect(model.guide.steps).toEqual(original.steps)
    expect(model.carPositionHint).toBe('できれば5号車付近に乗る')
  })
})
