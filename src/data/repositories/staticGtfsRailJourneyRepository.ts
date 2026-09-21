import type { RailJourneyQuery, RailJourneyRepository, RailJourneySearchResult } from '../../domain/railJourneySearch'
import type { ScheduledRailLeg } from '../../domain/itineraryConnection'
import { toeiOedoWeekdayTrips, toeiStaticGtfsValidity } from '../fixtures/toei-oedo-static-gtfs-schedule'

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).valueOf())
const isTime = (value: string) => /^\d{2}:\d{2}$/.test(value) && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

/**
 * Local static-GTFS adapter. The browser never requests an external endpoint;
 * replacing it with a server-side ODPT/GTFS sync adapter preserves this interface.
 */
export function createStaticGtfsRailJourneyRepository(schedule: readonly ScheduledRailLeg[] = toeiOedoWeekdayTrips): RailJourneyRepository {
  return {
    findDirectJourney(query: RailJourneyQuery): RailJourneySearchResult {
    if (!isDate(query.departureDate) || !isTime(query.departureTime)) return { ok: false, reason: 'invalid-date' }
    if (query.departureDate < toeiStaticGtfsValidity.startDate || query.departureDate > toeiStaticGtfsValidity.endDate) return { ok: false, reason: 'outside-feed-validity' }
    const day = new Date(`${query.departureDate}T12:00:00`).getDay()
    if (day === 0 || day === 6) return { ok: false, reason: 'weekend-not-supported' }
    const originName = query.originName.trim()
    const destinationName = query.destinationName.trim()
    const leg = schedule
      .filter(item => item.from.stationName === originName && item.to.stationName === destinationName)
      .filter(item => item.from.departureTime >= query.departureTime)
      .sort((a, b) => a.from.departureTime.localeCompare(b.from.departureTime))[0]
    return leg ? { ok: true, leg } : { ok: false, reason: 'no-scheduled-trip' }
    },
  }
}

export const staticGtfsRailJourneyRepository = createStaticGtfsRailJourneyRepository()
