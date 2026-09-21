import { describe, expect, it } from 'vitest'
import { akabanebashiGtfsPathways } from '../data/fixtures/akabanebashi-gtfs-pathways'
import { buildIndoorGraph } from './indoorRouting'
import { auditFareGateGraph } from './fareGateTopologyAudit'

describe('fare gate topology audit', () => {
  it('detects the known Akabanebashi 422N0080 loop case', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    const result = auditFareGateGraph(graph).find(group => group.platformId === '422P2' && group.exitId === '422N0012')
    expect(result?.status).toBe('要確認')
    expect(result?.boardingAreas.filter(area => area.shortest?.fareGateIds.length).length).toBe(11)
    const exception = result?.boardingAreas.find(area => area.boardingAreaId === '422N0080')
    expect(exception?.shortest?.fareGateIds).toEqual([])
    expect(exception?.forcedGate?.kind).toBe('loop')
    expect(exception?.forcedGate?.path?.fareGateIds).toEqual(['422L0070', '422L0070'])
    expect(exception?.forcedGate?.path?.distanceMeters).toBeCloseTo(113.8, 5)
    expect(exception?.forcedGate?.path?.repeatedEdgeIds).toEqual(['422L0071', '422L0070'])
  })

  it('does not classify a group with consistent fare-gate coverage as anomalous', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    const result = auditFareGateGraph(graph).find(group => group.platformId === '422P1' && group.exitId === '422N0012')
    expect(result).toBeDefined()
    expect(result?.status).toBe('OK')
  })
})
