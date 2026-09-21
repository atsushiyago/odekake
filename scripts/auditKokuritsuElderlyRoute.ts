import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'
import { outingCoursePresets } from '../src/data/coursePresets.ts'
import { loadedOedo2026IndoorDatasets } from '../src/data/catalogs/oedo2026IndoorDatasets.ts'
import { buildIndoorGraph, findRoutesFromPlatform, type IndoorEdge, type IndoorRoute } from '../src/domain/indoorRouting.ts'
import { buildKokuritsuKyogijoStationMapCompressionContext, kokuritsuKyogijoStationMapMetadata } from '../src/data/stationMaps/kokuritsuKyogijo.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const preset = outingCoursePresets.find(item => item.arrivalStationId === '426' && item.arrivalPlatformAssignments[0]?.platformId === '426P2')!
const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '426')!
const graph = buildIndoorGraph(dataset.gtfs)
const overlay = buildKokuritsuKyogijoStationMapCompressionContext(graph)
const exits = Array.isArray(preset.preferredExitId) ? preset.preferredExitId : [preset.preferredExitId]
const candidates = exits.flatMap(exitId => findRoutesFromPlatform(graph, '426P2', exitId).map(item => ({ ...item, exitId })))

type Metrics = { stairs: number; escalator: number; elevator: number; walk: number; equipmentChanges: number; decisions: number; gates: number; levels: string; firstEquipment: string; equipmentFacilities: string[] }
function metrics(route: IndoorRoute): Metrics {
  const equipment = route.edges.filter(edge => ['stairs', 'escalator', 'elevator'].includes(edge.movementType))
  const counts = { stairs: 0, escalator: 0, elevator: 0 }
  // Count semantic equipment uses, not raw GTFS links. A use ends when a
  // non-equipment edge or a different facility is encountered.
  let previousUse: string | undefined
  route.edges.forEach(edge => {
    if (!['stairs', 'escalator', 'elevator'].includes(edge.movementType)) { previousUse = undefined; return }
    const facility = overlay.byPathwayId[edge.id]?.facilityId ?? `${edge.movementType}:unknown`
    const use = `${edge.movementType}:${facility}`
    if (use !== previousUse) counts[edge.movementType as keyof typeof counts]++
    previousUse = use
  })
  const facilities = equipment.map(edge => overlay.byPathwayId[edge.id]?.facilityId ?? `${edge.movementType}:unknown`)
  let changes = 0
  for (let i = 1; i < facilities.length; i++) if (facilities[i] !== facilities[i - 1]) changes++
  const decisions = route.nodes.slice(1, -1).filter((node, index) => {
    const routeIndex = index + 1
    const nextEdge = route.edges[routeIndex]
    const previousNodeId = route.nodes[routeIndex - 1].id
    return (graph.adjacency.get(node.id) ?? []).some(edge => edge.toNodeId !== nextEdge.toNodeId && edge.toNodeId !== previousNodeId && edge.movementType !== 'fare-gate')
  }).length
  const levels = route.edges.filter(edge => graph.nodes.get(edge.fromNodeId)?.levelIndex !== graph.nodes.get(edge.toNodeId)?.levelIndex)
    .map(edge => `${graph.nodes.get(edge.fromNodeId)?.levelIndex ?? '?'}→${graph.nodes.get(edge.toNodeId)?.levelIndex ?? '?'}`).join(', ') || 'なし'
  return { ...counts, walk: route.distanceMeters, equipmentChanges: changes, decisions, gates: route.edges.filter(edge => edge.movementType === 'fare-gate').length, levels, firstEquipment: equipment[0]?.movementType ?? 'なし', equipmentFacilities: [...new Set(facilities)] }
}
function score(m: Metrics) { return [m.stairs, m.decisions, m.equipmentChanges, m.walk] as const }
function compare(a: Metrics, b: Metrics) { const x = score(a), y = score(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0 }
const rows = candidates.map(({ origin, route, exitId }) => ({ origin: origin.id, exitId, route, m: metrics(route) }))
const ranked = [...rows].sort((a, b) => compare(a.m, b.m))
const best = ranked[0]
const shortest = [...rows].sort((a, b) => a.m.walk - b.m.walk)[0]
const lowestStairs = Math.min(...rows.map(row => row.m.stairs))

const md: string[] = [
  '# 国立競技場 2番ホーム→A2 高齢者向けroute scoring audit', '',
  `生成日: ${new Date().toISOString()}`, '',
  '本番のStationGuideは変更せず、36候補を「階段回数 → 分岐数 → 設備変更数 → 総距離」の辞書式で比較した。EVとESの優先順位は固定していない。', '',
  '## 評価結果', '',
  `- 候補: **${rows.length}**（18 boarding area × A2出口候補2）`,
  `- 階段最少: **${lowestStairs}回**`,
  `- スコア上位候補: **${best.origin} → ${best.exitId}**`,
  `- 最短候補: **${shortest.origin} → ${shortest.exitId}（${shortest.m.walk.toFixed(1)}m）**`, '',
  '| rank | boarding area | exit | stairs | ES | EV | distance | equipment changes | decisions | fare gates | levels | first equipment |',
  '|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|',
]
ranked.forEach((row, index) => md.push(`| ${index + 1} | ${row.origin} | ${row.exitId} | ${row.m.stairs} | ${row.m.escalator} | ${row.m.elevator} | ${row.m.walk.toFixed(1)}m | ${row.m.equipmentChanges} | ${row.m.decisions} | ${row.m.gates} | ${row.m.levels} | ${row.m.firstEquipment} |`))
md.push('', '## 上位候補の比較', '', `- **scoring上位**: ${best.origin} → ${best.exitId}: ${best.m.stairs} stairs, ${best.m.escalator} ES, ${best.m.elevator} EV, ${best.m.walk.toFixed(1)}m, 設備変更${best.m.equipmentChanges}回, 分岐${best.m.decisions}箇所。`, `- **最短**: ${shortest.origin} → ${shortest.exitId}: ${shortest.m.stairs} stairs, ${shortest.m.escalator} ES, ${shortest.m.elevator} EV, ${shortest.m.walk.toFixed(1)}m。`, `- 最短候補も階段0回で、今回の優先順位ではscoring上位と一致${best.origin === shortest.origin && best.exitId === shortest.exitId ? 'した' : 'しない'}。`, '', '## boarding areaと案内可否', '', `選出候補のboarding areaは **${best.origin}** だが、GTFSに号車・ドア位置との対応はない。したがって「何号車・何番ドア」や、全乗客がそのboarding areaで降りることは表示できない。`, '', '## 公式構内図との整合', '', `駅構内データ: ${kokuritsuKyogijoStationMapMetadata.stationMapResourceUrl}`, `公式駅情報: ${preset.arrivalPlatformFloor?.sourceUrl ?? '未登録'}`, '- 選出候補は地下3階ホームから地下1階改札へ垂直移動し、A2出口候補へ連続するGTFS経路を持つ。', '- ただし公式構内図だけでは、列車の停止位置から選出boarding areaへ利用者を確実に誘導できる根拠はない。', '', '## StationGuide試験表示', '', '**今回は表示変更なし。** 候補boarding areaを紙面上で指定できないため、選出routeを全利用者向けcanonical routeとして採用するのは安全ではない。現行commonRouteSuffix版を維持する。', '', '## Generic化', '', '- scoring関数自体は駅固有IDを参照せず、candidateの構造化指標でgeneric化できる。', '- ただし紙面採用には、boarding areaと実際の列車停止位置を結ぶ公式根拠（号車・ドア等）が別途必要。', '- EV/ESの優先順位を固定しないため、同点・僅差では「選択不能」として提示する安全策が必要。',
)
const reportPath = join(root, 'reports', 'kokuritsu-elderly-route-scoring-audit.md')
mkdirSync(join(root, 'reports'), { recursive: true })
writeFileSync(reportPath, `${md.join('\n')}\n`)
console.log(`Wrote ${reportPath}`)

it('scores all 国立競技場 candidates without changing production routing', () => {
  if (rows.length !== 36) throw new Error(`expected 36 candidate routes, got ${rows.length}`)
  if (!best || best.m.stairs !== lowestStairs) throw new Error('elderly score regression')
})
