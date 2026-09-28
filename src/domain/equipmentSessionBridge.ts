import type { IndoorGraph, IndoorRoute } from './indoorRouting'

/** Source-qualified identities: IDs are never assumed to be globally unique. */
export interface GtfsDirectedTraversalRef {
  dataset: string
  version: string
  pathwayId: string
  fromNodeId: string
  toNodeId: string
}
export interface WalkingNetworkLinkRef { dataset: string; version: string; linkId: string }
export interface EquipmentFacilityRef { dataset: string; version: string; facilityId: string; equipmentType: 'stairs' | 'escalator' | 'elevator' }
export type BridgeEvidenceMethod = 'explicit-reference' | 'authoritative-crosswalk' | 'geometry-derived' | 'nearest' | 'inferred-group' | 'unknown'
export type BridgeEvidenceStrength = 'strong' | 'supporting' | 'insufficient'
export type BridgeEvidenceStatus = 'asserted' | 'ambiguous' | 'conflict'
export type TraversalLinkDirection = 'same' | 'reverse' | 'direction-independent'

interface RelationEvidence {
  relationId: string
  method: BridgeEvidenceMethod
  strength: BridgeEvidenceStrength
  status: BridgeEvidenceStatus
  provenance: string
  /** Orientation of the relationship, not a claim about vertical up/down. */
  direction: TraversalLinkDirection
}

export interface GtfsWalkingCrosswalk extends RelationEvidence {
  gtfs: GtfsDirectedTraversalRef
  walkingLink: WalkingNetworkLinkRef
  /** Reverse GTFS traversal is usable only when the source explicitly says bidirectional. */
  traversalCoverage: 'exact-directed' | 'bidirectional'
  meaning: 'same-traversal' | 'geometry-overlap' | 'proximity'
}

export interface WalkingFacilityRelation extends RelationEvidence {
  walkingLink: WalkingNetworkLinkRef
  facility: EquipmentFacilityRef
  meaning: 'member-of' | 'component-of' | 'traverses' | 'same-space' | 'near' | 'inferred-group'
}

export interface EquipmentSessionBridgeData {
  gtfsToWalking: readonly GtfsWalkingCrosswalk[]
  walkingToFacility: readonly WalkingFacilityRelation[]
}

export interface EquipmentSessionMappingChain {
  routeIndex: number
  gtfs: GtfsDirectedTraversalRef
  gtfsToWalkingRelation: GtfsWalkingCrosswalk
  walkingLink: WalkingNetworkLinkRef
  walkingToFacilityRelation: WalkingFacilityRelation
  facility: EquipmentFacilityRef
  /** Strong authoritative evidence can coexist with weaker conflicting suggestions. */
  weakConflicts: Array<{ relationId: string; side: 'gtfs-to-walking' | 'walking-to-facility'; entityId: string; method: BridgeEvidenceMethod; provenance: string }>
}

export type BridgeTraversalStatus = 'confirmed-chain' | 'missing-gtfs-walking-relation' | 'ambiguous-walking-mapping'
  | 'missing-walking-facility-relation' | 'ambiguous-facility-mapping' | 'conflicting-strong-evidence' | 'weak-only-evidence'

export interface BridgeTraversalResolution {
  routeIndex: number
  pathwayId: string
  fromNodeId: string
  toNodeId: string
  status: BridgeTraversalStatus
  chain?: EquipmentSessionMappingChain
  relationIds: string[]
  reason: string
}

export interface EquipmentSessionBridgeResolution {
  traversals: BridgeTraversalResolution[]
  /** Traversal-index keyed deliberately: Pathway ID alone is not directed identity. */
  mappingsByRouteIndex: Record<number, { facilityId: string; facilityMapping: { method: 'direct'; identityStrength: 'strong'; sourceUrl: string } }>
}

const strongMethods = new Set<BridgeEvidenceMethod>(['explicit-reference', 'authoritative-crosswalk'])
const strongFacilityMeanings = new Set<WalkingFacilityRelation['meaning']>(['member-of', 'component-of', 'traverses'])

function sameSource(a: { dataset: string; version: string }, b: { dataset: string; version: string }) {
  return a.dataset === b.dataset && a.version === b.version
}
function qualifiesStrong(evidence: RelationEvidence) {
  return evidence.strength === 'strong' && evidence.status === 'asserted' && strongMethods.has(evidence.method) && Boolean(evidence.provenance.trim())
}
function isStrongSourceClaim(evidence: RelationEvidence) {
  return evidence.strength === 'strong' && strongMethods.has(evidence.method) && Boolean(evidence.provenance.trim())
}
function matchesTraversal(relation: GtfsWalkingCrosswalk, gtfsDataset: string, gtfsVersion: string,
  pathwayId: string, fromNodeId: string, toNodeId: string): boolean {
  if (!sameSource(relation.gtfs, { dataset: gtfsDataset, version: gtfsVersion }) || relation.gtfs.pathwayId !== pathwayId) return false
  const forward = relation.gtfs.fromNodeId === fromNodeId && relation.gtfs.toNodeId === toNodeId
  if (forward) return true
  const reverse = relation.gtfs.fromNodeId === toNodeId && relation.gtfs.toNodeId === fromNodeId
  return reverse && relation.traversalCoverage === 'bidirectional'
}

/**
 * Resolves explicit source-backed crosswalks for a single ordered GTFS route.
 * Geometry, nearest matches, Facility groups, and type similarity are retained
 * as weak diagnostics but can never create a strong link in this resolver.
 */
export function resolveEquipmentSessionBridge(input: {
  graph: IndoorGraph
  route: IndoorRoute
  data: EquipmentSessionBridgeData
}): EquipmentSessionBridgeResolution {
  const { graph, route, data } = input
  const traversals: BridgeTraversalResolution[] = []
  const mappingsByRouteIndex: EquipmentSessionBridgeResolution['mappingsByRouteIndex'] = {}

  route.edges.forEach((edge, routeIndex) => {
    if (edge.sourceType !== 'gtfs-pathways') {
      traversals.push({ routeIndex, pathwayId: edge.id, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId,
        relationIds: [], status: 'missing-gtfs-walking-relation', reason: 'Bridge source applies only to GTFS-Pathways traversals' })
      return
    }
    const gtfsMatches = data.gtfsToWalking.filter(relation => matchesTraversal(relation, graph.source.name, graph.source.feedVersion,
      edge.id, edge.fromNodeId, edge.toNodeId))
    const candidateIds = gtfsMatches.map(item => item.walkingLink.linkId)
    const sourceIds = gtfsMatches.map(item => item.relationId)
    const base = { routeIndex, pathwayId: edge.id, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId, relationIds: sourceIds }
    const strongGtfs = gtfsMatches.filter(relation => qualifiesStrong(relation) && relation.meaning === 'same-traversal')
    const uniqueLinks = [...new Set(strongGtfs.map(relation => JSON.stringify(relation.walkingLink)))].map(value => JSON.parse(value) as WalkingNetworkLinkRef)
    if (gtfsMatches.some(relation => relation.status === 'conflict' && isStrongSourceClaim(relation))) {
      traversals.push({ ...base, status: 'conflicting-strong-evidence', reason: 'Conflicting strong GTFS-to-walking relations are retained; none is selected' })
      return
    }
    if (uniqueLinks.length > 1 || gtfsMatches.some(relation => relation.status === 'ambiguous' || relation.status === 'conflict')) {
      traversals.push({ ...base, status: 'ambiguous-walking-mapping', reason: 'More than one walking-link candidate or the source marks the mapping ambiguous' })
      return
    }
    if (uniqueLinks.length === 0) {
      const weak = gtfsMatches.length > 0
      traversals.push({ ...base, status: weak ? 'weak-only-evidence' : 'missing-gtfs-walking-relation',
        reason: weak ? 'GTFS-to-walking evidence is not an asserted strong same-traversal relation' : 'No source-qualified GTFS-to-walking relation' })
      return
    }
    const walkingLink = uniqueLinks[0]
    const facilityMatches = data.walkingToFacility.filter(relation => sameSource(relation.walkingLink, walkingLink)
      && relation.walkingLink.linkId === walkingLink.linkId)
    const strongFacilities = facilityMatches.filter(relation => qualifiesStrong(relation) && strongFacilityMeanings.has(relation.meaning))
    const uniqueFacilities = [...new Set(strongFacilities.map(relation => JSON.stringify(relation.facility)))].map(value => JSON.parse(value) as EquipmentFacilityRef)
    const allRelationIds = [...sourceIds, ...facilityMatches.map(item => item.relationId)]
    if (facilityMatches.some(relation => relation.status === 'conflict' && isStrongSourceClaim(relation)) || uniqueFacilities.length > 1) {
      traversals.push({ ...base, relationIds: allRelationIds, status: 'conflicting-strong-evidence', reason: 'Conflicting strong Facility relations are retained; none is selected' })
      return
    }
    if (uniqueFacilities.length > 1 || facilityMatches.some(relation => relation.status === 'ambiguous' || relation.status === 'conflict')) {
      traversals.push({ ...base, relationIds: allRelationIds, status: 'ambiguous-facility-mapping', reason: 'More than one Facility candidate or the source marks the mapping ambiguous' })
      return
    }
    if (uniqueFacilities.length === 0) {
      const weak = facilityMatches.length > 0
      traversals.push({ ...base, relationIds: allRelationIds, status: weak ? 'weak-only-evidence' : 'missing-walking-facility-relation',
        reason: weak ? 'Walking-link-to-Facility evidence is not an asserted strong equipment-membership relation' : 'No source-qualified walking-link-to-Facility relation' })
      return
    }
    const facility = uniqueFacilities[0]
    if (edge.movementType !== 'walk' && facility.equipmentType !== edge.movementType) {
      traversals.push({ ...base, relationIds: allRelationIds, status: 'conflicting-strong-evidence',
        reason: 'The strongly related Facility equipment type conflicts with the GTFS traversal semantic type' })
      return
    }
    const gtfsRelation = strongGtfs.find(relation => JSON.stringify(relation.walkingLink) === JSON.stringify(walkingLink))!
    const facilityRelation = strongFacilities.find(relation => JSON.stringify(relation.facility) === JSON.stringify(facility))!
    const weakConflicts = [
      ...gtfsMatches.filter(relation => !qualifiesStrong(relation) && JSON.stringify(relation.walkingLink) !== JSON.stringify(walkingLink))
        .map(relation => ({ relationId: relation.relationId, side: 'gtfs-to-walking' as const, entityId: relation.walkingLink.linkId, method: relation.method, provenance: relation.provenance })),
      ...facilityMatches.filter(relation => !qualifiesStrong(relation) && relation.facility.facilityId !== facility.facilityId)
        .map(relation => ({ relationId: relation.relationId, side: 'walking-to-facility' as const, entityId: relation.facility.facilityId, method: relation.method, provenance: relation.provenance })),
    ]
    const chain: EquipmentSessionMappingChain = { routeIndex, gtfs: gtfsRelation.gtfs, gtfsToWalkingRelation: gtfsRelation,
      walkingLink, walkingToFacilityRelation: facilityRelation, facility, weakConflicts }
    traversals.push({ ...base, relationIds: allRelationIds, status: 'confirmed-chain', chain,
      reason: weakConflicts.length ? 'Strong explicit chain resolved; weaker conflicting suggestions retained' : 'Unique strong explicit chain resolved' })
    mappingsByRouteIndex[routeIndex] = { facilityId: facility.facilityId,
      // Keep the proof-builder namespace stable across relation records; relation-level provenance remains in `chain`.
      facilityMapping: { method: 'direct', identityStrength: 'strong', sourceUrl: JSON.stringify([
        [gtfsRelation.gtfs.dataset, gtfsRelation.gtfs.version], [walkingLink.dataset, walkingLink.version], [facility.dataset, facility.version],
      ]) } }
  })
  return { traversals, mappingsByRouteIndex }
}
