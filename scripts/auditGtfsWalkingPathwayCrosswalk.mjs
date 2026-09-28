import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadWalking, haversineMeters, spatialClass } from './auditGtfsWalkingNodeCrosswalk.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const fixtureDir = join(root, 'src/data/fixtures')
const reportDir = join(root, 'reports')
const modeToType = new Map([[1, 1], [2, 6], [3, 2], [4, 5], [5, 4]])
const reasonNames = ['floor_unresolved', 'node_unmatched', 'node_ambiguous', 'no_walking_link', 'multiple_walking_links', 'mode_mismatch', 'direction_mismatch']
const pair = (a, b) => [a, b].sort().join('\u0000')
const finite = value => value === null || value === undefined || value === '' ? undefined : Number(value)
const pct = (a, b) => b ? `${(100 * a / b).toFixed(1)}%` : '—'

/** Conservative, one-to-one node correspondence on independently resolved floors. */
export function matchNodes(fixture, walking, mappings) {
  const levelById = new Map(fixture.levels.map(row => [row.levelId, finite(row.levelIndex)]))
  const floorByLevel = new Map(mappings.filter(row => row.status === 'unique').map(row => [row.levelIndex, row.dominantFloor]))
  const walkingByFloor = new Map()
  for (const node of walking.nodes) if (node.floor !== undefined) walkingByFloor.set(node.floor, [...(walkingByFloor.get(node.floor) ?? []), node])
  const matches = fixture.stops.map(stop => {
    const levelIndex = levelById.get(stop.levelId)
    const floor = floorByLevel.get(levelIndex)
    if (floor === undefined) return { stopId: stop.stopId, levelIndex: levelIndex ?? null, floor: null, status: 'floor_unresolved' }
    const ranked = (walkingByFloor.get(floor) ?? []).map(node => ({ node, distance: haversineMeters({ latitude: Number(stop.stopLat), longitude: Number(stop.stopLon) }, node) }))
      .sort((a, b) => a.distance - b.distance || a.node.id.localeCompare(b.node.id))
    const classification = spatialClass(ranked[0]?.distance, ranked[1]?.distance)
    return { stopId: stop.stopId, levelIndex, floor, status: classification === 'unmatched' ? 'node_unmatched' : classification === 'ambiguous' ? 'node_ambiguous' : 'candidate',
      walkingNodeId: ranked[0]?.node.id ?? null, confidence: classification,
      distanceMeters: ranked[0] ? Number(ranked[0].distance.toFixed(3)) : null,
      gapMeters: ranked[1] ? Number((ranked[1].distance - ranked[0].distance).toFixed(3)) : null }
  })
  const claims = new Map()
  for (const row of matches.filter(item => item.status === 'candidate')) claims.set(row.walkingNodeId, (claims.get(row.walkingNodeId) ?? 0) + 1)
  for (const row of matches) if (row.status === 'candidate') row.status = claims.get(row.walkingNodeId) === 1 ? 'matched' : 'node_ambiguous'
  return new Map(matches.map(row => [row.stopId, row]))
}

export function verifyPathway(pathway, nodes, walkingLinksByPair) {
  const from = nodes.get(pathway.fromStopId), to = nodes.get(pathway.toStopId)
  const endpoint = [from, to]
  const fail = (reason, links = []) => ({ pathwayId: pathway.pathwayId, pathwayMode: Number(pathway.pathwayMode), fromStopId: pathway.fromStopId,
    toStopId: pathway.toStopId, walkingFromNodeId: from?.walkingNodeId ?? null, walkingToNodeId: to?.walkingNodeId ?? null,
    walkingLinkIds: links.map(link => link.id), verified: false, reason })
  for (const reason of ['floor_unresolved', 'node_unmatched', 'node_ambiguous']) if (endpoint.some(row => !row || row.status === reason)) return fail(reason)
  if (endpoint.some(row => row.status !== 'matched')) return fail('node_unmatched')
  const links = walkingLinksByPair.get(pair(from.walkingNodeId, to.walkingNodeId)) ?? []
  if (!links.length) return fail('no_walking_link')
  if (links.length !== 1) return fail('multiple_walking_links', links)
  const link = links[0]
  if (Number(link.routeType) !== modeToType.get(Number(pathway.pathwayMode))) return fail('mode_mismatch', links)
  const direction = Number(link.direction)
  const forward = link.startId === from.walkingNodeId ? [1, 2].includes(direction) : [1, 3].includes(direction)
  const gtfsBidirectional = String(pathway.isBidirectional) === '1' || pathway.isBidirectional === true
  if (!forward || gtfsBidirectional && direction !== 1) return fail('direction_mismatch', links)
  return { ...fail(null, links), verified: true, reason: null, walkingLinkId: link.id,
    fromFloor: from.floor, toFloor: to.floor, nodeConfidence: [from.confidence, to.confidence] }
}

export function auditPathways(fixture, walking, mappings) {
  const nodes = matchNodes(fixture, walking, mappings)
  const linksByPair = new Map()
  for (const link of walking.links) linksByPair.set(pair(link.startId, link.endId), [...(linksByPair.get(pair(link.startId, link.endId)) ?? []), link])
  const pathways = fixture.pathways.map(pathway => verifyPathway(pathway, nodes, linksByPair))
  const verified = pathways.filter(row => row.verified).length
  return { total: pathways.length, verified, rate: verified / pathways.length,
    reasons: Object.fromEntries(reasonNames.map(reason => [reason, pathways.filter(row => row.reason === reason).length])),
    modes: Object.fromEntries([...new Set(pathways.map(row => row.pathwayMode))].sort((a, b) => a - b).map(mode => {
      const group = pathways.filter(row => row.pathwayMode === mode)
      return [mode, { total: group.length, verified: group.filter(row => row.verified).length }]
    })), nodes: [...nodes.values()], pathways }
}

export async function runAudit() {
  const floorAudit = JSON.parse(await readFile(join(reportDir, 'gtfs-walking-floor-mapping-audit.json'), 'utf8'))
  const floorByStation = new Map(floorAudit.stations.map(station => [station.key, station]))
  const names = (await readdir(fixtureDir)).filter(name => /^oedo2026-.*-gtfs-pathways\.json$/.test(name)).sort()
  const stations = []
  for (const name of names) {
    const key = name.replace(/^oedo2026-/, '').replace(/-gtfs-pathways\.json$/, '')
    const fixture = JSON.parse(await readFile(join(fixtureDir, name), 'utf8'))
    const walking = await loadWalking(key)
    const floor = floorByStation.get(key)
    if (!floor) throw new Error(`Missing floor audit for ${key}`)
    // A subset cannot establish a station-wide unique floor mapping.
    const resolvedMappings = walking.completeness === 'full' ? floor.mappings : floor.mappings.map(row => ({ ...row, status: 'unresolved' }))
    const audit = auditPathways(fixture, walking, resolvedMappings)
    stations.push({ key, station: fixture.station.name, completeness: walking.completeness,
      ...audit, productionEligibleVerified: walking.completeness === 'full' ? audit.verified : 0 })
  }
  if (stations.length !== 12) throw new Error(`Expected 12 stations; found ${stations.length}`)
  const total = stations.reduce((acc, station) => ({ total: acc.total + station.total, verified: acc.verified + station.verified,
    productionEligibleVerified: acc.productionEligibleVerified + station.productionEligibleVerified }), { total: 0, verified: 0, productionEligibleVerified: 0 })
  const reasons = Object.fromEntries(reasonNames.map(reason => [reason, stations.reduce((n, station) => n + station.reasons[reason], 0)]))
  const modes = Object.fromEntries([1, 2, 3, 4, 5, 6].map(mode => [mode, { total: stations.reduce((n, station) => n + (station.modes[mode]?.total ?? 0), 0),
    verified: stations.reduce((n, station) => n + (station.modes[mode]?.verified ?? 0), 0) }]))
  const result = { title: 'GTFS Pathway ↔ walking link verified crosswalk audit', generatedAt: new Date().toISOString(),
    criteria: 'Resolved floor; exact/strong nearest node with >=0.5m gap and one-to-one claim; exactly one direct walking link; same equipment mode; compatible forward/reverse direction. Partial stations excluded from production eligibility.',
    floorAuditSource: 'reports/gtfs-walking-floor-mapping-audit.json', total, reasons, modes, stations }
  const row = station => `| ${station.station}${station.completeness === 'partial' ? '※' : ''} | ${station.total} | ${station.verified} | ${pct(station.verified, station.total)} | ${station.productionEligibleVerified} |`
  const modeNames = { 1: '通常通路', 2: '階段', 3: '動く歩道', 4: 'エスカレーター', 5: 'エレベーター', 6: '改札' }
  const md = `# GTFS Pathway ↔ walking link verified crosswalk audit\n\nGenerated: ${result.generatedAt}\n\n` +
    `## 判定方法\n\n${result.criteria} floor対応は[前回監査](./gtfs-walking-floor-mapping-audit.md)の一意判定だけを使用。GTFS level_indexの数値とwalking floorの一致は要求しない。駅固有の例外なし。複数の失敗条件があるPathwayは floor → node → link → mode → direction の順で最初の理由に分類した。全件の証拠は[JSON](./gtfs-walking-pathway-crosswalk-audit.json)に保存。\n\n` +
    `## 12駅別\n\n| 駅 | Pathways | verified | verified率 | 本番利用資格あり |\n|---|---:|---:|---:|---:|\n${stations.map(row).join('\n')}\n| 合計 | ${total.total} | ${total.verified} | ${pct(total.verified, total.total)} | ${total.productionEligibleVerified} |\n\n` +
    `※赤羽橋はwalking-network subsetのみ。局所的に条件を満たしても全量データでの一意性を確認できず、本番利用資格は0件。\n\n` +
    `## Failure reason\n\n| 理由 | 件数 |\n|---|---:|\n${Object.entries(reasons).map(([reason, count]) => `| ${reason} | ${count} |`).join('\n')}\n\n` +
    `## 設備別\n\n| GTFS mode | Pathways | verified | 率 |\n|---|---:|---:|---:|\n${Object.entries(modes).map(([mode, value]) => `| ${modeNames[mode]} (${mode}) | ${value.total} | ${value.verified} | ${pct(value.verified, value.total)} |`).join('\n')}\n\n` +
    `## 前回の2527/2637との関係\n\n前回の2527/2637は、数値同一floorを仮定したnode候補に対し、比較可能なPathwayの直接link設備種別を照合した中間集計であり、両端の一意性・floor対応・linkの一意性・逆方向を含む方向整合を全て満たしたverified件数ではない。今回の分母は改札modeを含む全${total.total} Pathwaysであるため、割合の単純な増減比較はできない。\n\n` +
    `## 本番利用の結論\n\n条件を満たした${total.productionEligibleVerified}件は、駅固有IDに依存しないselective crosswalk候補として利用可能。ただし今回は監査結果であり、本番StationGuide・経路探索には接続していない。未verified edgeを推測で補完せず、将来接続時もwalking networkの経路情報を保持したままfallbackする必要がある。\n`
  await writeFile(join(reportDir, 'gtfs-walking-pathway-crosswalk-audit.json'), JSON.stringify(result, null, 2) + '\n')
  await writeFile(join(reportDir, 'gtfs-walking-pathway-crosswalk-audit.md'), md)
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runAudit()
  console.log(JSON.stringify({ total: result.total, reasons: result.reasons, modes: result.modes }, null, 2))
}
