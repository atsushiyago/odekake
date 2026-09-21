import type { WalkingRoute } from './types'

export interface PublishedOutdoorWalkingRoute {
  id: string
  from: WalkingRoute['from']
  to: WalkingRoute['to']
  officialMinutes?: number
  routingMinutes?: number
  directions: string[]
  sourceUrl: string
  retrievedAt: string
  stationExitConnection: NonNullable<WalkingRoute['stationExitConnection']>
  geometry?: NonNullable<WalkingRoute['geometry']>
}

/**
 * Converts a published destination access route into the provider-neutral model.
 * This does not call a routing API or infer geometry, distance, street names, or turns.
 */
export function buildPublishedOutdoorWalkingRoute(route: PublishedOutdoorWalkingRoute): WalkingRoute {
  return {
    id: route.id,
    from: route.from,
    to: route.to,
    baseMinutes: route.officialMinutes ?? route.routingMinutes ?? 0,
    slowWalkingMultiplier: 1.5,
    directions: route.directions,
    timeBasis: route.officialMinutes !== undefined ? 'official' : 'routing',
    sourceUrl: route.sourceUrl,
    verifiedAt: route.retrievedAt,
    confidence: 'needs-review',
    dataSource: { type: 'official-destination-access', retrievedAt: route.retrievedAt, humanReviewed: false },
    stationExitConnection: route.stationExitConnection,
    geometry: route.geometry,
  }
}
