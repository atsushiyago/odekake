import type {
  OfficialGuidance,
  OfficialTravelDirection,
} from '../data/stationOfficialGuidance'

export interface OfficialHomeGuidancePresentation {
  carPositionLabel?: string
  carPositionHint?: string
  homeInstruction?: string
  sourceUrl?: string
}

const equipmentLabels = {
  elevator: 'エレベーター',
  escalator: 'エスカレーター',
  stairs: '階段',
} as const

function formatCarPositions(positions: string[]): string | undefined {
  const normalized = [...new Set(positions.map(position => position.trim()).filter(Boolean))]
  if (!normalized.length) return undefined
  const hasNearSuffix = normalized.some(position => position.endsWith('付近'))
  const labels = normalized.map(position => position.replace(/付近$/, ''))
  return `${labels.join('・')}${hasNearSuffix ? '付近' : ''}`
}

/**
 * Resolves only platform-to-gate official claims. No station, pathway, or
 * Facility identifier participates in this presentation decision.
 */
export function presentOfficialHomeGuidance(
  officialGuidance: OfficialGuidance[],
  consensusDirection?: OfficialTravelDirection | null,
): OfficialHomeGuidancePresentation {
  const homeGuidance = officialGuidance.filter(item => item.scope === 'platform-to-gate')
  const carPositionLabel = formatCarPositions(homeGuidance.flatMap(item => item.carPositions ?? []))
  const equipments = [...new Set(homeGuidance.flatMap(item => item.equipment ? [item.equipment] : []))]
  const explicitDirections = [...new Set(homeGuidance.flatMap(item => item.direction ? [item.direction] : []))]
  const directionConflict = explicitDirections.length > 1
  const direction = directionConflict
    ? undefined
    : explicitDirections[0] ?? consensusDirection ?? undefined
  const equipment = equipments.length === 1 ? equipments[0] : undefined
  const equipmentLabel = equipment ? equipmentLabels[equipment] : undefined
  const verb = direction === 'up' ? '上がる' : direction === 'down' ? '下りる' : undefined

  let homeInstruction: string | undefined
  if (equipmentLabel && verb) homeInstruction = `${equipmentLabel}で改札階へ${verb}`
  else if (equipmentLabel) homeInstruction = `${equipmentLabel}を使う`
  else if (verb) homeInstruction = `ホームから改札階へ${verb}`

  const sourceUrls = [...new Set(homeGuidance.map(item => item.source.url).filter(Boolean))]
  return {
    carPositionLabel,
    carPositionHint: carPositionLabel ? `できれば${carPositionLabel}に乗る` : undefined,
    homeInstruction,
    sourceUrl: sourceUrls.length === 1 ? sourceUrls[0] : undefined,
  }
}
