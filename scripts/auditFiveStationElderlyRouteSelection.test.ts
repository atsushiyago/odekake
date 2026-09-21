import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { loadedOedo2026IndoorDatasets } from '../src/data/catalogs/oedo2026IndoorDatasets.ts'
import { buildIndoorGraph, compactIndoorRouteSteps, findRoutesFromPlatform, type IndoorGraph, type IndoorRouteCompressionContext } from '../src/domain/indoorRouting.ts'
import { findBestElderlyRoute, scoreElderlyRoute, type ElderlyRouteScore } from '../src/domain/elderlyRouteScoring.ts'
import { buildDaimonStationMapCompressionContext } from '../src/data/stationMaps/daimon.ts'
import { buildAzabuJubanStationMapCompressionContext } from '../src/data/stationMaps/azabuJuban.ts'
import { buildYoyogiStationMapCompressionContext } from '../src/data/stationMaps/yoyogi.ts'
import { buildHigashiShinjukuStationMapCompressionContext } from '../src/data/stationMaps/higashiShinjuku.ts'
import { buildTochomaeStationMapCompressionContext } from '../src/data/stationMaps/tochomae.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

const cases = [
  { stationId: '421', name: '大門', platformId: '421P3', exits: ['421N0015'], official: '5号車付近=EV→改札、1・4号車付近=ES→改札、6・8号車付近=階段→改札；改札→B2=ES（一部）', gate: 'JR浜松町方面改札' },
  { stationId: '423', name: '麻布十番', platformId: '423P2', exits: ['423N0063'], official: '4号車付近=EV、2・8号車付近=ES；改札→7=ES（一部）', gate: '改札（名称記載なし）' },
  { stationId: '427', name: '代々木', platformId: '427P2', exits: ['427N0084'], official: '5号車付近=EV、1号車付近=ES（一部）、4・8号車付近=階段；改札→A2=ES（一部）', gate: '改札（名称記載なし）' },
  { stationId: '403', name: '東新宿', platformId: '403P2', exits: ['403N0019', '403N0020'], official: '5号車付近=EV、2・7号車付近=ES；A2はEV/ESの2行', gate: '改札（名称記載なし）' },
  { stationId: '429', name: '都庁前', platformId: '429P4', exits: ['429N0093'], official: '4号車付近=EV、2・7号車付近=ES；改札→A4=EV（一部・始発〜22:00）', gate: '改札（名称記載なし）' },
] as const

function contextFor(stationId: string, graph: IndoorGraph): IndoorRouteCompressionContext | undefined {
  if (stationId === '421') return buildDaimonStationMapCompressionContext(graph)
  if (stationId === '423') return buildAzabuJubanStationMapCompressionContext(graph)
  if (stationId === '427') return buildYoyogiStationMapCompressionContext(graph)
  if (stationId === '403') return buildHigashiShinjukuStationMapCompressionContext(graph)
  if (stationId === '429') return buildTochomaeStationMapCompressionContext(graph)
  return undefined
}

function uniqueScores(graph: IndoorGraph, platformId: string, exits: string[], context?: IndoorRouteCompressionContext) {
  const scores = new Map<string, ElderlyRouteScore>()
  for (const exitId of exits) {
    for (const preference of ['shortest', 'avoid-stairs', 'elevator-priority'] as const) {
      for (const candidate of findRoutesFromPlatform(graph, platformId, exitId, preference)) {
        const score = scoreElderlyRoute(graph, candidate.origin.id, exitId, candidate.route, context)
        scores.set(`${score.originId}|${score.exitId}|${score.route.edges.map(edge => edge.id).join(',')}`, score)
      }
    }
  }
  return [...scores.values()]
}

function equipmentPath(score: ElderlyRouteScore) {
  return compactIndoorRouteSteps(score.route, undefined).filter(step => ['stairs', 'escalator', 'elevator', 'fare-gate'].includes(step.type)).map(step => `${step.type}:${step.evidence.edgeIds.join('+')}`).join(' / ') || 'なし'
}

function anchorCandidates(scores: ElderlyRouteScore[], context?: IndoorRouteCompressionContext) {
  const values = scores.map(score => {
    const index = score.route.edges.findIndex(edge => ['stairs', 'escalator', 'elevator'].includes(edge.movementType))
    if (index < 0) return 'なし'
    const edge = score.route.edges[index]
    const location = context?.byPathwayId[edge.id]
    return `${edge.movementType}:${location?.facilityGroupId ?? location?.facilityId ?? 'Facility未対応'}@Space:${location?.spaceId ?? '不明'} (${edge.id}, ${score.route.nodes[index]?.levelIndex ?? '?'}→${score.route.nodes[index + 1]?.levelIndex ?? '?'})`
  })
  return [...new Set(values)]
}

const rows = cases.map(item => {
  const dataset = loadedOedo2026IndoorDatasets.find(value => value.station.id === item.stationId)!
  const graph = buildIndoorGraph(dataset.gtfs)
  const context = contextFor(item.stationId, graph)
  const candidates = uniqueScores(graph, item.platformId, item.exits, context)
  const selected = findBestElderlyRoute(graph, item.platformId, item.exits, context)
  const all = selected ? [selected, ...candidates.filter(candidate => candidate !== selected)] : candidates
  const gateLevels = selected?.route.edges.flatMap((edge, index) => edge.movementType === 'fare-gate' ? [`${selected.route.nodes[index]?.levelIndex ?? '?'}→${selected.route.nodes[index + 1]?.levelIndex ?? '?'}`] : []) ?? []
  const gateIndex = selected?.route.edges.findIndex(edge => edge.movementType === 'fare-gate') ?? -1
  const verticalIndices = selected ? selected.route.edges.map((edge, index) => ['stairs', 'escalator', 'elevator'].includes(edge.movementType) ? index : -1).filter(index => index >= 0) : []
  const verticalOrder = gateIndex < 0 ? '改札なし' : verticalIndices.length === 0 ? '垂直移動なし' : verticalIndices.some(index => index < gateIndex) ? '改札前に垂直移動あり' : '改札後に垂直移動（改札前なし）'
  return { item, candidateCount: candidates.length, selected, all, gateLevels, verticalOrder, anchors: anchorCandidates(candidates, context) }
})

const markdown = [
  '# 5駅 公式号車・設備候補とGTFS route selection audit',
  '',
  `調査日: ${new Date().toISOString().slice(0, 10)}`,
  '',
  '公式PDFの号車・設備候補を制約として読み、GTFS-Pathwaysの全候補をsemantic usage（階段/ES/EV、設備変更、分岐、距離）で比較した。号車番号はGTFS-Pathwaysにないため、座標が近いだけではboarding areaへ割り当てず、5駅とも `UNRESOLVED MAPPING` とした。',
  '',
  '| station | official candidates | GTFS candidate routes | best route (internal trial) | stairs | ES | EV | changes | decisions | distance | gate level | classification |',
  '|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|---|',
]
for (const row of rows) {
  const s = row.selected
  markdown.push(`| ${row.item.name} | ${row.item.official} | ${row.candidateCount} | ${s ? `${s.originId}→${s.exitId}` : 'なし'} | ${s?.stairs ?? '-'} | ${s?.escalators ?? '-'} | ${s?.elevators ?? '-'} | ${s?.equipmentChanges ?? '-'} | ${s?.decisionPoints ?? '-'} | ${s ? `${s.distanceMeters.toFixed(1)}m` : '-'} | ${row.gateLevels.join(', ') || '不明'} / ${row.verticalOrder} | UNRESOLVED MAPPING |`)
}
markdown.push('', '## 駅別確認', '')
for (const row of rows) {
  const s = row.selected
  markdown.push(`### ${row.item.name}`, '', `- 公式候補: ${row.item.official}`, `- 目的改札: ${row.item.gate}`, `- GTFS候補数: ${row.candidateCount}`, `- 設備アンカー候補（GTFS Facility/Group）: ${row.anchors.join(' / ')}`, `- 内部trial選択: ${s ? `${s.originId} → ${s.exitId}` : 'なし'}`, `- semantic評価: ${s ? `階段${s.stairs}・ES${s.escalators}・EV${s.elevators}・設備変更${s.equipmentChanges}・分岐${s.decisionPoints}・${s.distanceMeters.toFixed(1)}m` : '不成立'}`, `- 設備列: ${s ? equipmentPath(s) : 'なし'}`, `- ホーム→垂直移動→改札: ${row.verticalOrder}（fare gate level ${row.gateLevels.join(', ') || '不明'}）。垂直設備の存在は確認できるが、号車との対応は未証明`, '- 判定: **UNRESOLVED MAPPING**（公式号車位置とGTFS boarding areaを結ぶデータがないため、本番選択不可）', '- 紙面preview: 本番表示なし。号車・設備を断定する文言は生成しない。', '')
}
markdown.push('## 結論', '', '- RECOMMENDED: 0駅', '- MULTIPLE OPTIONS: 0駅（公式候補は複数だが、号車→boarding area mapping未解決のため選択結果を確定扱いしない）', '- UNRESOLVED MAPPING: 5駅', '- DATA CONFLICT: 0駅', '', '内部trialでは全5駅でGTFS route候補の比較自体は可能だった。しかし、号車位置と具体的boarding areaを公式に接続できないため、本番StationGuideへの高齢者route選択はまだ進めない。', '', '## 都庁前 A4', '', 'A4側EVは始発〜22:00。時間外はこの設備を前提にした紙面を出さず、別候補または係員確認が必要。', '')

const reportPath = join(root, 'reports', 'five-station-elderly-route-selection-audit.md')
mkdirSync(join(root, 'reports'), { recursive: true })
writeFileSync(reportPath, `${markdown.join('\n')}\n`)
console.log(`Wrote ${reportPath}`)

it('audits all five stations without changing production StationGuide', () => {
  expect(rows).toHaveLength(5)
  for (const row of rows) expect(row.candidateCount, row.item.name).toBeGreaterThan(0)
})
