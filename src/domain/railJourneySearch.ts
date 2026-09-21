import type { ScheduledRailLeg } from './itineraryConnection'

export interface RailJourneyQuery {
  originName: string
  destinationName: string
  departureDate: string
  departureTime: string
}

export type RailJourneySearchResult =
  | { ok: true; leg: ScheduledRailLeg }
  | { ok: false; reason: 'invalid-date' | 'weekend-not-supported' | 'outside-feed-validity' | 'unsupported-station-pair' | 'no-scheduled-trip' }

export interface RailJourneyRepository {
  findDirectJourney(query: RailJourneyQuery): RailJourneySearchResult
}
