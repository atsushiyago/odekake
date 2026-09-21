/**
 * A scheduled rail leg and the independently sourced station/platform mapping.
 * Static GTFS stop_times has no platform field, so a platform is never inferred
 * from stop sequence, direction, or geometry alone.
 */
export interface ScheduledRailLeg {
  tripId: string
  routeId: string
  routeName: string
  serviceDay: 'weekday'
  directionId: string
  headsign: string
  from: { stationId: string; stationName: string; departureTime: string; stopSequence: number }
  to: { stationId: string; stationName: string; arrivalTime: string; stopSequence: number }
  source: { url: string; feedVersion: string; retrievedAt: string }
}

/** A literal, independently checked official relationship between a service direction and a platform. */
export interface OfficialPlatformAssignment {
  stationId: string
  platformId: string
  routeId: string
  directionId: string
  headsign: string
  source: { url: string; checkedAt: string; description: string }
}

/** A literal, independently checked relationship for the departure side. */
export interface OfficialDeparturePlatformAssignment {
  stationId: string; platformId: string; platformCode: string
  routeId: string
  directionId: string
  headsign: string
  source: { url: string; checkedAt: string; description: string }
}

export interface ArrivalPlatformConnection {
  leg: ScheduledRailLeg
  assignment: OfficialPlatformAssignment
  platformId: string
}

export type ArrivalPlatformResolution =
  | { ok: true; connection: ArrivalPlatformConnection }
  | { ok: false; reason: 'arrival-station-mismatch' | 'no-official-platform-assignment' }

export type DeparturePlatformResolution =
  | { ok: true; assignment: OfficialDeparturePlatformAssignment }
  | { ok: false; reason: 'departure-station-mismatch' | 'no-official-platform-assignment' }

/**
 * Matches only an explicitly registered official assignment. Absence is an
 * expected safety outcome: callers must omit the indoor route, not choose a platform.
 */
export function resolveArrivalPlatform(
  leg: ScheduledRailLeg,
  arrivalStationId: string,
  assignments: OfficialPlatformAssignment[],
): ArrivalPlatformResolution {
  if (leg.to.stationId !== arrivalStationId) return { ok: false, reason: 'arrival-station-mismatch' }
  const assignment = assignments.find(item =>
    item.stationId === arrivalStationId
    && item.routeId === leg.routeId
    && item.directionId === leg.directionId
    && item.headsign === leg.headsign,
  )
  return assignment
    ? { ok: true, connection: { leg, assignment, platformId: assignment.platformId } }
    : { ok: false, reason: 'no-official-platform-assignment' }
}

export function resolveDeparturePlatform(
  leg: ScheduledRailLeg,
  departureStationId: string,
  assignments: OfficialDeparturePlatformAssignment[],
): DeparturePlatformResolution {
  if (leg.from.stationId !== departureStationId) return { ok: false, reason: 'departure-station-mismatch' }
  const assignment = assignments.find(item =>
    item.stationId === departureStationId
    && item.routeId === leg.routeId
    && item.directionId === leg.directionId
    && item.headsign === leg.headsign,
  )
  return assignment ? { ok: true, assignment } : { ok: false, reason: 'no-official-platform-assignment' }
}
