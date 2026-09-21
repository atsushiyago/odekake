import { toeiOedoExtractedDirectLegs } from './toei-oedo-direct-legs'
import { toeiOedoReverseExtractedDirectLegs } from './toei-oedo-reverse-direct-legs'
import { toeiOedoAzabuJubanDirectLegs } from './toei-oedo-azabu-juban-direct-legs'
import { toeiOedoAddedDirectLegs } from './toei-oedo-added-direct-legs'

/**
 * Weekday direct-leg index generated from stop_times.txt/trips.txt in the
 * official Toei static GTFS feed. It is limited to the four stations used by
 * the current course presets; the extraction is data-driven, not hand-written.
 */
export const toeiOedoWeekdayTrips = [...toeiOedoExtractedDirectLegs, ...toeiOedoReverseExtractedDirectLegs, ...toeiOedoAzabuJubanDirectLegs, ...toeiOedoAddedDirectLegs]

/** Backwards-compatible name for the original PoC fixture. */
export const toeiOedoDaimonToAkabanebashiWeekdayTrips = toeiOedoWeekdayTrips.filter(item => item.from.stationName === '大門' && item.to.stationName === '赤羽橋')

export const toeiStaticGtfsValidity = { startDate: '2026-03-14', endDate: '2026-12-31' } as const
