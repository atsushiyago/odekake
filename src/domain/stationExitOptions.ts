import type { IndoorGraph } from './indoorRouting'
import { formatExitLabel } from './paperLabels'

export interface AvailableExitGroup {
  label: string
  rawName: string
  nodeIds: string[]
  lat?: number
  lon?: number
}

/**
 * Checks whether an entrance-exit node is considered a ground-level exit.
 * Nodes at level 0 or above are true surface exits.
 * Nodes below level 0 (e.g. level -0.5, -1) are underground connection points to
 * other railway lines or underground shopping streets, unless they are officially
 * designated as the primary surface exit for a preset course (such as Yoyogi A2).
 */
export function isGroundExitNode(
  levelIndex: number | undefined,
  nodeId: string,
  preferredExitId?: string | string[],
): boolean {
  if (levelIndex !== undefined && levelIndex >= 0) {
    return true
  }
  if (preferredExitId) {
    const ids = Array.isArray(preferredExitId) ? preferredExitId : [preferredExitId]
    if (ids.includes(nodeId)) {
      return true
    }
  }
  return false
}

const jrEastStationIds = new Set(['4229', '4205', '4208', '4212', '4224', '4230'])

/**
 * Extracts and groups all surface entrance-exit nodes in a station graph by their formatted exit label.
 * Multiple nodes sharing the same exit name (e.g. separate stairs vs elevator nodes for the same exit)
 * are consolidated into a single group.
 * Underground connection boundaries (level < 0 without course verification) are filtered out for subway lines,
 * while JR East station ticket gate boundaries (excluding internal Shinkansen transfer gates) are preserved.
 */
export function getStationExitGroups(
  graph: IndoorGraph,
  preferredExitId?: string | string[],
): AvailableExitGroup[] {
  const isJrEastStation = jrEastStationIds.has(graph.stationId)
  const exits = [...graph.nodes.values()].filter(
    (node) =>
      node.kind === 'entrance-exit' &&
      !(node.name ?? '').includes('乗換改札') &&
      (isJrEastStation || isGroundExitNode(node.levelIndex, node.id, preferredExitId)),
  )
  const groupMap = new Map<
    string,
    { rawName: string; nodeIds: string[]; lat?: number; lon?: number }
  >()

  for (const node of exits) {
    const rawName = (node.name ?? '').trim() || node.id
    const label = formatExitLabel(rawName)
    const existing = groupMap.get(label)
    if (existing) {
      if (!existing.nodeIds.includes(node.id)) {
        existing.nodeIds.push(node.id)
      }
      if (existing.lat === undefined && node.latitude) {
        existing.lat = node.latitude
        existing.lon = node.longitude
      }
    } else {
      groupMap.set(label, {
        rawName,
        nodeIds: [node.id],
        lat: node.latitude,
        lon: node.longitude,
      })
    }
  }

  return [...groupMap.entries()]
    .map(([label, info]) => ({
      label,
      rawName: info.rawName,
      nodeIds: info.nodeIds,
      lat: info.lat,
      lon: info.lon,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ja', { numeric: true }))
}

/**
 * Checks whether an exit group matches the course preferred exit specification.
 */
export function isExitGroupMatchingPreferred(
  group: AvailableExitGroup,
  preferredExitId: string | string[] | undefined,
): boolean {
  if (!preferredExitId) return false
  const preferredIds = Array.isArray(preferredExitId) ? preferredExitId : [preferredExitId]
  return group.nodeIds.some((id) => preferredIds.includes(id))
}
