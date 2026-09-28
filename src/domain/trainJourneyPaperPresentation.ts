import type { StationGuide } from './types'
import type { ArrivalPlatformConnection, OfficialDeparturePlatformAssignment } from './itineraryConnection'

export interface TrainJourneyPaperPresentation {
  /** Departure-side actions and source facts, shown before the train ride. */
  departure: {
    stationName: string
    time: string
    routeName: string
    headsign: string
    platformLabel?: string
    carPositionLabel?: string
    platformSourceUrl?: string
  }
  /** Arrival platform facts are shown under the header's generic "降りる" label. */
  arrival: {
    stationName: string
    time: string
    platformLabel: string
    platformDisplayLabel: string
    floorLabel?: string
    platformSourceUrl: string
  }
  /** The indoor semantic guide remains intact, including its route/provenance evidence. */
  stationGuide: StationGuide
}

/** Appends the conventional Japanese station suffix without duplicating it. */
export function formatStationName(stationName: string): string {
  const label = stationName.trim()
  return label.endsWith('駅') ? label : `${label}駅`
}

/**
 * Places already-resolved train/platform facts in chronological paper blocks.
 * It does not resolve platforms, infer floors, or rewrite/remove guide actions.
 */
export function buildTrainJourneyPaperPresentation(input: {
  stationGuide: StationGuide
  arrivalConnection: ArrivalPlatformConnection
  departurePlatform?: OfficialDeparturePlatformAssignment
  carPositionLabel?: string
  verifiedArrivalFloorLabel?: string
}): TrainJourneyPaperPresentation {
  const { stationGuide, arrivalConnection } = input
  const leg = arrivalConnection.leg
  const platformLabel = stationGuide.arrivalPlatform
  const floorLabel = input.verifiedArrivalFloorLabel?.trim() || undefined

  return {
    departure: {
      stationName: formatStationName(leg.from.stationName),
      time: leg.from.departureTime,
      routeName: leg.routeName,
      headsign: leg.headsign,
      platformLabel: input.departurePlatform?.platformCode
        ? `${input.departurePlatform.platformCode}番ホーム`
        : undefined,
      carPositionLabel: input.carPositionLabel,
      platformSourceUrl: input.departurePlatform?.source.url,
    },
    arrival: {
      stationName: formatStationName(leg.to.stationName),
      time: leg.to.arrivalTime,
      platformLabel,
      platformDisplayLabel: floorLabel ? `${platformLabel}（${floorLabel}）` : platformLabel,
      floorLabel,
      platformSourceUrl: arrivalConnection.assignment.source.url,
    },
    stationGuide,
  }
}
