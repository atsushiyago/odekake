import { describe, expect, it } from 'vitest'
import { akabanebashiGtfsPathways } from '../data/fixtures/akabanebashi-gtfs-pathways'
import { buildIndoorGraph } from './indoorRouting'
import { auditFareGateGraph } from './fareGateTopologyAudit'

describe('fare gate topology audit', () => {
  it('keeps every current Akabanebashi platform 2 candidate connected through the fare gate', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    const result = auditFareGateGraph(graph).find(group => group.platformId === '422P2' && group.exitId === '422N0012')
    expect(result?.status).toBe('OK')
    expect(result?.boardingAreas).toHaveLength(11)
    expect(result?.boardingAreas.every(area => area.shortest?.fareGateIds.includes('422L0070'))).toBe(true)
    expect(result?.boardingAreas.some(area => area.forcedGate?.kind === 'loop')).toBe(false)
  })

  it('does not classify a group with consistent fare-gate coverage as anomalous', () => {
    const graph = buildIndoorGraph(akabanebashiGtfsPathways)
    const result = auditFareGateGraph(graph).find(group => group.platformId === '422P1' && group.exitId === '422N0012')
    expect(result).toBeDefined()
    expect(result?.status).toBe('OK')
  })
})
