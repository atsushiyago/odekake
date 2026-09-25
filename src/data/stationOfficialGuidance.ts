export type OfficialGuidanceScope = 'platform-to-gate' | 'gate-to-exit'
export type OfficialEquipment = 'elevator' | 'escalator' | 'stairs'
export type OfficialTravelDirection = 'up' | 'down'

export interface OfficialGuidanceSource {
  url: string
}

/** A source-backed instruction about one user-visible part of the station journey. */
export interface OfficialGuidance {
  scope: OfficialGuidanceScope
  /** Human-facing car labels; these are not GTFS boarding-area identifiers. */
  carPositions?: string[]
  equipment?: OfficialEquipment
  /** Null means the source does not state a direction. */
  direction?: OfficialTravelDirection | null
  source: OfficialGuidanceSource
}

export interface StationOfficialGuidance {
  officialGuidance: OfficialGuidance[]
  targetGate: string
  gateFloor?: { label: string; levelIndex: number; sourceUrl: string }
  /** Presentation boundary only; the common fare-gate point remains data-derived. */
  preGatePresentation?: 'retain-gtfs-details' | 'safe-rejoin'
  /** Some independent guidance is shown only when the GTFS level transition is unanimous. */
  requiresLevelConsensus?: boolean
}

const accessibilityPdf = 'https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf'

/**
 * Official guidance is scoped by the user journey, not by GTFS IDs.
 * Car-position hints and equipment instructions render independently, even
 * when listed together in the same source record.
 */
export const stationOfficialGuidanceByStationId: Record<string, StationOfficialGuidance> = {
  '421': {
    targetGate: 'B2出口方面',
    preGatePresentation: 'safe-rejoin',
    officialGuidance: [{ scope: 'platform-to-gate', carPositions: ['5号車付近'], equipment: 'elevator', direction: null, source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/daimon.html' } }],
    gateFloor: { label: '地下3階', levelIndex: -3, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/stations/daimon.html' },
  },
  '422': {
    targetGate: '赤羽橋口方面',
    preGatePresentation: 'safe-rejoin',
    officialGuidance: [{ scope: 'platform-to-gate', carPositions: ['4号車付近'], equipment: 'elevator', direction: null, source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/akabanebashi.html' } }],
  },
  '425': {
    targetGate: '1出口方面',
    preGatePresentation: 'safe-rejoin',
    officialGuidance: [{ scope: 'platform-to-gate', carPositions: ['3号車付近', '6号車付近'], equipment: 'escalator', direction: null, source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/aoyama-itchome.html' } }],
  },
  '428': {
    targetGate: 'A1出口方面',
    preGatePresentation: 'safe-rejoin',
    officialGuidance: [
      { scope: 'platform-to-gate', carPositions: ['1号車付近'], equipment: 'elevator', direction: null, source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku.html' } },
      { scope: 'gate-to-exit', equipment: 'escalator', direction: null, source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku.html' } },
    ],
    gateFloor: { label: '地下3階', levelIndex: -2, sourceUrl: 'https://www.kotsu.metro.tokyo.jp/subway/kanren/inspection/pdf/inspection202509_04.pdf' },
  },
  '402': {
    targetGate: 'D3出口方面',
    preGatePresentation: 'safe-rejoin',
    requiresLevelConsensus: true,
    officialGuidance: [{ scope: 'platform-to-gate', carPositions: ['7号車付近'], equipment: 'escalator', direction: null, source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/shinjuku-nishiguchi.html' } }],
  },
  '410': {
    targetGate: 'A7出口方面',
    preGatePresentation: 'safe-rejoin',
    requiresLevelConsensus: true,
    officialGuidance: [{ scope: 'platform-to-gate', carPositions: ['6号車付近'], equipment: 'escalator', direction: null, source: { url: 'https://www.kotsu.metro.tokyo.jp/subway/stations/ueno-okachimachi.html' } }],
  },
  '423': {
    targetGate: '改札',
    preGatePresentation: 'safe-rejoin',
    requiresLevelConsensus: true,
    officialGuidance: [{ scope: 'platform-to-gate', carPositions: ['4号車付近'], equipment: 'elevator', direction: null, source: { url: accessibilityPdf } }],
  },
  '427': {
    targetGate: '改札',
    preGatePresentation: 'safe-rejoin',
    requiresLevelConsensus: true,
    officialGuidance: [{ scope: 'platform-to-gate', carPositions: ['5号車付近'], equipment: 'elevator', direction: null, source: { url: accessibilityPdf } }],
  },
  '403': {
    targetGate: '改札',
    preGatePresentation: 'safe-rejoin',
    requiresLevelConsensus: true,
    officialGuidance: [{ scope: 'platform-to-gate', carPositions: ['5号車付近'], equipment: 'elevator', direction: null, source: { url: accessibilityPdf } }],
  },
  '429': {
    targetGate: '改札',
    preGatePresentation: 'safe-rejoin',
    requiresLevelConsensus: true,
    officialGuidance: [{ scope: 'platform-to-gate', carPositions: ['4号車付近'], equipment: 'elevator', direction: null, source: { url: accessibilityPdf } }],
  },
  '426': {
    targetGate: '国立競技場方面改札',
    preGatePresentation: 'retain-gtfs-details',
    officialGuidance: [{ scope: 'platform-to-gate', carPositions: ['4号車付近'], equipment: 'elevator', direction: null, source: { url: accessibilityPdf } }],
  },
  '424': {
    targetGate: '東京ミッドタウン方面改札',
    preGatePresentation: 'safe-rejoin',
    requiresLevelConsensus: true,
    officialGuidance: [
      { scope: 'platform-to-gate', carPositions: ['8号車付近'], equipment: 'elevator', direction: null, source: { url: accessibilityPdf } },
      { scope: 'gate-to-exit', equipment: 'escalator', direction: null, source: { url: accessibilityPdf } },
    ],
  },
}
