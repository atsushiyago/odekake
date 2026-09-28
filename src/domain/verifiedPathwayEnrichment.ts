import type { IndoorGraph } from './indoorRouting'
import type { PathwayEnrichment, StationGuide } from './types'

/** Adds sidecar evidence only. GTFS routing, semantic grouping and wording are untouched. */
export function withVerifiedPathwayEnrichment(
  guide: StationGuide,
  graph: IndoorGraph,
  byPathwayId: ReadonlyMap<string, PathwayEnrichment>,
): StationGuide {
  if (!byPathwayId.size) return guide
  const gtfsEdgeIds = new Set(graph.edges.filter(edge => edge.sourceType === 'gtfs-pathways').map(edge => edge.id))
  let changed = false
  const steps = guide.steps.map(step => {
    // Exit labels may cite the preceding edge for provenance, but do not
    // represent a second traversal of that Pathway.
    if (step.facility === 'exit' || step.evidence?.source !== 'gtfs-pathways') return step
    const enrichments = [...new Set(step.evidence.edgeIds ?? [])]
      .filter(id => gtfsEdgeIds.has(id))
      .flatMap(id => { const item = byPathwayId.get(id); return item ? [item] : [] })
    if (!enrichments.length) return step
    changed = true
    return { ...step, evidence: { ...step.evidence, pathwayEnrichments: enrichments } }
  })
  return changed ? { ...guide, steps } : guide
}
