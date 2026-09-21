import { describe, expect, it } from 'vitest'
import { akabanebashiToTokyoTowerWalkingRoute } from '../data/fixtures/akabanebashi-to-tokyo-tower'
import { fitOutdoorRouteGeometry, outdoorMapZoomForDistance } from './outdoorMap'

describe('outdoor map projection', () => {
  it('uses closer generic zoom bands for short routes', () => {
    expect(outdoorMapZoomForDistance(225.6)).toBe(19)
    expect(outdoorMapZoomForDistance(500)).toBe(18)
    expect(outdoorMapZoomForDistance(900)).toBe(17)
    expect(outdoorMapZoomForDistance()).toBe(17)
  })
  it('fits the fixed route and keeps both endpoints inside the view', () => {
    const geometry = akabanebashiToTokyoTowerWalkingRoute.geometry!
    const fit = fitOutdoorRouteGeometry(geometry.coordinates, 17, 800, 560)
    const first = fit.projected[0], last = fit.projected.at(-1)!
    expect(first[0]).toBeGreaterThanOrEqual(0)
    expect(first[0]).toBeLessThanOrEqual(800)
    expect(first[1]).toBeGreaterThanOrEqual(0)
    expect(first[1]).toBeLessThanOrEqual(560)
    expect(last[0]).toBeGreaterThanOrEqual(0)
    expect(last[0]).toBeLessThanOrEqual(800)
    expect(last[1]).toBeGreaterThanOrEqual(0)
    expect(last[1]).toBeLessThanOrEqual(560)
  })
})
