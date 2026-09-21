import shinjukuExtraction from '../fixtures/oedo2026-shinjuku-gtfs-pathways.json'
import shinjukuNishiguchiExtraction from '../fixtures/oedo2026-shinjuku-nishiguchi-gtfs-pathways.json'
import daimonExtraction from '../fixtures/oedo2026-daimon-gtfs-pathways.json'
import akabanebashiExtraction from '../fixtures/oedo2026-akabanebashi-gtfs-pathways.json'
import aoyamaItchomeExtraction from '../fixtures/oedo2026-aoyama-itchome-gtfs-pathways.json'
import kokuritsuKyogijoExtraction from '../fixtures/oedo2026-kokuritsu-kyogijo-gtfs-pathways.json'
import tochomaeExtraction from '../fixtures/oedo2026-tochomae-gtfs-pathways.json'
import azabuJubanExtraction from '../fixtures/oedo2026-azabu-juban-gtfs-pathways.json'
import higashiShinjukuExtraction from '../fixtures/oedo2026-higashi-shinjuku-gtfs-pathways.json'
import roppongiExtraction from '../fixtures/oedo2026-roppongi-gtfs-pathways.json'
import uenoOkachimachiExtraction from '../fixtures/oedo2026-ueno-okachimachi-gtfs-pathways.json'
import yoyogiExtraction from '../fixtures/oedo2026-yoyogi-gtfs-pathways.json'
import type { RawGtfsPathwaysStationData, VerifiedIndoorRouteAnchor } from '../../domain/indoorRouting'
import type { StationRef } from '../../domain/types'
import { extractGtfsPathwaysStation, type GtfsPathwaysFeed } from '../adapters/gtfsPathwaysAdapter'
import { oedo2026IndoorStations } from './oedo2026IndoorStations'

export interface IndoorStationDataset {
  key: string
  station: StationRef
  gtfs: RawGtfsPathwaysStationData
  /** No route can become printable until an anchor is independently reviewed. */
  reviewedAnchors: VerifiedIndoorRouteAnchor[]
}

type ExtractedGtfsStation = {
  source: GtfsPathwaysFeed['source']
  station: { id: string; name: string }
  levels: GtfsPathwaysFeed['levels']
  stops: GtfsPathwaysFeed['stops']
  pathways: GtfsPathwaysFeed['pathways']
}

/** Adapts reproducibly extracted GTFS JSON; it never fills missing stops or pathways. */
function fromExtractedGtfs(extracted: ExtractedGtfsStation): RawGtfsPathwaysStationData {
  return extractGtfsPathwaysStation({ source: extracted.source, levels: extracted.levels, stops: extracted.stops, pathways: extracted.pathways }, extracted.station)
}

const toeiOedoLine = (id: string, name: string): StationRef => ({ id, name, operator: '東京都交通局', line: '大江戸線' })
const datasetRegistrations = [
  ['shinjuku', '428', '新宿', shinjukuExtraction],
  ['shinjuku-nishiguchi', '402', '新宿西口', shinjukuNishiguchiExtraction],
  ['daimon', '421', '大門', daimonExtraction],
  ['akabanebashi', '422', '赤羽橋', akabanebashiExtraction],
  ['aoyama-itchome', '425', '青山一丁目', aoyamaItchomeExtraction],
  ['kokuritsu-kyogijo', '426', '国立競技場', kokuritsuKyogijoExtraction],
  ['tochomae', '429', '都庁前', tochomaeExtraction],
  ['azabu-juban', '423', '麻布十番', azabuJubanExtraction],
  ['higashi-shinjuku', '403', '東新宿', higashiShinjukuExtraction],
  ['roppongi', '424', '六本木', roppongiExtraction],
  ['ueno-okachimachi', '410', '上野御徒町', uenoOkachimachiExtraction],
  ['yoyogi', '427', '代々木', yoyogiExtraction],
] as const

/** The only station-specific registration point; consumers use this common shape. */
export const loadedOedo2026IndoorDatasets: IndoorStationDataset[] = datasetRegistrations.map(([key, id, name, extracted]) => ({ key, station: toeiOedoLine(id, name), gtfs: fromExtractedGtfs(extracted as ExtractedGtfsStation), reviewedAnchors: [] }))

export const loadedOedo2026IndoorDatasetByKey = new Map(loadedOedo2026IndoorDatasets.map(dataset => [dataset.key, dataset]))
export const oedo2026StationAvailability = oedo2026IndoorStations.map(station => ({ ...station, dataset: loadedOedo2026IndoorDatasetByKey.get(station.key) }))
