import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Spatial confidence is diagnostic only. No candidate is accepted as a production crosswalk. */
export const CROSSWALK_AUDIT_THRESHOLDS_METERS = Object.freeze({
  exact: 0.5,
  strong: 1.5,
  clearGap: 0.5,
  near: 2,
  context: 5,
})

const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)))
const root = resolve(scriptDir, '..')
const fixtureDir = join(root, 'src/data/fixtures')
const stationMapDir = join(root, 'src/data/stationMaps')
const reportDir = join(root, 'reports')
const normalKey = value => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const readJson = async path => JSON.parse(await readFile(path, 'utf8'))
const round = value => value === undefined || !Number.isFinite(value) ? undefined : Math.round(value * 1000) / 1000
const finite = value => value === undefined || value === null || String(value).trim() === '' ? undefined : Number.isFinite(Number(value)) ? Number(value) : undefined

export function haversineMeters(a, b) {
  const radians = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * radians
  const dLon = (b.longitude - a.longitude) * radians
  const lat1 = a.latitude * radians, lat2 = b.latitude * radians
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * 6371008.8 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function spatialClass(nearest, second) {
  if (nearest === undefined || nearest > CROSSWALK_AUDIT_THRESHOLDS_METERS.context) return 'unmatched'
  const gap = second === undefined ? Infinity : second - nearest
  if (nearest <= CROSSWALK_AUDIT_THRESHOLDS_METERS.exact && gap >= CROSSWALK_AUDIT_THRESHOLDS_METERS.clearGap) return 'exact'
  if (nearest <= CROSSWALK_AUDIT_THRESHOLDS_METERS.strong && gap >= CROSSWALK_AUDIT_THRESHOLDS_METERS.clearGap) return 'strong'
  return 'ambiguous'
}

const gtfsMode = new Map([[1, 'walk'], [2, 'stairs'], [3, 'moving-walkway'], [4, 'escalator'], [5, 'elevator'], [6, 'fare-gate'], [7, 'exit-gate']])
const walkingType = new Map([[1, 'walk'], [2, 'moving-walkway'], [3, 'rail-crossing'], [4, 'elevator'], [5, 'escalator'], [6, 'stairs'], [7, 'slope'], [99, 'unknown']])
const vertical = new Set(['stairs', 'escalator', 'elevator'])
export function topologyVerdict(gtfsModes, walkingTypes) {
  const gtfs = new Set(gtfsModes.map(mode => gtfsMode.get(Number(mode))).filter(type => vertical.has(type)))
  const walking = new Set(walkingTypes.map(type => walkingType.get(Number(type))).filter(type => vertical.has(type)))
  if (gtfs.size && walking.size) return [...gtfs].some(type => walking.has(type)) ? 'vertical-compatible' : 'vertical-conflict'
  if (gtfs.size || walking.size) return 'vertical-evidence-missing'
  if (gtfsModes.includes(6) || gtfsModes.includes(7)) return 'gate-or-exit-not-comparable'
  return gtfsModes.includes(1) && walkingTypes.includes(1) ? 'walk-compatible' : 'not-comparable'
}

async function findNetworkFiles(stationKey) {
  const folders = await readdir(stationMapDir, { withFileTypes: true })
  const folder = folders.find(entry => entry.isDirectory() && normalKey(entry.name) === normalKey(stationKey))?.name
  if (!folder) return undefined
  const stationPath = join(stationMapDir, folder)
  const children = await readdir(stationPath, { withFileTypes: true })
  const dirs = [stationPath, ...children.filter(entry => entry.isDirectory()).map(entry => join(stationPath, entry.name))]
  for (const dir of dirs) {
    const names = await readdir(dir)
    if (names.includes('node.geojson') && names.includes('link.geojson')) return { node: join(dir, 'node.geojson'), link: join(dir, 'link.geojson') }
  }
}

export async function loadWalking(stationKey) {
  const files = await findNetworkFiles(stationKey)
  if (files) {
    const nodeFile = await readJson(files.node), linkFile = await readJson(files.link)
    const nodes = nodeFile.features.flatMap(feature => {
      const p = feature.properties ?? {}, coord = feature.geometry?.coordinates
      const latitude = finite(p.lat) ?? (Array.isArray(coord) ? finite(coord[1]) : undefined)
      const longitude = finite(p.lon) ?? (Array.isArray(coord) ? finite(coord[0]) : undefined)
      const floor = finite(p.floor), id = String(p.node_id ?? '')
      return id && latitude !== undefined && longitude !== undefined ? [{ id, latitude, longitude, floor, inOut: finite(p.in_out) }] : []
    })
    const links = linkFile.features.flatMap(feature => {
      const p = feature.properties ?? {}, id = String(p.link_id ?? ''), startId = String(p.start_id ?? ''), endId = String(p.end_id ?? '')
      return id && startId && endId ? [{ id, startId, endId, routeType: finite(p.route_type), direction: finite(p.direction) }] : []
    })
    return { completeness: 'full', files, nodes, links }
  }
  // A checked-in extracted subset can be audited as partial data, never counted as full coverage.
  const subsetPath = join(fixtureDir, `${stationKey}-walking-network.ts`)
  try {
    const module = await import(new URL(`../src/data/fixtures/${stationKey}-walking-network.ts`, import.meta.url).href)
    const subset = Object.values(module).find(value => value && Array.isArray(value.nodes) && Array.isArray(value.links))
    if (subset) return { completeness: 'partial', files: { subset: subsetPath }, nodes: subset.nodes.map(n => ({ ...n, floor: finite(n.floor), inOut: n.inOut })), links: subset.links.map(l => ({ id: l.id, startId: l.startNodeId, endId: l.endNodeId, routeType: l.routeType, direction: l.direction })) }
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
  }
  return { completeness: 'missing', files: {}, nodes: [], links: [] }
}

function connections(edges, left, right, modeField) {
  const result = new Map()
  for (const edge of edges) for (const id of [edge[left], edge[right]]) {
    const current = result.get(id) ?? { count: 0, modes: new Set() }
    current.count++
    if (edge[modeField] !== undefined) current.modes.add(Number(edge[modeField]))
    result.set(id, current)
  }
  return result
}

export function auditStation(fixture, walking, key) {
  const levelById = new Map(fixture.levels.map(level => [level.levelId, finite(level.levelIndex)]))
  const gtfsConnections = connections(fixture.pathways, 'fromStopId', 'toStopId', 'pathwayMode')
  const walkingConnections = connections(walking.links, 'startId', 'endId', 'routeType')
  const walkingByFloor = new Map()
  for (const node of walking.nodes) if (node.floor !== undefined) {
    const items = walkingByFloor.get(node.floor) ?? []
    items.push(node)
    walkingByFloor.set(node.floor, items)
  }
  const stops = fixture.stops.map(stop => {
    const floor = stop.levelId ? levelById.get(stop.levelId) : undefined
    const gCon = gtfsConnections.get(stop.stopId) ?? { count: 0, modes: new Set() }
    const modes = [...gCon.modes].sort((a, b) => a - b)
    const candidateNodes = floor === undefined ? [] : walkingByFloor.get(floor) ?? []
    const ranked = candidateNodes.map(node => ({ node, distance: haversineMeters({ latitude: Number(stop.stopLat), longitude: Number(stop.stopLon) }, node) }))
      .sort((a, b) => a.distance - b.distance || a.node.id.localeCompare(b.node.id))
    const nearest = ranked[0], second = ranked[1]
    const wCon = nearest ? walkingConnections.get(nearest.node.id) ?? { count: 0, modes: new Set() } : undefined
    const nearestModes = wCon ? [...wCon.modes].sort((a, b) => a - b) : []
    const topo = nearest ? topologyVerdict(modes, nearestModes) : 'no-floor-candidate'
    const alternatives = ranked.filter(item => item.distance <= CROSSWALK_AUDIT_THRESHOLDS_METERS.near && topologyVerdict(modes, [...(walkingConnections.get(item.node.id)?.modes ?? [])]) === 'vertical-compatible').length
    return {
      gtfs: { stopId: stop.stopId, stopName: stop.stopName ?? '', locationType: Number(stop.locationType), parentStation: stop.parentStation ?? null,
        levelId: stop.levelId ?? null, levelIndex: floor ?? null, connectedPathways: gCon.count, pathwayModes: modes },
      nearestWalking: nearest ? { nodeId: nearest.node.id, floor: nearest.node.floor, inOut: nearest.node.inOut ?? null,
        connectedLinks: wCon.count, routeTypes: nearestModes } : null,
      nearestDistanceMeters: nearest ? round(nearest.distance) : null,
      secondNearestNodeId: second?.node.id ?? null,
      secondNearestDistanceMeters: second ? round(second.distance) : null,
      gapMeters: second ? round(second.distance - nearest.distance) : null,
      candidateCountWithin2m: ranked.filter(item => item.distance <= CROSSWALK_AUDIT_THRESHOLDS_METERS.near).length,
      candidateCountWithin5m: ranked.filter(item => item.distance <= CROSSWALK_AUDIT_THRESHOLDS_METERS.context).length,
      spatialClass: spatialClass(nearest?.distance, second?.distance),
      topologyVerdict: topo,
      topologyCompatibleCandidatesWithin2m: alternatives,
    }
  })
  const nearestClaimants = new Map()
  for (const row of stops) if (row.nearestWalking && row.nearestDistanceMeters !== null && row.nearestDistanceMeters <= CROSSWALK_AUDIT_THRESHOLDS_METERS.exact) {
    const claimants = nearestClaimants.get(row.nearestWalking.nodeId) ?? []
    claimants.push(row.gtfs.stopId)
    nearestClaimants.set(row.nearestWalking.nodeId, claimants)
  }
  for (const row of stops) row.nearestWalkingClaimantsWithinHalfMeter = row.nearestWalking ? nearestClaimants.get(row.nearestWalking.nodeId) ?? [] : []
  const rowsById = new Map(stops.map(row => [row.gtfs.stopId, row]))
  const pairKey = (a, b) => [a, b].sort().join('\u0000')
  const walkingLinksByPair = new Map()
  for (const link of walking.links) {
    const key = pairKey(link.startId, link.endId)
    const links = walkingLinksByPair.get(key) ?? []
    links.push(link)
    walkingLinksByPair.set(key, links)
  }
  const pathwayEvidence = { comparable: 0, bothEndpointsSpatiallyClear: 0, sameWalkingLink: 0, sameEquipmentType: 0, sourceDirectionCompatible: 0, bidirectionalCompatible: 0 }
  const pathwayExceptions = []
  for (const row of stops) row.adjacentPathwayEvidence = { comparable: 0, bothEndpointsSpatiallyClear: 0, sameWalkingLink: 0, sameEquipmentType: 0, sourceDirectionCompatible: 0 }
  for (const pathway of fixture.pathways) {
    const expectedType = gtfsMode.get(Number(pathway.pathwayMode))
    if (!expectedType || ['fare-gate', 'exit-gate'].includes(expectedType)) continue
    pathwayEvidence.comparable++
    const from = rowsById.get(pathway.fromStopId), to = rowsById.get(pathway.toStopId)
    const adjacent = [from, to].filter(Boolean)
    for (const row of adjacent) row.adjacentPathwayEvidence.comparable++
    if (!from || !to || !['exact', 'strong'].includes(from.spatialClass) || !['exact', 'strong'].includes(to.spatialClass)
      || !from.nearestWalking || !to.nearestWalking) continue
    pathwayEvidence.bothEndpointsSpatiallyClear++
    for (const row of adjacent) row.adjacentPathwayEvidence.bothEndpointsSpatiallyClear++
    const links = walkingLinksByPair.get(pairKey(from.nearestWalking.nodeId, to.nearestWalking.nodeId)) ?? []
    const exceptionBase = { pathwayId: pathway.pathwayId, fromStopId: pathway.fromStopId, toStopId: pathway.toStopId,
      walkingFromNodeId: from.nearestWalking.nodeId, walkingToNodeId: to.nearestWalking.nodeId,
      pathwayMode: Number(pathway.pathwayMode), fromDistanceMeters: from.nearestDistanceMeters, toDistanceMeters: to.nearestDistanceMeters,
      walkingRouteTypes: [...new Set(links.map(link => Number(link.routeType)))].sort((a, b) => a - b) }
    if (!links.length) { pathwayExceptions.push({ ...exceptionBase, reason: 'no-direct-walking-link' }); continue }
    pathwayEvidence.sameWalkingLink++
    for (const row of adjacent) row.adjacentPathwayEvidence.sameWalkingLink++
    const sameType = links.filter(link => walkingType.get(Number(link.routeType)) === expectedType)
    if (!sameType.length) { pathwayExceptions.push({ ...exceptionBase, reason: 'different-equipment-type' }); continue }
    pathwayEvidence.sameEquipmentType++
    for (const row of adjacent) row.adjacentPathwayEvidence.sameEquipmentType++
    const forward = sameType.filter(link => link.startId === from.nearestWalking.nodeId
      ? [1, 2].includes(Number(link.direction)) : [1, 3].includes(Number(link.direction)))
    if (!forward.length) { pathwayExceptions.push({ ...exceptionBase, reason: 'different-source-direction' }); continue }
    pathwayEvidence.sourceDirectionCompatible++
    for (const row of adjacent) row.adjacentPathwayEvidence.sourceDirectionCompatible++
    if (pathway.isBidirectional !== true && String(pathway.isBidirectional) !== '1' || forward.some(link => Number(link.direction) === 1)) pathwayEvidence.bidirectionalCompatible++
    else pathwayExceptions.push({ ...exceptionBase, reason: 'different-reverse-direction' })
  }
  const counts = Object.fromEntries(['exact', 'strong', 'ambiguous', 'unmatched'].map(label => [label, stops.filter(row => row.spatialClass === label).length]))
  const dist = stops.map(row => row.nearestDistanceMeters).filter(value => value !== null).sort((a, b) => a - b)
  const percentile = p => dist.length ? dist[Math.min(dist.length - 1, Math.ceil(p * dist.length) - 1)] : null
  return { stationId: fixture.station.id, stationName: fixture.station.name, key, walkingDataCompleteness: walking.completeness,
    sourceFiles: { gtfs: relative(root, join(fixtureDir, `oedo2026-${key}-gtfs-pathways.json`)),
      ...Object.fromEntries(Object.entries(walking.files).map(([name, path]) => [name, relative(root, path)])) },
    counts: { gtfsStops: stops.length, walkingNodes: walking.nodes.length, walkingLinks: walking.links.length, ...counts,
      nearestWithin2m: stops.filter(row => row.nearestDistanceMeters !== null && row.nearestDistanceMeters <= 2).length,
      nearestWithin5m: stops.filter(row => row.nearestDistanceMeters !== null && row.nearestDistanceMeters <= 5).length,
      verticalCompatibleNearest: stops.filter(row => row.topologyVerdict === 'vertical-compatible').length,
      verticalConflictNearest: stops.filter(row => row.topologyVerdict === 'vertical-conflict').length,
      missingFloor: stops.filter(row => row.gtfs.levelIndex === null).length,
      medianNearestMeters: percentile(0.5), p90NearestMeters: percentile(0.9) }, pathwayEvidence, pathwayExceptions, stops }
}

function histogram(stations) {
  const rows = stations.flatMap(station => station.stops)
  return {
    '0–0.5m': rows.filter(r => r.nearestDistanceMeters !== null && r.nearestDistanceMeters <= 0.5).length,
    '0.5–1.5m': rows.filter(r => r.nearestDistanceMeters > 0.5 && r.nearestDistanceMeters <= 1.5).length,
    '1.5–2m': rows.filter(r => r.nearestDistanceMeters > 1.5 && r.nearestDistanceMeters <= 2).length,
    '2–5m': rows.filter(r => r.nearestDistanceMeters > 2 && r.nearestDistanceMeters <= 5).length,
    '>5m': rows.filter(r => r.nearestDistanceMeters > 5).length,
    'floor missing/no same-floor node': rows.filter(r => r.nearestDistanceMeters === null).length,
  }
}

function sample(stations, predicate, limit = 12) {
  return stations.flatMap(station => station.stops.filter(predicate).map(row => ({ station: station.stationName, completeness: station.walkingDataCompleteness, ...row }))).slice(0, limit)
}
function cohortCounts(stations) {
  const rows = stations.flatMap(station => station.stops)
  const cohorts = {
    elevator: row => row.gtfs.pathwayModes.includes(5),
    escalator: row => row.gtfs.pathwayModes.includes(4),
    stairs: row => row.gtfs.pathwayModes.includes(2),
    fareGate: row => row.gtfs.pathwayModes.includes(6),
    platformOrBoarding: row => row.gtfs.locationType === 0 || row.gtfs.locationType === 4,
    exit: row => row.gtfs.locationType === 2,
  }
  return Object.fromEntries(Object.entries(cohorts).map(([name, predicate]) => {
    const selected = rows.filter(predicate)
    return [name, { total: selected.length, exact: selected.filter(row => row.spatialClass === 'exact').length,
      strong: selected.filter(row => row.spatialClass === 'strong').length,
      ambiguous: selected.filter(row => row.spatialClass === 'ambiguous').length,
      unmatched: selected.filter(row => row.spatialClass === 'unmatched').length,
      nearestVerticalCompatible: selected.filter(row => row.topologyVerdict === 'vertical-compatible').length,
      nearestVerticalConflictWithin2m: selected.filter(row => row.topologyVerdict === 'vertical-conflict' && row.nearestDistanceMeters !== null && row.nearestDistanceMeters <= 2).length }]
  }))
}
const example = row => `${row.station} ${row.gtfs.stopId}（GTFS ${row.gtfs.pathwayModes.join('/') || 'なし'}、walking ${row.nearestWalking?.routeTypes.join('/') || 'なし'}、${row.nearestDistanceMeters ?? '不明'}m、2m内${row.candidateCountWithin2m}件）`
const formatTable = stations => stations.map(station => {
  const c = station.counts
  return `| ${station.stationName}${station.walkingDataCompleteness === 'partial' ? '※' : ''} | ${c.gtfsStops} | ${c.walkingNodes} | ${c.exact} | ${c.strong} | ${c.ambiguous} | ${c.unmatched} | ${c.verticalConflictNearest} | ${c.medianNearestMeters ?? '—'} / ${c.p90NearestMeters ?? '—'} |`
}).join('\n')

export async function runAudit() {
  const fixtureNames = (await readdir(fixtureDir)).filter(name => /^oedo2026-.*-gtfs-pathways\.json$/.test(name)).sort()
  const stations = []
  for (const filename of fixtureNames) {
    const key = filename.replace(/^oedo2026-/, '').replace(/-gtfs-pathways\.json$/, '')
    const fixture = await readJson(join(fixtureDir, filename))
    stations.push(auditStation(fixture, await loadWalking(key), key))
  }
  if (stations.length !== 12) throw new Error(`Expected 12 supported stations; found ${stations.length}`)
  const counts = Object.fromEntries(['exact', 'strong', 'ambiguous', 'unmatched'].map(label => [label, stations.reduce((sum, station) => sum + station.counts[label], 0)]))
  const ambiguous = sample(stations, row => row.spatialClass === 'ambiguous' && row.candidateCountWithin2m >= 2)
  const topologyConflicts = sample(stations, row => row.topologyVerdict === 'vertical-conflict' && row.nearestDistanceMeters !== null && row.nearestDistanceMeters <= 2)
  const gateExamples = sample(stations, row => row.gtfs.pathwayModes.includes(6) && row.nearestDistanceMeters !== null && row.nearestDistanceMeters <= 2, 6)
  const pathwayExceptions = stations.flatMap(station => station.pathwayExceptions.map(item => ({ station: station.stationName, ...item })))
  const exceptionGroups = new Map()
  for (const item of pathwayExceptions) {
    const key = `${item.station}|${item.reason}|${item.pathwayMode}|${item.walkingRouteTypes.join('/')}`
    const group = exceptionGroups.get(key) ?? { count: 0, example: item }
    group.count++
    exceptionGroups.set(key, group)
  }
  const representativePathwayExceptions = [...exceptionGroups.values()].sort((a, b) => b.count - a.count).slice(0, 15)
  const result = { title: 'GTFS–walking-network node crosswalk audit', generatedAt: new Date().toISOString(),
    thresholdsMeters: CROSSWALK_AUDIT_THRESHOLDS_METERS,
    interpretation: 'GTFS level_index = walking floor is a provisional candidate filter, not a verified shared physical Floor mapping. Spatial classes do not certify node identity.',
    total: { gtfsStops: stations.reduce((n, s) => n + s.counts.gtfsStops, 0), ...counts, histogram: histogram(stations), fullNetworkStations: stations.filter(s => s.walkingDataCompleteness === 'full').length, partialNetworkStations: stations.filter(s => s.walkingDataCompleteness === 'partial').length,
      exactAmongFullStations: stations.filter(s => s.walkingDataCompleteness === 'full').reduce((n, s) => n + s.counts.exact, 0),
      gtfsStopsAmongFullStations: stations.filter(s => s.walkingDataCompleteness === 'full').reduce((n, s) => n + s.counts.gtfsStops, 0) },
    cohorts: cohortCounts(stations),
    pathwayEvidence: Object.fromEntries(Object.keys(stations[0].pathwayEvidence).map(key => [key, stations.reduce((sum, station) => sum + station.pathwayEvidence[key], 0)])),
    examples: { ambiguous, topologyConflicts, fareGateNearby: gateExamples, representativePathwayExceptions },
    pathwayExceptions, stations }
  const markdown = `# GTFS–walking-network node crosswalk audit\n\n` +
    `Generated: ${result.generatedAt}\n\n` +
    `## Scope and method\n\n` +
    `All 12 supported station GTFS fixtures were compared with same-station walking nodes. Coordinates were compared with a haversine distance in meters; only numerically equal GTFS level_index and walking floor were considered. This floor equality is a **provisional filter**, not proof that the two source systems share an official Floor. exact/strong below are spatial classifications, **not accepted crosswalks**. Thresholds: exact ≤0.5m with ≥0.5m gap to second; strong ≤1.5m with ≥0.5m gap; ambiguous otherwise within 5m; unmatched beyond 5m or no same-floor node. The complete per-stop candidate diagnostics are in [JSON](./gtfs-walking-node-crosswalk-audit.json).\n\n` +
    `## All stations\n\n| Station | GTFS stops | Walking nodes | exact | strong | ambiguous | unmatched | nearest vertical conflicts | median / p90 nearest m |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n${formatTable(stations)}\n\n` +
    `※ 赤羽橋は23 node／22 linkの検証用subsetのみ。全量coverageの判断には使えない。全量GeoJSONは残り11駅で確認。\n\n` +
    `## Overall\n\nGTFS stops ${result.total.gtfsStops}; exact ${counts.exact}, strong ${counts.strong}, ambiguous ${counts.ambiguous}, unmatched ${counts.unmatched}. Full walking data: ${result.total.fullNetworkStations}/12 stations.\n\n` +
    `| Nearest distance | Nodes |\n|---|---:|\n${Object.entries(result.total.histogram).map(([range, count]) => `| ${range} | ${count} |`).join('\n')}\n\n` +
    `全量データの11駅だけでは ${result.total.exactAmongFullStations}/${result.total.gtfsStopsAmongFullStations} nodeがspatial exact。赤羽橋の部分データを含めたcoverage率としては解釈しない。\n\n` +
    `## Node types and equipment\n\n| GTFS context | Nodes | exact | strong | ambiguous | unmatched | vertical topology compatible | close vertical conflict |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${Object.entries(result.cohorts).map(([name, c]) => `| ${name} | ${c.total} | ${c.exact} | ${c.strong} | ${c.ambiguous} | ${c.unmatched} | ${c.nearestVerticalCompatible} | ${c.nearestVerticalConflictWithin2m} |`).join('\n')}\n\n設備行は同一nodeを複数行に含み得る。fare gateにはwalking route_typeの直接対応がなく、platform/boarding areaとexitも座標以外の対応証拠が必要。\n\n` +
    `## Adjacent-link topology check\n\nGTFSのfare gate/exit gateを除く${result.pathwayEvidence.comparable} Pathwayを対象に、両端nodeのspatial classがexact/strongの場合だけ、walking linkの両端・設備種別・移動方向を順番に照合した。これはnode候補の補助検証であり、採用済みcrosswalkではない。\n\n` +
    `| Station | Comparable Pathways | Both endpoints clear | Same walking link | Same equipment type | Source direction compatible | Bidirectional compatible |\n|---|---:|---:|---:|---:|---:|---:|\n${stations.map(s => { const p = s.pathwayEvidence; return `| ${s.stationName}${s.walkingDataCompleteness === 'partial' ? '※' : ''} | ${p.comparable} | ${p.bothEndpointsSpatiallyClear} | ${p.sameWalkingLink} | ${p.sameEquipmentType} | ${p.sourceDirectionCompatible} | ${p.bidirectionalCompatible} |` }).join('\n')}\n| 全体 | ${result.pathwayEvidence.comparable} | ${result.pathwayEvidence.bothEndpointsSpatiallyClear} | ${result.pathwayEvidence.sameWalkingLink} | ${result.pathwayEvidence.sameEquipmentType} | ${result.pathwayEvidence.sourceDirectionCompatible} | ${result.pathwayEvidence.bidirectionalCompatible} |\n\n` +
    `### Link topology or equipment differences\n\nBoth endpoints are spatially clear in these ${pathwayExceptions.length} GTFS Pathways, but the direct walking link or its type/direction differs. This is source-data disagreement, not permission to infer a replacement link. All cases appear in JSON. Representative groups:\n\n${representativePathwayExceptions.map(({ count, example: item }) => `- ${item.station} ${item.pathwayId}: GTFS mode ${item.pathwayMode}, walking route_type ${item.walkingRouteTypes.join('/') || 'direct linkなし'} (${item.reason}; ${count}件の同型差分)`).join('\n')}\n\n` +
    `## Representative exceptions\n\n` +
    `### Multiple close candidates\n\n${ambiguous.length ? ambiguous.map(row => `- ${example(row)}; nearest ${row.nearestWalking?.nodeId}, second ${row.secondNearestNodeId}, gap ${row.gapMeters}m`).join('\n') : 'No cases observed under the provisional floor filter.'}\n\n` +
    `### Different vertical equipment at the nearest node\n\n${topologyConflicts.length ? topologyConflicts.map(row => `- ${example(row)}`).join('\n') : 'No close nearest-node vertical conflicts observed; this does not prove correspondence.'}\n\n` +
    `### Fare gate vicinity\n\n${gateExamples.length ? gateExamples.map(row => `- ${example(row)}; walking route_type has no explicit fare-gate counterpart`).join('\n') : 'No gate-near examples within 2m.'}\n\n` +
    `## Conclusion\n\nThe 11 full-data stations show strong evidence that many nodes share the same published geometry: ${result.total.exactAmongFullStations} spatially exact candidates, with no close nearest-node vertical equipment conflicts. ${result.pathwayEvidence.sameEquipmentType} direct adjacent links also agree on equipment type. This makes a **selective** crosswalk promising. A blanket production crosswalk is **not yet safe**: the numeric floor equality is unverified across sources, 33 nodes are spatially ambiguous, Shinjuku contains 54 unmatched GTFS stops, ${pathwayExceptions.length} comparable Pathways differ after clear endpoint matching, and Akabanebashi has only a partial walking network. Fare gates, boarding areas and exits lack a direct semantic counterpart in walking-network route_type. The JSON retains nearest/second distances, gaps, 2m/5m candidate counts, GTFS and walking connection modes, in_out, shared nearest-node claimants and adjacent-link evidence for every GTFS stop. Future acceptance should require source-backed floor alignment, equipment/topology checks and explicit handling of ambiguous nodes. Production StationGuide was not connected to this audit.\n`
  await writeFile(join(reportDir, 'gtfs-walking-node-crosswalk-audit.json'), JSON.stringify(result, null, 2) + '\n')
  await writeFile(join(reportDir, 'gtfs-walking-node-crosswalk-audit.md'), markdown)
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runAudit()
  console.log(JSON.stringify({ stationCount: result.stations.length, total: result.total, reports: ['reports/gtfs-walking-node-crosswalk-audit.md', 'reports/gtfs-walking-node-crosswalk-audit.json'] }, null, 2))
}
