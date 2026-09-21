import { describe, expect, it } from 'vitest'
import { oedo2026IndoorStations } from './oedo2026IndoorStations'

describe('Oedo 2026 indoor dataset catalog', () => {
  it('has the announced 12 stations with unique, non-empty GTFS station IDs', () => {
    expect(oedo2026IndoorStations).toHaveLength(12)
    expect(new Set(oedo2026IndoorStations.map(station => station.gtfsStationId)).size).toBe(12)
    expect(oedo2026IndoorStations.every(station => /^\d+$/.test(station.gtfsStationId))).toBe(true)
  })
})
