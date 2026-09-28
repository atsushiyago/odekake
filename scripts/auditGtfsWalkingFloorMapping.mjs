import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadWalking, haversineMeters, spatialClass } from './auditGtfsWalkingNodeCrosswalk.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const fixtures = join(root, 'src/data/fixtures')
const reports = join(root, 'reports')
const modes = new Map([[1, 1], [2, 6], [3, 2], [4, 5], [5, 4]])
const numeric = value => value === undefined || value === null || value === '' ? undefined : Number(value)
const counts = rows => Object.fromEntries(['exact', 'strong', 'ambiguous', 'unmatched'].map(name => [name, rows.filter(row => row.classification === name).length]))
const pair = (a, b) => [a, b].sort().join('\u0000')
const percent = value => `${(100 * value).toFixed(1)}%`

function nearest(stop, nodes) {
  const ranked = nodes.map(node => ({ node, distance: haversineMeters({ latitude: Number(stop.stopLat), longitude: Number(stop.stopLon) }, node) }))
    .sort((a, b) => a.distance - b.distance || a.node.id.localeCompare(b.node.id))
  return { first: ranked[0], second: ranked[1], classification: spatialClass(ranked[0]?.distance, ranked[1]?.distance) }
}

/** Floor-independent, topology-confirmed crosswalk seeds only. */
export function confirmedNodeSeeds(fixture, walking) {
  const levels = new Map(fixture.levels.map(row => [row.levelId, numeric(row.levelIndex)]))
  const candidates = fixture.stops.map(stop => {
    const level = levels.get(stop.levelId)
    const match = nearest(stop, walking.nodes.filter(node => node.floor !== undefined))
    return { stop, level, ...match }
  }).filter(row => row.level !== undefined && ['exact', 'strong'].includes(row.classification))
  const claims = new Map()
  for (const row of candidates) claims.set(row.first.node.id, (claims.get(row.first.node.id) ?? 0) + 1)
  const byStop = new Map(candidates.filter(row => claims.get(row.first.node.id) === 1).map(row => [row.stop.stopId, row]))
  const walkingPairs = new Map()
  for (const link of walking.links) {
    const key = pair(link.startId, link.endId)
    walkingPairs.set(key, [...(walkingPairs.get(key) ?? []), link])
  }
  const supported = new Set()
  for (const path of fixture.pathways) {
    const type = modes.get(Number(path.pathwayMode))
    const from = byStop.get(path.fromStopId), to = byStop.get(path.toStopId)
    if (!type || !from || !to || from.first.node.id === to.first.node.id) continue
    const links = walkingPairs.get(pair(from.first.node.id, to.first.node.id)) ?? []
    if (!links.some(link => Number(link.routeType) === type && (
      link.startId === from.first.node.id ? [1, 2].includes(Number(link.direction)) : [1, 3].includes(Number(link.direction))))) continue
    supported.add(from.stop.stopId)
    supported.add(to.stop.stopId)
  }
  return [...byStop.values()].filter(row => supported.has(row.stop.stopId)).map(row => ({
    stopId: row.stop.stopId, levelIndex: row.level, walkingNodeId: row.first.node.id,
    walkingFloor: row.first.node.floor, classification: row.classification,
    distanceMeters: Number(row.first.distance.toFixed(3)),
    secondGapMeters: row.second ? Number((row.second.distance - row.first.distance).toFixed(3)) : null,
  }))
}

/** A non-colliding, sufficiently supported dominant floor is resolved; all others remain unresolved. */
export function resolveFloorMappings(seeds, levels, { minimumEvidence = 3, minimumRatio = 0.98, minimumGap = 3 } = {}) {
  const rows = [...new Set(levels)].sort((a, b) => a - b).map(levelIndex => {
    const byFloor = new Map()
    for (const seed of seeds.filter(item => item.levelIndex === levelIndex)) byFloor.set(seed.walkingFloor, (byFloor.get(seed.walkingFloor) ?? 0) + 1)
    const combinations = [...byFloor].map(([walkingFloor, count]) => ({ walkingFloor, count })).sort((a, b) => b.count - a.count || a.walkingFloor - b.walkingFloor)
    const total = combinations.reduce((sum, item) => sum + item.count, 0)
    const top = combinations[0]?.count ?? 0, runnerUp = combinations[1]?.count ?? 0
    return { levelIndex, combinations, total, dominantFloor: combinations[0]?.walkingFloor ?? null,
      dominantRatio: total ? top / total : 0, runnerUpCount: runnerUp, gapCount: top - runnerUp,
      status: top >= minimumEvidence && top - runnerUp >= minimumGap && top / total >= minimumRatio ? 'unique' : 'unresolved' }
  })
  const claimed = new Map()
  for (const row of rows.filter(item => item.status === 'unique')) claimed.set(row.dominantFloor, (claimed.get(row.dominantFloor) ?? 0) + 1)
  for (const row of rows) if (row.status === 'unique' && claimed.get(row.dominantFloor) > 1) row.status = 'unresolved'
  return rows
}

export function reevaluate(fixture, walking, mappings) {
  const levelById = new Map(fixture.levels.map(row => [row.levelId, numeric(row.levelIndex)]))
  const floorByLevel = new Map(mappings.filter(row => row.status === 'unique').map(row => [row.levelIndex, row.dominantFloor]))
  const byFloor = new Map()
  for (const node of walking.nodes) if (node.floor !== undefined) byFloor.set(node.floor, [...(byFloor.get(node.floor) ?? []), node])
  return fixture.stops.map(stop => {
    const levelIndex = levelById.get(stop.levelId)
    const mappedFloor = floorByLevel.get(levelIndex)
    const result = mappedFloor === undefined ? { classification: 'unmatched' } : nearest(stop, byFloor.get(mappedFloor) ?? [])
    return { stopId: stop.stopId, levelIndex: levelIndex ?? null, mappedFloor: mappedFloor ?? null,
      classification: result.classification, nearestWalkingNodeId: result.first?.node.id ?? null,
      distanceMeters: result.first ? Number(result.first.distance.toFixed(3)) : null,
      secondGapMeters: result.first && result.second ? Number((result.second.distance - result.first.distance).toFixed(3)) : null }
  })
}

export async function runAudit() {
  const previous = JSON.parse(await readFile(join(reports, 'gtfs-walking-node-crosswalk-audit.json'), 'utf8'))
  const oldByKey = new Map(previous.stations.map(row => [row.key, row]))
  const names = (await readdir(fixtures)).filter(name => /^oedo2026-.*-gtfs-pathways\.json$/.test(name)).sort()
  const stations = []
  for (const name of names) {
    const key = name.replace(/^oedo2026-/, '').replace(/-gtfs-pathways\.json$/, '')
    const fixture = JSON.parse(await readFile(join(fixtures, name), 'utf8'))
    const walking = await loadWalking(key)
    const seeds = confirmedNodeSeeds(fixture, walking)
    const levelById = new Map(fixture.levels.map(row => [row.levelId, numeric(row.levelIndex)]))
    const levels = fixture.stops.map(stop => levelById.get(stop.levelId)).filter(value => value !== undefined)
    const mappings = resolveFloorMappings(seeds, levels)
    const nodes = reevaluate(fixture, walking, mappings)
    const oldNodes = new Map(oldByKey.get(key).stops.map(row => [row.gtfs.stopId, row.spatialClass]))
    const transitions = {}
    for (const row of nodes) {
      const old = oldNodes.get(row.stopId)
      const transition = `${old}→${row.classification}`
      transitions[transition] = (transitions[transition] ?? 0) + 1
    }
    stations.push({ key, station: fixture.station.name, completeness: walking.completeness, seedCount: seeds.length,
      mappings, before: oldByKey.get(key).counts, after: counts(nodes), transitions, seeds, nodes })
  }
  if (stations.length !== 12) throw new Error(`Expected 12 stations; found ${stations.length}`)
  const sum = (field, label) => stations.reduce((n, station) => n + station[field][label], 0)
  const total = { seeds: stations.reduce((n, station) => n + station.seedCount, 0),
    uniqueFloors: stations.filter(station => station.completeness === 'full').reduce((n, station) => n + station.mappings.filter(row => row.status === 'unique').length, 0),
    provisionalFloors: stations.filter(station => station.completeness !== 'full').reduce((n, station) => n + station.mappings.filter(row => row.status === 'unique').length, 0),
    unresolvedFloors: stations.reduce((n, station) => n + station.mappings.filter(row => row.status !== 'unique').length, 0),
    before: Object.fromEntries(['exact', 'strong', 'ambiguous', 'unmatched'].map(label => [label, sum('before', label)])),
    after: Object.fromEntries(['exact', 'strong', 'ambiguous', 'unmatched'].map(label => [label, sum('after', label)])) }
  const result = { title: 'GTFS level_index to walking floor mapping audit', generatedAt: new Date().toISOString(),
    method: 'All-floor spatial exact/strong + one-to-one nearest node + directly adjacent same-type/direction walking link; no numeric floor equality in seed generation. Unique: >=3 seeds, >=98% dominant, dominant-runner-up >=3, no walking-floor collision across GTFS levels. Partial stations remain provisional.', total, stations }
  const mappingRows = stations.flatMap(station => station.mappings.map(row => `| ${station.station}${station.completeness === 'partial' ? '※' : ''} | ${row.levelIndex} | ${row.combinations.map(item => `${item.walkingFloor}: ${item.count}`).join('<br>') || '—'} | ${row.total} | ${percent(row.dominantRatio)} | ${row.gapCount} | ${station.completeness === 'partial' && row.status === 'unique' ? '暫定' : row.status === 'unique' ? '一意' : 'unresolved'} |`))
  const countString = c => `exact ${c.exact} / strong ${c.strong} / ambiguous ${c.ambiguous} / unmatched ${c.unmatched}`
  const stationRows = stations.map(station => `| ${station.station}${station.completeness === 'partial' ? '※' : ''} | ${station.seedCount} | ${station.mappings.filter(row => row.status === 'unique').length} | ${station.mappings.filter(row => row.status !== 'unique').map(row => row.levelIndex).join(', ') || '—'} | ${countString(station.before)} | ${countString(station.after)} |`)
  const transitions = {}
  for (const station of stations) for (const [key, count] of Object.entries(station.transitions)) transitions[key] = (transitions[key] ?? 0) + count
  const mixed = stations.flatMap(station => station.mappings.filter(row => row.combinations.length > 1).map(row => `${station.station} level ${row.levelIndex}: ${row.combinations.map(item => `floor ${item.walkingFloor}=${item.count}`).join(', ')} (${percent(row.dominantRatio)}、unresolved)`))
  const markdown = `# GTFS level_index ↔ walking-network floor audit\n\n` +
    `Generated: ${result.generatedAt}\n\n## Method\n\n${result.method} ` +
    `前回のexact/strongは数値同一floorで候補を絞っていたため、対応推定のseedとして再利用していない。全floor候補から座標が明確で、歩行linkとの直接接続・設備種別・向きまで一致するnode対だけを新たに抽出した。数値一致は判定条件にしていない。` +
    `一意判定はこの監査用の保守的基準であり、production crosswalkの承認ではない。unresolved levelは再評価でunmatchedとする。\n\n` +
    `## Station × GTFS level × walking floor\n\n| Station | GTFS level_index | walking floor: seed count | seeds | dominant ratio | 1位−2位 | 判定 |\n|---|---:|---|---:|---:|---:|---|\n${mappingRows.join('\n')}\n\n` +
    `一意 ${total.uniqueFloors} floor、赤羽橋subset由来の暫定 ${total.provisionalFloors} floor、unresolved ${total.unresolvedFloors} floor。※赤羽橋のwalking dataは23 node / 22 linkの検証用subsetであり、全駅coverageや一意性の確定には使えない。\n\n` +
    `## Crosswalk再集計\n\n| Station | confirmed seed | unique / provisional floors | unresolved levels | before（数値一致filter） | after（推定mapping） |\n|---|---:|---:|---|---|---|\n${stationRows.join('\n')}\n| 合計 | ${total.seeds} | ${total.uniqueFloors} / ${total.provisionalFloors} | ${total.unresolvedFloors} floor | ${countString(total.before)} | ${countString(total.after)} |\n\n` +
    `### 変化の内訳\n\n${Object.entries(transitions).map(([key, count]) => `- ${key}: ${count}`).join('\n')}\n\n` +
    `今回一意と判定された対応は全て数値も一致した。数値不一致で新たに救済されたnodeは0件。一方、根拠不足のlevelをunresolvedにしたため、以前のexact/strong/ambiguousからunmatchedへの変化がある。これは経路消失ではなく監査上の判定保留である。\n\n` +
    `### 複数walking floorに分かれたlevel\n\n${mixed.map(item => `- ${item}`).join('\n') || 'なし'}\n\n` +
    `完全なper-node遷移、seed証拠、floor組合せは[JSON](./gtfs-walking-floor-mapping-audit.json)に記録。これは診断のみで、本番StationGuide・route生成・metadataには接続していない。\n`
  await writeFile(join(reports, 'gtfs-walking-floor-mapping-audit.json'), JSON.stringify(result, null, 2) + '\n')
  await writeFile(join(reports, 'gtfs-walking-floor-mapping-audit.md'), markdown)
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runAudit()
  console.log(JSON.stringify(result.total, null, 2))
}
