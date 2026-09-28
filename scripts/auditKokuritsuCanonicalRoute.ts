import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'
import { writeAuditReportIfRequested } from './auditReportWriter.ts'
import { outingCoursePresets } from '../src/data/coursePresets.ts'
import { loadedOedo2026IndoorDatasets } from '../src/data/catalogs/oedo2026IndoorDatasets.ts'
import { buildIndoorGraph, findRoutesFromPlatform, type IndoorEdge } from '../src/domain/indoorRouting.ts'
import { buildKokuritsuKyogijoStationMapCompressionContext } from '../src/data/stationMaps/kokuritsuKyogijo.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const preset = outingCoursePresets.find(item => item.arrivalStationId === '426' && item.arrivalPlatformAssignments[0]?.platformId === '426P2')
if (!preset) throw new Error('国立競技場 2番ホーム preset が見つかりません')
const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '426')!
const graph = buildIndoorGraph(dataset.gtfs)
const map = buildKokuritsuKyogijoStationMapCompressionContext(graph)
const exitIds = Array.isArray(preset.preferredExitId) ? preset.preferredExitId : [preset.preferredExitId]
const candidates = exitIds.flatMap(exitId => findRoutesFromPlatform(graph, '426P2', exitId).map(item => ({ ...item, exitId })))

function beforeGate(edges: IndoorEdge[]) {
  const gate = edges.findIndex(edge => edge.movementType === 'fare-gate')
  return gate < 0 ? edges : edges.slice(0, gate)
}
function detail(edge: IndoorEdge) {
  const from = graph.nodes.get(edge.fromNodeId), to = graph.nodes.get(edge.toNodeId)
  const overlay = map.byPathwayId[edge.id]
  return `${edge.id} ${edge.movementType} ${from?.levelIndex ?? '?'}→${to?.levelIndex ?? '?'} ${edge.lengthMeters.toFixed(1)}m (facility=${overlay?.facilityId ?? '—'}, space=${overlay?.spaceId ?? '—'})`
}

const rows = candidates.map(({ origin, route, exitId }) => {
  const prefix = beforeGate(route.edges)
  const vertical = prefix.filter(edge => ['stairs', 'escalator', 'elevator'].includes(edge.movementType))
  return { origin: origin.id, exitId, distance: route.distanceMeters, prefix, vertical }
})
const signatures = new Map<string, number>()
for (const row of rows) {
  const key = row.vertical.map(edge => `${edge.movementType}:${graph.nodes.get(edge.fromNodeId)?.levelIndex ?? '?'}>${graph.nodes.get(edge.toNodeId)?.levelIndex ?? '?'}`).join(' / ')
  signatures.set(key, (signatures.get(key) ?? 0) + 1)
}
const anchorGroups = new Map<string, { count: number; origins: string[] }>()
for (const row of rows) {
  const first = row.vertical[0]
  const key = first ? `${first.movementType}:${map.byPathwayId[first.id]?.facilityId ?? 'unknown'}` : 'none'
  const group = anchorGroups.get(key) ?? { count: 0, origins: [] }
  group.count++; group.origins.push(row.origin); anchorGroups.set(key, group)
}

const md: string[] = [
  '# 国立競技場 2番ホーム→A2 canonical route audit', '',
  `生成日: ${new Date().toISOString()}`, '',
  '今回は本番StationGuideを変更せず、全boarding areaの候補経路から、ホーム側の垂直設備を共通のcanonical anchorとして選べるかを調査した。', '',
  `- candidate route数: **${rows.length}**（A2の重複exit nodeを含む）`,
  '- platform floor: 地下3階（presetの公式駅情報根拠とGTFS level -3）',
  '- fare gate: 426L0141、level -1（候補経路で共通）',
  '- A2出口: 426N0139 / 426N0241', '',
  '## Candidate routeの差分', '',
  '| 件数 | ホーム側の最初の垂直行動 | Facility | level遷移 |', '|---:|---|---|---|',
]
for (const [key, group] of anchorGroups) {
  const [movement, facility] = key.split(':')
  const sample = rows.find(row => row.vertical.length && `${row.vertical[0].movementType}:${map.byPathwayId[row.vertical[0].id]?.facilityId ?? 'unknown'}` === key)?.vertical[0]
  md.push(`| ${group.count} | ${movement} | ${facility} | ${sample ? `${graph.nodes.get(sample.fromNodeId)?.levelIndex ?? '?'}→${graph.nodes.get(sample.toNodeId)?.levelIndex ?? '?'}` : '—'} |`)
}
md.push('', '### Unique semantic route prefixes', '', '| 件数 | semantic prefix | raw pathway列（facility/space付き） |', '|---:|---|---|')
for (const [key, count] of signatures) {
  const row = rows.find(item => item.vertical.map(edge => `${edge.movementType}:${graph.nodes.get(edge.fromNodeId)?.levelIndex ?? '?'}>${graph.nodes.get(edge.toNodeId)?.levelIndex ?? '?'}`).join(' / ') === key)!
  md.push(`| ${count} | ${key || '垂直移動なし'} | ${row.vertical.map(detail).join('<br>') || 'なし'} |`)
}
// Keep the complete route evidence compactly: prefixes above are the variable
// home-side part; this table records the common fare-gate/exit-side tail.
const firstRoute = candidates[0]?.route
const gateIndex = firstRoute ? firstRoute.edges.findIndex(edge => edge.movementType === 'fare-gate') : -1
const tail = firstRoute && gateIndex >= 0 ? firstRoute.edges.slice(gateIndex) : []
md.push('', '### 共通する改札以降のraw列（代表）', '',
  `- ${tail.map(detail).join('<br>') || '共通列を確認できず'}`, '',
  'candidateごとの全pathway列は、上記のホーム側可変prefixにこの代表tail（426L0141以降）を連結したもの。exit node重複以外の候補差分は、各prefixのoriginとraw pathway IDで追跡できる。', '')
md.push('', '## Canonical anchor判定', '',
  `ホーム側の最初の垂直設備は **${anchorGroups.size}種類**（階段・エレベーター複数基・エスカレーター）に分かれ、各候補の到達設備が一致しない。最大グループでも ${Math.max(...[...anchorGroups.values()].map(group => group.count))}/${rows.length} 候補に限られる。`,
  '', '**結論: C. canonical routeは安全に1本へ決定不能。**', '',
  '- 426P2の全boarding areaが同じホーム側設備へ向かうことを、GTFSグラフから確認できない。',
  '- EV/ES/階段を距離や固定優先順位で選ぶと、他のboarding areaの利用者へ設備を断定することになる。',
  '- 共通して確認できるのは改札（426L0141、level -1）以降の経路であり、ホーム→改札の垂直移動を代表するanchorではない。',
  '- 公式構内図はホーム階（地下3階）と出口方向の整合を確認できるが、全boarding areaから特定設備へ誘導できる根拠までは提供しない。', '',
  '## before / after', '',
  '- before: 現行のcommonRouteSuffix版（ホーム側の候補差分を表示せず、共通部分を案内）。',
  '- after: **変更なし**。canonical route表示および「ホームのエスカレーターへ進む」等の最初の一手は追加しない。', '',
  '## Generic化への示唆', '',
  '- genericなcanonical選択器は、候補間で設備・level遷移・到達可能性が一致し、かつ公式地図でanchorの共通性を確認できる場合だけ有効化する。',
  '- 一致しない場合はcommonRouteSuffixを維持し、単一設備を推測しない。',
)
const reportPath = join(root, 'reports', 'kokuritsu-canonical-route-audit.md')
if (writeAuditReportIfRequested(reportPath, `${md.join('\n')}\n`)) console.log(`Wrote ${reportPath}`)

it('generates the 国立競技場 canonical route audit', () => {
  if (rows.length === 0) throw new Error('候補経路がありません')
  if (anchorGroups.size < 2) throw new Error('canonical audit regression: expected distinct home-side anchors')
})
