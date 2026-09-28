import { describe, expect, it } from 'vitest'
import type { IndoorSource } from './indoorRouting'
import { findIndoorRoute } from './indoorRouting'
import { buildWalkingNetworkRoutingData, type FacilityMatchMethod } from './walkingNetworkFacilityMatching'
import { parseWalkingNetworkGeoJson, type WalkingNetworkFeatureCollection } from './walkingNetworkGeoJson'
import { buildWalkingNetworkGraph, type RawWalkingNetworkStationData } from './walkingNetwork'
import { akabanebashiWalkingNetworkFixture } from '../data/fixtures/akabanebashi-walking-network'
import { akabanebashiStationMapGeoJson } from '../data/stationMaps/akabanebashi'
import { azabuJubanStationMapGeoJson } from '../data/stationMaps/azabuJuban'
import { roppongiStationMapGeoJson } from '../data/stationMaps/roppongi'
import { shinjukuStationMapGeoJson } from '../data/stationMaps/shinjuku'
import azabuNodes from '../data/stationMaps/azabuJuban/walking-network/node.geojson?raw'
import azabuLinks from '../data/stationMaps/azabuJuban/walking-network/link.geojson?raw'
import roppongiNodes from '../data/stationMaps/roppongi/walking-network/node.geojson?raw'
import roppongiLinks from '../data/stationMaps/roppongi/walking-network/link.geojson?raw'
import shinjukuNodes from '../data/stationMaps/shinjuku/node.geojson?raw'
import shinjukuLinks from '../data/stationMaps/shinjuku/link.geojson?raw'

const source: IndoorSource = { name: 'walking test data', url: 'https://example.invalid/walking', license: 'test', feedVersion: 'test', retrievedAt: '2026-09-28' }
const collection = (raw: string) => JSON.parse(raw) as WalkingNetworkFeatureCollection
const parse = (stationId: string, stationName: string, nodes: string, links: string) => parseWalkingNetworkGeoJson({ source, stationId, stationName, nodes: collection(nodes), links: collection(links) })

describe('walking network equipment and optional map matching', () => {
  it('keeps Akabanebashi walking-network route edges even when only a verification subset is available', () => {
    const result = buildWalkingNetworkRoutingData({
      data: akabanebashiWalkingNetworkFixture,
      linkGeometryById: new Map(),
      spaces: akabanebashiStationMapGeoJson.spaces,
      facilities: akabanebashiStationMapGeoJson.facilities,
      floors: akabanebashiStationMapGeoJson.floors,
    })
    expect(result.graph.edges.some(edge => edge.movementType === 'elevator')).toBe(true)
    expect(result.facilityMatches.elevators.length).toBeGreaterThan(0)
    const elevator = result.graph.edges.find(edge => edge.movementType === 'elevator')!
    expect(findIndoorRoute(result.graph, elevator.fromNodeId, elevator.toNodeId)?.edges).toContainEqual(elevator)
  })

  it.each([
    ['Azabujuban', parse('423', '麻布十番駅', azabuNodes, azabuLinks), azabuJubanStationMapGeoJson],
    ['Roppongi', parse('424', '六本木駅', roppongiNodes, roppongiLinks), roppongiStationMapGeoJson],
    ['Shinjuku', parse('428', '新宿駅', shinjukuNodes, shinjukuLinks), shinjukuStationMapGeoJson],
  ] as const)('matches %s elevators/escalators while retaining the walking network as the routing graph', (_name, parsed, stationMap) => {
    const result = buildWalkingNetworkRoutingData({ data: parsed.data, linkGeometryById: parsed.linkGeometryById, spaces: stationMap.spaces, facilities: stationMap.facilities, floors: stationMap.floors })
    expect(result.graph.edges.some(edge => edge.movementType === 'elevator')).toBe(true)
    expect(result.graph.edges.some(edge => edge.movementType === 'escalator')).toBe(true)
    expect(result.facilityMatches.elevators.length).toBeGreaterThan(0)
    expect(result.facilityMatches.escalators.length).toBeGreaterThan(0)
    const methods = result.facilityMatches.escalators.map(match => match.method)
    expect(methods.every((method: FacilityMatchMethod) => ['intersection', 'nearby', 'unmatched'].includes(method))).toBe(true)
    if (_name === 'Shinjuku') {
      expect(methods).toContain('nearby')
      expect(methods).toContain('unmatched')
    }
    for (const match of result.facilityMatches.escalators) {
      if (match.method === 'unmatched') expect(match.spaceId).toBeUndefined()
      if (match.method !== 'unmatched') expect(match.spaceId).toBeTruthy()
    }
    // The map sidecar may be incomplete: every directional source edge remains routable.
    const edge = result.graph.edges.find(item => item.movementType === 'escalator')!
    expect(findIndoorRoute(result.graph, edge.fromNodeId, edge.toNodeId)?.edges).toContainEqual(edge)
  })

  it('uses a unique same-floor containment for elevator components and allows a missing facility', () => {
    const nodeA = { id: 'a', latitude: 35, longitude: 139, floor: '-1' }
    const nodeB = { id: 'b', latitude: 35, longitude: 139, floor: '-2' }
    const square = (id: string, category: string, floor_id: string, x: number, y: number) => ({ type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [[[x,y],[x+0.001,y],[x+0.001,y+0.001],[x,y+0.001],[x,y]]] }, properties: { id, category, floor_id } })
    const pointFeature = { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [138.9995,34.9995] }, properties: { id: 'elev-point', category: 'F012', floor_id: 'f1' } }
    const result = buildWalkingNetworkRoutingData({
      data: { source, stationId: 'fiction', stationName: '架空駅', nodes: [nodeA,nodeB], links: [{ id:'lift',startNodeId:'a',endNodeId:'b',distanceMeters:2,routeType:4,direction:1 }] },
      linkGeometryById: new Map(),
      spaces: [{ type:'FeatureCollection', features:[square('lift-space','B022','f1',138.999,34.999), square('lift-space-b','B022','f2',138.999,34.999)] }],
      facilities: [{ type:'FeatureCollection', features:[pointFeature] }],
      floors: [{ type:'FeatureCollection', features:[{type:'Feature',geometry:{type:'Point',coordinates:[0,0]},properties:{id:'f1',ordinal:-1}},{type:'Feature',geometry:{type:'Point',coordinates:[0,0]},properties:{id:'f2',ordinal:-2}}] }],
    })
    expect(result.facilityMatches.elevators).toHaveLength(2)
    expect(result.facilityMatches.elevators[0]).toMatchObject({ method:'contained', spaceId:'lift-space', facilityId:'elev-point' })
    expect(result.facilityMatches.elevators[1]).toMatchObject({ method:'contained', spaceId:'lift-space-b', facilityId:null })
    expect(result.graph.edges).toHaveLength(2)
  })

  it('matches escalators by intersection first and applies the strict meter-based nearby margin only as fallback', () => {
    const nodes = [{id:'a',latitude:35,longitude:139,floor:'-1'}, {id:'b',latitude:35.00002,longitude:139,floor:'-2'}]
    const link = {id:'es',startNodeId:'a',endNodeId:'b',distanceMeters:3,routeType:5 as const,direction:2 as const}
    const polygon = (id:string, floorId:string, lon:number, lat:number, category='B023') => ({ type:'Feature' as const, geometry:{type:'Polygon' as const,coordinates:[[[lon,lat],[lon+0.00002,lat],[lon+0.00002,lat+0.00001],[lon,lat+0.00001],[lon,lat]]] }, properties:{id,category,floor_id:floorId} })
    const floors = [{type:'FeatureCollection' as const,features:[{type:'Feature' as const,geometry:{type:'Point' as const,coordinates:[0,0]},properties:{id:'f1',ordinal:-1}},{type:'Feature' as const,geometry:{type:'Point' as const,coordinates:[0,0]},properties:{id:'f2',ordinal:-2}}]}]
    const base = { data:{source,stationId:'fiction',stationName:'架空駅',nodes,links:[link]}, facilities:[], floors, linkGeometryById:new Map([['es',[[139,35],[139,35.00002]] as Array<[number,number]>]]) }
    const intersecting = buildWalkingNetworkRoutingData({ ...base, spaces:[{type:'FeatureCollection',features:[polygon('landing','f1',138.99999,34.99999)]}] })
    expect(intersecting.facilityMatches.escalators[0]).toMatchObject({method:'intersection',spaceId:'landing',facilityId:null})
    const nearby = buildWalkingNetworkRoutingData({ ...base, spaces:[{type:'FeatureCollection',features:[polygon('near','f1',139.000001,35)]}] })
    expect(nearby.facilityMatches.escalators[0].method).toBe('nearby')
    const ambiguous = buildWalkingNetworkRoutingData({ ...base, spaces:[{type:'FeatureCollection',features:[polygon('near-a','f1',139.000001,35),polygon('near-b','f1',139.000002,35)]}] })
    expect(ambiguous.facilityMatches.escalators[0].method).toBe('unmatched')
    expect(nearby.graph.edges.some(edge => edge.movementType === 'escalator')).toBe(true)
    expect(ambiguous.graph.edges.some(edge => edge.movementType === 'escalator')).toBe(true)
    const unmatchedEdge = ambiguous.graph.edges.find(edge => edge.movementType === 'escalator')!
    expect(findIndoorRoute(ambiguous.graph, unmatchedEdge.fromNodeId, unmatchedEdge.toNodeId)?.edges).toContainEqual(unmatchedEdge)
  })

  it('applies source direction to route traversal instead of using Facility matches to orient links', () => {
    const raw: RawWalkingNetworkStationData = {
      source, stationId:'fiction', stationName:'架空駅',
      nodes:[{id:'a',latitude:35,longitude:139,floor:'-1'},{id:'b',latitude:35,longitude:139,floor:'0'},{id:'c',latitude:35,longitude:139,floor:'1'}],
      links:[
        {id:'forward-only',startNodeId:'a',endNodeId:'b',distanceMeters:1,routeType:5,direction:2},
        {id:'reverse-only',startNodeId:'b',endNodeId:'c',distanceMeters:1,routeType:4,direction:3},
      ],
    }
    const graph = buildWalkingNetworkGraph(raw).graph
    expect(findIndoorRoute(graph,'a','b')?.edges.map(edge=>edge.id)).toEqual(['forward-only'])
    expect(findIndoorRoute(graph,'b','a')).toBeNull()
    expect(findIndoorRoute(graph,'c','b')?.edges.map(edge=>edge.id)).toEqual(['reverse-only'])
    expect(findIndoorRoute(graph,'b','c')).toBeNull()
  })
})
