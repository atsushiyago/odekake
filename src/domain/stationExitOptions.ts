import type { IndoorGraph } from './indoorRouting'
import { formatExitLabel } from './paperLabels'

export interface AvailableExitGroup {
  label: string
  rawName: string
  nodeIds: string[]
}

/**
 * Extracts and groups all entrance-exit nodes in a station graph by their formatted exit label.
 * Multiple nodes sharing the same exit name (e.g. separate stairs vs elevator nodes for the same exit)
 * are consolidated into a single group.
 */
export function getStationExitGroups(graph: IndoorGraph): AvailableExitGroup[] {
  const exits = [...graph.nodes.values()].filter((node) => node.kind === 'entrance-exit')
  const groupMap = new Map<string, { rawName: string; nodeIds: string[] }>()

  for (const node of exits) {
    const rawName = (node.name ?? '').trim() || node.id
    const label = formatExitLabel(rawName)
    const existing = groupMap.get(label)
    if (existing) {
      if (!existing.nodeIds.includes(node.id)) {
        existing.nodeIds.push(node.id)
      }
    } else {
      groupMap.set(label, { rawName, nodeIds: [node.id] })
    }
  }

  return [...groupMap.entries()]
    .map(([label, info]) => ({
      label,
      rawName: info.rawName,
      nodeIds: info.nodeIds,
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
