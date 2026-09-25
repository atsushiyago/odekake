import akabanebashiFixture from './oedo2026-akabanebashi-gtfs-pathways.json'
import { extractGtfsPathwaysStation, type GtfsPathwaysFeed } from '../adapters/gtfsPathwaysAdapter'

/** Shared test export backed by the current station fixture. */
export const akabanebashiGtfsPathways = extractGtfsPathwaysStation(akabanebashiFixture as GtfsPathwaysFeed, {
  id: '422',
  name: '赤羽橋'
})
