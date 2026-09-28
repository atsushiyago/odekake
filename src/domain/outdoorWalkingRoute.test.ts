import { describe, expect, it } from 'vitest'
import { akabanebashiToTokyoTowerWalkingRoute } from '../data/fixtures/akabanebashi-to-tokyo-tower'

describe('published outdoor walking route', () => {
  it('keeps the Akabanebashi exit, official time, and geometry without manual directions', () => {
    expect(akabanebashiToTokyoTowerWalkingRoute).toMatchObject({
      from: { label: '赤羽橋駅 赤羽橋口' },
      to: { label: '東京タワー（フットタウン）' },
      baseMinutes: 5,
      slowWalkingMultiplier: 1.5,
      dataSource: { type: 'official-destination-access', humanReviewed: false },
      stationExitConnection: { stationId: '422', exitNodeId: '422N0012', exitLabel: '赤羽橋口' },
    })
    expect(akabanebashiToTokyoTowerWalkingRoute.distanceMeters).toBeUndefined()
    expect('directions' in akabanebashiToTokyoTowerWalkingRoute).toBe(false)
    expect(akabanebashiToTokyoTowerWalkingRoute.geometry?.type).toBe('LineString')
    expect(akabanebashiToTokyoTowerWalkingRoute.geometry?.coordinates.length).toBeGreaterThan(10)
    expect(akabanebashiToTokyoTowerWalkingRoute.geometry?.source.provider).toContain('OpenStreetMap')
    expect(akabanebashiToTokyoTowerWalkingRoute.geometry?.coordinates[0][0]).toBeCloseTo(akabanebashiToTokyoTowerWalkingRoute.from.longitude!, 3)
    expect(akabanebashiToTokyoTowerWalkingRoute.geometry?.coordinates.at(-1)?.[1]).toBeCloseTo(akabanebashiToTokyoTowerWalkingRoute.to.latitude!, 3)
  })
})
