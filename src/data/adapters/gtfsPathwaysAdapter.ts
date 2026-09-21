import type { IndoorSource, PathwayMode, RawGtfsPathwaysStationData, RawGtfsStop } from '../../domain/indoorRouting.ts'

export interface GtfsStopRow {
  stopId: string; stopName?: string; stopLat: string | number; stopLon: string | number; locationType: string | number
  parentStation?: string; levelId?: string; platformCode?: string
}
export interface GtfsLevelRow { levelId: string; levelIndex: string | number }
export interface GtfsPathwayRow {
  pathwayId: string; fromStopId: string; toStopId: string; pathwayMode: string | number; isBidirectional: string | number | boolean; length: string | number
}
export interface GtfsPathwaysFeed { source: IndoorSource; stops: GtfsStopRow[]; levels: GtfsLevelRow[]; pathways: GtfsPathwayRow[] }

const modes = new Set<PathwayMode>([1, 2, 3, 4, 5, 6, 7])
const numeric = (value: string | number) => Number(value)

/**
 * Extracts one station and all descendants using only GTFS `parent_station` relations.
 * It does not use coordinates or text matching to infer station membership.
 */
export function extractGtfsPathwaysStation(feed: GtfsPathwaysFeed, station: { id: string; name: string }): RawGtfsPathwaysStationData {
  const included = new Set([station.id])
  let changed = true
  while (changed) {
    changed = false
    for (const stop of feed.stops) {
      if (stop.parentStation && included.has(stop.parentStation) && !included.has(stop.stopId)) { included.add(stop.stopId); changed = true }
    }
  }
  const levelIndexes = new Map(feed.levels.map(level => [level.levelId, numeric(level.levelIndex)]))
  const stops: RawGtfsStop[] = feed.stops.filter(stop => included.has(stop.stopId)).flatMap(stop => {
    const latitude = numeric(stop.stopLat), longitude = numeric(stop.stopLon), locationType = numeric(stop.locationType)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isInteger(locationType)) return []
    const levelIndex = stop.levelId ? levelIndexes.get(stop.levelId) : undefined
    return [{ id: stop.stopId, name: stop.stopName, latitude, longitude, locationType, levelIndex: Number.isFinite(levelIndex) ? levelIndex : undefined, platformCode: stop.platformCode, parentPlatformId: locationType === 4 ? stop.parentStation : undefined }]
  })
  const nodeIds = new Set(stops.map(stop => stop.id))
  const pathways = feed.pathways.flatMap(pathway => {
    const mode = numeric(pathway.pathwayMode), lengthMeters = numeric(pathway.length)
    if (!nodeIds.has(pathway.fromStopId) || !nodeIds.has(pathway.toStopId) || !modes.has(mode as PathwayMode) || !Number.isFinite(lengthMeters) || lengthMeters < 0) return []
    return [{ id: pathway.pathwayId, fromStopId: pathway.fromStopId, toStopId: pathway.toStopId, mode: mode as PathwayMode, isBidirectional: pathway.isBidirectional === true || String(pathway.isBidirectional) === '1', lengthMeters }]
  })
  return { source: feed.source, stationId: station.id, stationName: station.name, levels: [...new Set(stops.map(stop => stop.levelIndex).filter((level): level is number => level !== undefined))], stops, pathways }
}
