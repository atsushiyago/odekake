/** Provider-neutral domain model. API adapters map their payloads into these types. */
export type Confidence = 'verified' | 'needs-review' | 'unknown'

export interface StationRef { id: string; name: string; operator: string; line: string }
export interface TripLeg {
  id: string; from: StationRef; to: StationRef; service: string; platform: string
  direction: string; boardAt: string; alightAt: string
}
export interface Trip {
  id: string; serviceDate: string; leaveHomeAt: string; arriveBy: string
  originLabel: string; destinationLabel: string; legs: TripLeg[]; arrivalStation: StationRef
}
/** A semantic action's contiguous interval in one actual, directed traversal. */
export interface RouteActionSource {
  originNodeId: string
  exitNodeId: string
  firstRouteIndex: number
  lastRouteIndex: number
  semanticType: string
  traversals: Array<{ edgeId: string; fromNodeId: string; toNodeId: string }>
}

/** Optional evidence attached only to GTFS Pathways with an audited one-to-one walking link. */
export interface PathwayEnrichment {
  pathwayId: string
  verified: true
  walkingLinkId: string
  walkingDirection: number
  pathwayMode: number
  routeType: number
  fromStopId: string
  toStopId: string
  walkingFromNodeId: string
  walkingToNodeId: string
  fromWalkingFloor: number
  toWalkingFloor: number
  facilityKind?: 'elevator' | 'escalator'
  spaceId?: string
  facilityId?: string | null
  matchMethod?: 'contained' | 'intersection' | 'nearby' | 'unmatched'
  /** An elevator may have a distinct area on each served floor. */
  floorMatches?: Array<{ floor: number; spaceId?: string; facilityId: string | null; method: 'contained' | 'intersection' | 'nearby' | 'unmatched' }>
}

export interface GuideStep {
  id: string; instruction: string; facility?: 'stairs' | 'escalator' | 'elevator' | 'gate' | 'exit'
  evidence?: {
    source: 'gtfs-pathways' | 'manual-review'; sourceUrl: string; edgeIds?: string[]; fromNodeId?: string; toNodeId?: string
    /** Separate intervals per candidate; never a fabricated cross-candidate traversal. */
    routeOrder?: RouteActionSource[]
    /** Independent home instruction plus the proof delimiting GTFS detail. */
    homeGuidance?: {
      scope: 'platform-to-gate'
      sourceUrls: string[]
      levelConsensus?: { platformLevel: number; gateLevel: number; direction: 'up' | 'down'; candidateCount: number }
      rejoinSources: RouteActionSource[]
    }
    /** Number of precise GTFS boarding-area routes that contain this factual event. */
    candidateCoverage?: { matchingOrigins: number; totalOrigins: number; allRoutesHaveEvent?: boolean; aggregateCount?: number }
    /** Sum of the source pathway lengths represented by this semantic step. */
    distanceMeters?: number
    mapLocations?: Array<{ pathwayId: string; spaceId?: string; facilityId?: string; facilityGroupId?: string }>
    pathwayEnrichments?: PathwayEnrichment[]
    /** Source levels retained when multiple facility edges are shown as one action. */
    fromLevelIndex?: number; toLevelIndex?: number
    /** Official station-map floor resolved at the semantic layer (never inferred from a raw GTFS level). */
    officialFloor?: { label: string; levelIndex: number; sourceUrl: string }
    /** Safe, geometry-derived turn evidence. A missing value means no direction was printed. */
    direction?: {
      previousNodeId: string; currentNodeId: string; nextNodeId: string
      angleDegrees: number; result: 'left' | 'right' | 'straight'; reason: string
      /** Route positions used to derive a standalone post-gate movement. The adjacent route actions retain their own traversal provenance. */
      routeContext?: Array<{
        originNodeId: string; exitNodeId: string
        approachRouteIndex: number; gateRouteIndex: number; movementRouteIndex: number
      }>
    }
  }
}
export interface StationGuideSummary {
  stairsCount: number; escalatorCount: number; elevatorCount: number; fareGateCount: number
}
export interface GuideSection { id: string; title: string; steps: GuideStep[] }
/** Never populate this from generative text. Each guide must be evidence-backed. */
export interface StationGuide {
  id: string; station: StationRef; arrivalPlatform: string; gate: string; exit: string
  steps: GuideStep[]; officialSourceUrl: string; verifiedAt: string; confidence: Confidence
  verifiedBy?: string; safeAlternative: string; summary?: StationGuideSummary; sections?: GuideSection[]
  /** Data provenance is separate from human review. A GTFS guide is not human-reviewed by default. */
  dataSource?: {
    type: 'gtfs-pathways'; feedVersion: string; retrievedAt: string; humanReviewed: boolean
    scope: 'all-platform-origins-common-segment' | 'semantic-event-backbone' | 'reviewed-exact-origin'
  }
}
export interface WalkingRoute {
  id: string; from: { label: string; latitude?: number; longitude?: number }
  to: { label: string; latitude?: number; longitude?: number }; distanceMeters?: number
  baseMinutes: number; slowWalkingMultiplier: number; timeBasis?: 'official' | 'routing'
  sourceUrl?: string; verifiedAt: string; confidence: Confidence
  /** Kept separate from station GTFS provenance. No map geometry or turns are inferred. */
  dataSource?: { type: 'official-destination-access' | 'manual-review'; retrievedAt: string; humanReviewed: boolean }
  /** Explicit station-exit link; never matched by coordinate proximity. */
  stationExitConnection?: { stationId: string; exitNodeId: string; exitLabel: string }
  /** Optional fixed, provider-sourced line geometry for map rendering. */
  geometry?: {
    type: 'LineString'; coordinates: Array<[number, number]>
    source: { provider: string; endpoint: string; acquiredAt: string }
    distanceMeters?: number; durationSeconds?: number
  }
}
export interface PrintableGuide { trip: Trip; stationGuide: StationGuide; walkingRoute: WalkingRoute; contact: string }
