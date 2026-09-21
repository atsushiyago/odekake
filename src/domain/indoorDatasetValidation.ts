import type { IndoorStationDataset } from '../data/catalogs/oedo2026IndoorDatasets'
import { buildGtfsStationGuide, buildIndoorGraph } from './indoorRouting'

export interface IndoorDatasetValidation {
  key: string
  stationName: string
  loaded: boolean
  graphNodeCount: number
  graphEdgeCount: number
  routeGenerated: boolean
  routeFailureReason?: string
}

/**
 * Uses no station-specific route labels or anchors. Every platform/exit pair is
 * tried through the standard GTFS-only guide generator until one succeeds.
 */
export function validateIndoorDataset(dataset: IndoorStationDataset): IndoorDatasetValidation {
  try {
    const graph = buildIndoorGraph(dataset.gtfs)
    const platforms = [...graph.nodes.values()].filter(node => node.kind === 'platform')
    const exits = [...graph.nodes.values()].filter(node => node.kind === 'entrance-exit')
    const failureReasons = new Set<string>()
    for (const platform of platforms) for (const exit of exits) {
      const guide = buildGtfsStationGuide(graph, dataset.station, { platformId: platform.id, exitNodeId: exit.id })
      if (guide.ok) return { key: dataset.key, stationName: dataset.station.name, loaded: true, graphNodeCount: graph.nodes.size, graphEdgeCount: graph.edges.length, routeGenerated: true }
      failureReasons.add(guide.reason)
    }
    return { key: dataset.key, stationName: dataset.station.name, loaded: true, graphNodeCount: graph.nodes.size, graphEdgeCount: graph.edges.length, routeGenerated: false, routeFailureReason: failureReasons.size ? [...failureReasons].join(' / ') : 'ホームまたは出入口がGTFSにありません' }
  } catch (error) {
    return { key: dataset.key, stationName: dataset.station.name, loaded: false, graphNodeCount: 0, graphEdgeCount: 0, routeGenerated: false, routeFailureReason: error instanceof Error ? error.message : 'データ読込エラー' }
  }
}

export function validateIndoorDatasets(datasets: IndoorStationDataset[]) {
  return datasets.map(validateIndoorDataset)
}
