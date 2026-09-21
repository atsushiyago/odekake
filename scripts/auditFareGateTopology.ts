import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractGtfsPathwaysStation, type GtfsPathwaysFeed } from '../src/data/adapters/gtfsPathwaysAdapter.ts'
import { oedo2026IndoorStations } from '../src/data/catalogs/oedo2026IndoorStations.ts'
import { buildIndoorGraph, type IndoorGraph } from '../src/domain/indoorRouting.ts'
import { auditFareGateGraph, type FareGateGroupAudit, type FareGatePathSummary } from '../src/domain/fareGateTopologyAudit.ts'
import { buildStationMapCompressionOverlay, type StationMapGeoJsonCollection } from '../src/domain/stationMap.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const fixtureDir = join(root, 'src/data/fixtures')
const reportDir = join(root, 'reports')
const fixturePath = (key: string) => join(fixtureDir, `oedo2026-${key}-gtfs-pathways.json`)

function loadGraph(station: typeof oedo2026IndoorStations[number]): IndoorGraph {
  const extracted = JSON.parse(readFileSync(fixturePath(station.key), 'utf8'))
  const raw = extractGtfsPathwaysStation(extracted as GtfsPathwaysFeed, { id: station.gtfsStationId, name: station.name })
  return buildIndoorGraph(raw)
}

function loadStationMap(key: string) {
  const directory = join(root, 'src/data/stationMaps', key)
  if (!existsSync(directory)) return undefined
  const files = readdirSync(directory).filter(file => file.endsWith('.geojson'))
  const parse = (file: string) => JSON.parse(readFileSync(join(directory, file), 'utf8')) as StationMapGeoJsonCollection
  const facilities = files.filter(file => file.includes('_Facility_')).map(parse)
  const floors = files.filter(file => file.includes('_Floor_')).map(parse)
  const spaces = files.filter(file => file.includes('_Space_')).map(parse)
  return facilities.length && floors.length && spaces.length ? { facilities, floors, spaces } : undefined
}

const distanceMeters = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 90000, (a[1] - b[1]) * 111000)
function nearestFareFacilities(graph: IndoorGraph, group: FareGateGroupAudit, map: ReturnType<typeof loadStationMap>) {
  if (!map) return undefined
  const facilities = map.facilities.flatMap(collection => collection.features).filter(feature => String(feature.properties?.category ?? '') === 'F106').flatMap(feature => {
    const coordinates = feature.geometry.coordinates
    return Array.isArray(coordinates) && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number' ? [{ id: String(feature.properties?.id ?? ''), point: [coordinates[0], coordinates[1]] as [number, number] }] : []
  })
  if (!facilities.length) return { f106: [] }
  const rows = group.boardingAreas.filter(item => item.shortest?.fareGateIds.length === 0).map(item => {
    const origin = graph.nodes.get(item.boardingAreaId)
    const points = origin ? [{ label: item.boardingAreaId, point: [origin.longitude, origin.latitude] as [number, number] }] : []
    for (const gateId of item.forcedGate?.path?.fareGateIds ?? []) {
      const edge = graph.edges.find(candidate => candidate.id === gateId)
      if (edge) for (const nodeId of [edge.fromNodeId, edge.toNodeId]) { const node = graph.nodes.get(nodeId); if (node) points.push({ label: nodeId, point: [node.longitude, node.latitude] }) }
    }
    return { boardingAreaId: item.boardingAreaId, nearest: points.map(point => ({ ...point, nearestF106: facilities.map(facility => ({ id: facility.id, distanceMeters: distanceMeters(point.point, facility.point) })).sort((a, b) => a.distanceMeters - b.distanceMeters)[0] })) }
  })
  return { f106: facilities, rows }
}

function formatPath(path: FareGatePathSummary | undefined) {
  if (!path) return 'なし'
  return `${path.distanceMeters.toFixed(1)}m / ${path.edgeIds.join(' → ')} / mode=${path.pathwayModes.join(',')}`
}

const stationResults = oedo2026IndoorStations.map(station => {
  const graph = loadGraph(station)
  const groups = auditFareGateGraph(graph)
  const map = loadStationMap(station.key)
  const overlay = map ? buildStationMapCompressionOverlay({ graph, ...map, sourceUrl: `src/data/stationMaps/${station.key}` }) : undefined
  return { station, graph, groups, map, overlay }
})

const allGroups = stationResults.flatMap(result => result.groups)
const anomalies = stationResults.flatMap(result => result.groups.filter(group => group.status !== 'OK').map(group => ({ ...group, stationKey: result.station.key, graph: result.graph, map: result.map, overlay: result.overlay, mapRelation: nearestFareFacilities(result.graph, group, result.map) })))
const mixedGroups = allGroups.filter(group => group.anomalyReasons.some(reason => reason.includes('fare gateあり')))
const loopCases = allGroups.flatMap(group => group.boardingAreas.filter(item => item.forcedGate?.kind === 'loop').map(item => ({ group, item })))
const anomalyStations = new Set(anomalies.map(item => item.stationId))
const loopStations = new Set(loopCases.map(item => item.group.stationId))

console.log('=== Fare Gate Topology Audit ===')
for (const result of stationResults) {
  for (const group of result.groups) {
    const routable = group.boardingAreas.filter(item => item.shortest)
    const withGate = routable.filter(item => item.shortest!.fareGateIds.length)
    const withoutGate = routable.length - withGate.length
    if (group.status === 'OK') continue
    console.log(`${result.station.name} / ${group.platformCode ? `${group.platformCode}番ホーム` : group.platformId} / ${group.exitName ?? group.exitId}`)
    console.log(`boarding areas: ${routable.length} / fare gateあり: ${withGate.length} / fare gateなし: ${withoutGate}`)
    for (const item of group.boardingAreas.filter(item => item.shortest && !item.shortest.fareGateIds.length)) console.log(`⚠ anomaly: ${item.boardingAreaId} / forced gate: ${item.forcedGate?.kind ?? 'none'}${item.forcedGate?.path ? ` / ${item.forcedGate.path.distanceMeters.toFixed(1)}m` : ''}`)
  }
}
console.log(`stations: ${stationResults.length}, platforms: ${new Set(allGroups.map(group => `${group.stationId}:${group.platformId}`)).size}, platform→exit groups: ${allGroups.length}`)
console.log(`anomaly stations: ${anomalyStations.size}, anomaly groups: ${anomalies.length}, mixed fare-gate groups: ${mixedGroups.length}, loop cases: ${loopCases.length} (${loopStations.size} stations)`)

const markdown: string[] = [
  '# Fare Gate Topology Audit',
  '',
  `生成日: ${new Date().toISOString()}`, '',
  'このレポートの「OK」は、GTFSグラフ上の今回の接続チェックで不一致が見つからなかったという意味であり、実地動線の正しさを保証しない。fare gateの実在性・通過方向・施設境界はGTFS単独では確定しない。', '',
  '## 集計', '',
  `- 調査駅数: ${stationResults.length}`,
  `- platform数: ${new Set(allGroups.map(group => `${group.stationId}:${group.platformId}`)).size}`,
  `- 到達可能なboarding_area→exit組み合わせ数: ${allGroups.reduce((sum, group) => sum + group.boardingAreas.filter(item => item.shortest).length, 0)}`,
  `- fare gate不一致を含む駅数: ${anomalyStations.size}`,
  `- fare gate不一致を含むplatform→exitグループ数: ${mixedGroups.length}`,
  `- 異常候補グループ数: ${anomalies.length}`,
  `- gateを通る単純経路が無く、ループ経路だけが見つかったケース数: ${loopCases.length}（${loopStations.size}駅）`,
  '', '## 駅別結果', ''
]
for (const result of stationResults) {
  const groups = result.groups, stationStatus = groups.some(group => group.status === '要確認') ? '要確認' : groups.every(group => group.status === 'OK') ? 'OK' : '判定不能'
  markdown.push(`### ${result.station.name}（${stationStatus}）`, '', `- station_id: ${result.station.gtfsStationId}`, `- graph: ${result.graph.nodes.size} nodes / ${result.graph.edges.length} directed edges`, `- 構内地図: ${result.map ? 'あり（F106/Space照合を実行）' : 'なし（skip）'}`, '')
  for (const group of groups.filter(group => group.status !== 'OK')) {
    const routable = group.boardingAreas.filter(item => item.shortest)
    markdown.push(`#### ${group.platformCode ? `${group.platformCode}番ホーム` : group.platformId} → ${group.exitName ?? group.exitId}`, '', `- 判定: **${group.status}**`, `- 理由: ${group.anomalyReasons.join('、') || '到達可能な候補がない'}`)
    for (const item of routable.filter(item => !item.shortest!.fareGateIds.length)) {
      markdown.push('', `##### boarding_area ${item.boardingAreaId}`, '', `- 最短: ${formatPath(item.shortest)}`, `- fare gate: なし`, `- 強制経路: ${item.forcedGate?.kind ?? 'なし'}`, `- 強制経路詳細: ${formatPath(item.forcedGate?.path)}`, `- 距離差: ${item.forcedGate?.distanceDeltaMeters === undefined ? '不明' : `${item.forcedGate.distanceDeltaMeters.toFixed(1)}m`}`, `- node再訪: ${item.forcedGate?.path?.repeatedNodeIds.join(', ') || 'なし'}`, `- pathway再訪: ${item.forcedGate?.path?.repeatedEdgeIds.join(', ') || 'なし'}`)
    }
    const relation = nearestFareFacilities(result.graph, group, result.map)
    if (relation?.rows?.length) for (const row of relation.rows) for (const point of row.nearest) markdown.push(`- F106最近傍（${point.label}）: ${point.nearestF106?.id ?? 'なし'} / ${point.nearestF106 ? `${point.nearestF106.distanceMeters.toFixed(1)}m` : '不明'}`)
  }
}
markdown.push('', '## 赤羽橋既知ケース回帰', '')
const known = anomalies.find(item => item.stationId === '422' && item.platformId === '422P2' && item.exitId === '422N0012' && item.boardingAreas.some(area => area.boardingAreaId === '422N0080'))
if (!known) throw new Error('既知ケース 422 / 422P2 / 422N0080 / 422N0012 を検出できませんでした')
const knownArea = known.boardingAreas.find(area => area.boardingAreaId === '422N0080')!
markdown.push(`- 検出: **成功**`, `- 最短経路: ${formatPath(knownArea.shortest)}`, `- gate pathway: ${knownArea.forcedGate?.path?.fareGateIds.join(', ') || 'なし'}`, `- forced kind: ${knownArea.forcedGate?.kind ?? 'なし'}`, `- forced path: ${formatPath(knownArea.forcedGate?.path)}`, `- 11/12不一致: ${known.anomalyReasons.join('、')}`)
markdown.push('', '## 解釈上の注意', '', '- 本監査はGTFSグラフの接続不一致を抽出する。正当な別動線、GTFSの欠落、施設の実態は断定しない。', '- F106は改札口の点であり、GTFS pathwayには完全な線geometryがないため、改札を実際に横切るとは判定しない。')
mkdirSync(reportDir, { recursive: true })
writeFileSync(join(reportDir, 'fare-gate-topology-audit.md'), `${markdown.join('\n')}\n`)
writeFileSync(join(reportDir, 'fare-gate-topology-audit.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  summary: { stationCount: stationResults.length, platformCount: new Set(allGroups.map(group => `${group.stationId}:${group.platformId}`)).size, reachableBoardingAreaExitPairs: allGroups.reduce((sum, group) => sum + group.boardingAreas.filter(item => item.shortest).length, 0), anomalyStationCount: anomalyStations.size, anomalyGroupCount: anomalies.length, mixedGroupCount: mixedGroups.length, loopCaseCount: loopCases.length, loopStationCount: loopStations.size },
  stations: stationResults.map(result => ({ key: result.station.key, stationId: result.station.gtfsStationId, stationName: result.station.name, graph: { nodes: result.graph.nodes.size, directedEdges: result.graph.edges.length }, mapAvailable: Boolean(result.map), overlayMatchedPathways: result.overlay ? Object.keys(result.overlay.byPathwayId).length : 0 })),
  groups: allGroups,
}, null, 2) + '\n')
console.log(`Markdown report: ${join(reportDir, 'fare-gate-topology-audit.md')}`)
console.log(`JSON report: ${join(reportDir, 'fare-gate-topology-audit.json')}`)
