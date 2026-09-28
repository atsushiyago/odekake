import { describe, expect, it } from 'vitest'
import { outingCoursePresets } from './coursePresets'

describe('outing course presets', () => {
  it('registers destinations without UI-specific station constants', () => {
    expect(outingCoursePresets.map(course => course.label)).toEqual(['東京タワー', '国立新美術館', '国立競技場', '旧芝離宮恩賜庭園', 'パティオ十番', '明治神宮外苑いちょう並木', '明治神宮・代々木口', '新宿文化センター', 'サザンタワー', '思い出横丁', 'アメ横', '東京都庁展望室'])
    expect(outingCoursePresets[0].walkingRoute?.geometry?.coordinates.length).toBeGreaterThan(10)
    expect(outingCoursePresets[1].arrivalStationName).toBe('六本木')
    expect(outingCoursePresets[2].arrivalStationName).toBe('国立競技場')
    expect(outingCoursePresets[3].arrivalStationName).toBe('大門')
    expect(outingCoursePresets[4].arrivalStationName).toBe('麻布十番')
  })

  it('registers the three new destinations with official transport and fixed walking data', () => {
    expect(outingCoursePresets.slice(5).every(course => !course.unavailableReason && course.walkingRoute && course.departurePlatformAssignments.length > 0 && course.arrivalPlatformAssignments.length > 0)).toBe(true)
    expect(outingCoursePresets[5]).toMatchObject({ preferredExitId: '425N0123', walkingRoute: { stationExitConnection: { exitNodeId: '425N0123' } } })
    expect(outingCoursePresets[6]).toMatchObject({ preferredExitId: '427N0084', walkingRoute: { stationExitConnection: { exitNodeId: '427N0084' } } })
    expect(outingCoursePresets[7]).toMatchObject({ preferredExitId: ['403N0019', '403N0020'], walkingRoute: { stationExitConnection: { exitNodeId: '403N0019' } } })
  })

  it('registers official exits and fixed walking routes for the registered courses', () => {
    expect(outingCoursePresets[1]).toMatchObject({ preferredExitId: '424N0053', walkingRoute: { stationExitConnection: { exitNodeId: '424N0053' } } })
    expect(outingCoursePresets[2]).toMatchObject({ preferredExitId: ['426N0139', '426N0241'], walkingRoute: { stationExitConnection: { exitNodeId: '426N0139' } } })
    expect(outingCoursePresets[3]).toMatchObject({ preferredExitId: '421N0015', walkingRoute: { stationExitConnection: { exitNodeId: '421N0015' }, baseMinutes: 3 } })
    expect(outingCoursePresets[4]).toMatchObject({ preferredExitId: '423N0063', walkingRoute: { stationExitConnection: { exitNodeId: '423N0063' }, baseMinutes: 7 } })
    expect(outingCoursePresets[8]).toMatchObject({ preferredExitId: '428N0193', walkingRoute: { stationExitConnection: { exitNodeId: '428N0193' }, baseMinutes: 1 } })
    expect(outingCoursePresets[9]).toMatchObject({ preferredExitId: '402N0002', walkingRoute: { stationExitConnection: { exitNodeId: '402N0002' } } })
    expect(outingCoursePresets[10]).toMatchObject({ preferredExitId: '410N0016', walkingRoute: { stationExitConnection: { exitNodeId: '410N0016' } } })
    expect(outingCoursePresets[11]).toMatchObject({ preferredExitId: '429N0093', walkingRoute: { stationExitConnection: { exitNodeId: '429N0093' } } })
  })

  it('keeps outdoor paper data to route, time, and endpoints without hand-written directions', () => {
    expect(outingCoursePresets).toHaveLength(12)
    for (const course of outingCoursePresets) {
      const route = course.walkingRoute!
      expect('directions' in route).toBe(false)
      expect(route.geometry?.type).toBe('LineString')
      expect(route.geometry?.coordinates.length).toBeGreaterThan(1)
      expect(route.baseMinutes).toBeGreaterThan(0)
      expect(route.from.label).toBeTruthy()
      expect(route.to.label).toBeTruthy()
      expect(route.stationExitConnection?.exitLabel).toBeTruthy()
    }
  })

  it('keeps user-facing floors as explicit official metadata', () => {
    expect(outingCoursePresets[8].arrivalPlatformFloor).toMatchObject({ label: '地下7階', levelIndex: -6 })
    expect(outingCoursePresets[8].gateFloor).toMatchObject({ label: '地下3階', levelIndex: -2 })
  })
})
