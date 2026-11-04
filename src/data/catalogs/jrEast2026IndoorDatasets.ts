import takanawaGatewayExtraction from '../fixtures/jr2026-takanawa-gateway-gtfs-pathways.json'
import shibuyaExtraction from '../fixtures/jr2026-shibuya-gtfs-pathways.json'
import ikebukuroExtraction from '../fixtures/jr2026-ikebukuro-gtfs-pathways.json'
import shinagawaExtraction from '../fixtures/jr2026-shinagawa-gtfs-pathways.json'
import shinjukuExtraction from '../fixtures/jr2026-shinjuku-gtfs-pathways.json'
import tokyoExtraction from '../fixtures/jr2026-tokyo-gtfs-pathways.json'
import type { IndoorStationDataset } from './oedo2026IndoorDatasets'
import { extractGtfsPathwaysStation, type GtfsPathwaysFeed } from '../adapters/gtfsPathwaysAdapter'
import type { StationRef } from '../../domain/types'

const jrEast = (id: string, name: string, line: string = '山手線'): StationRef => ({
  id,
  name,
  operator: '東日本旅客鉄道',
  line,
})

export const loadedJrEast2026IndoorDatasets: IndoorStationDataset[] = [
  {
    key: 'takanawa-gateway',
    station: jrEast('4229', '高輪ゲートウェイ', '山手線'),
    gtfs: extractGtfsPathwaysStation(
      takanawaGatewayExtraction as GtfsPathwaysFeed,
      { id: '4229', name: '高輪ゲートウェイ' }
    ),
    reviewedAnchors: [],
  },
  {
    key: 'shibuya',
    station: jrEast('4205', '渋谷', '山手線'),
    gtfs: extractGtfsPathwaysStation(
      shibuyaExtraction as GtfsPathwaysFeed,
      { id: '4205', name: '渋谷' }
    ),
    reviewedAnchors: [],
  },
  {
    key: 'ikebukuro',
    station: jrEast('4212', '池袋', '山手線'),
    gtfs: extractGtfsPathwaysStation(
      ikebukuroExtraction as GtfsPathwaysFeed,
      { id: '4212', name: '池袋' }
    ),
    reviewedAnchors: [],
  },
  {
    key: 'shinagawa',
    station: jrEast('4230', '品川', '山手線'),
    gtfs: extractGtfsPathwaysStation(
      shinagawaExtraction as GtfsPathwaysFeed,
      { id: '4230', name: '品川' }
    ),
    reviewedAnchors: [],
  },
  {
    key: 'shinjuku-jr',
    station: jrEast('4208', '新宿', '山手線'),
    gtfs: extractGtfsPathwaysStation(
      shinjukuExtraction as GtfsPathwaysFeed,
      { id: '4208', name: '新宿' }
    ),
    reviewedAnchors: [],
  },
  {
    key: 'tokyo',
    station: jrEast('4224', '東京', '山手線'),
    gtfs: extractGtfsPathwaysStation(
      tokyoExtraction as GtfsPathwaysFeed,
      { id: '4224', name: '東京' }
    ),
    reviewedAnchors: [],
  },
]
