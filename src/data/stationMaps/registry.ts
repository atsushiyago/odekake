import type { IndoorGraph, IndoorRouteCompressionContext } from '../../domain/indoorRouting'
import { buildAkabanebashiStationMapCompressionContext } from './akabanebashi'
import { buildAoyamaItchomeStationMapCompressionContext } from './aoyamaItchome'
import { buildAzabuJubanStationMapCompressionContext } from './azabuJuban'
import { buildDaimonStationMapCompressionContext } from './daimon'
import { buildHigashiShinjukuStationMapCompressionContext } from './higashiShinjuku'
import { buildKokuritsuKyogijoStationMapCompressionContext } from './kokuritsuKyogijo'
import { buildRoppongiStationMapCompressionContext } from './roppongi'
import { buildShinjukuNishiguchiStationMapCompressionContext } from './shinjukuNishiguchi'
import { buildShinjukuStationMapCompressionContext } from './shinjuku'
import { buildTochomaeStationMapCompressionContext } from './tochomae'
import { buildUenoOkachimachiStationMapCompressionContext } from './uenoOkachimachi'
import { buildYoyogiStationMapCompressionContext } from './yoyogi'

export type StationMapContextBuilder = (graph: IndoorGraph) => IndoorRouteCompressionContext

/**
 * The only station-aware registration point for published station maps.
 * Routing and semantic presentation consume the capability context returned
 * here; they never branch on station or pathway identifiers themselves.
 */
export const stationMapRegistry = new Map<string, StationMapContextBuilder>([
  ['422', buildAkabanebashiStationMapCompressionContext],
  ['425', buildAoyamaItchomeStationMapCompressionContext],
  ['423', buildAzabuJubanStationMapCompressionContext],
  ['421', buildDaimonStationMapCompressionContext],
  ['403', buildHigashiShinjukuStationMapCompressionContext],
  ['426', buildKokuritsuKyogijoStationMapCompressionContext],
  ['424', buildRoppongiStationMapCompressionContext],
  ['402', buildShinjukuNishiguchiStationMapCompressionContext],
  ['428', buildShinjukuStationMapCompressionContext],
  ['429', buildTochomaeStationMapCompressionContext],
  ['410', buildUenoOkachimachiStationMapCompressionContext],
  ['427', buildYoyogiStationMapCompressionContext],
])

/** Register a station map without changing the UI or routing engine. */
export function registerStationMap(stationId: string, builder: StationMapContextBuilder) {
  stationMapRegistry.set(stationId, builder)
}

export function buildRegisteredStationMapCompressionContext(stationId: string, graph: IndoorGraph) {
  return stationMapRegistry.get(stationId)?.(graph)
}
