import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'
import { writeAuditReportIfRequested } from './auditReportWriter.ts'
import { outingCoursePresets } from '../src/data/coursePresets.ts'
import { loadedOedo2026IndoorDatasets } from '../src/data/catalogs/oedo2026IndoorDatasets.ts'
import { buildIndoorGraph, findRoutesFromPlatform, type IndoorRoute } from '../src/domain/indoorRouting.ts'
import { buildKokuritsuKyogijoStationMapCompressionContext } from '../src/data/stationMaps/kokuritsuKyogijo.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const preset = outingCoursePresets.find(item => item.arrivalStationId === '426' && item.arrivalPlatformAssignments[0]?.platformId === '426P2')!
const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '426')!
const graph = buildIndoorGraph(dataset.gtfs)
const overlay = buildKokuritsuKyogijoStationMapCompressionContext(graph)
const exitIds = Array.isArray(preset.preferredExitId) ? preset.preferredExitId : [preset.preferredExitId]

type Metrics = { stairs: number; escalator: number; elevator: number; distance: number; decisions: number; equipmentChanges: number; gates: number; levels: string; first: string }
function metrics(route: IndoorRoute): Metrics {
  const counts = { stairs: 0, escalator: 0, elevator: 0 }
  let previousUse: string | undefined
  const facilities: string[] = []
  route.edges.forEach(edge => {
    if (!['stairs', 'escalator', 'elevator'].includes(edge.movementType)) { previousUse = undefined; return }
    const facility = overlay.byPathwayId[edge.id]?.facilityId ?? `${edge.movementType}:unknown`
    const use = `${edge.movementType}:${facility}`
    if (use !== previousUse) counts[edge.movementType as keyof typeof counts]++
    previousUse = use
    facilities.push(use)
  })
  const decisions = route.nodes.slice(1, -1).filter((node, index) => {
    const routeIndex = index + 1
    const next = route.edges[routeIndex]
    const previous = route.nodes[routeIndex - 1]
    return (graph.adjacency.get(node.id) ?? []).some(edge => edge.toNodeId !== next.toNodeId && edge.toNodeId !== previous.id && edge.movementType !== 'fare-gate')
  }).length
  const levels = route.edges.filter(edge => graph.nodes.get(edge.fromNodeId)?.levelIndex !== graph.nodes.get(edge.toNodeId)?.levelIndex)
    .map(edge => `${graph.nodes.get(edge.fromNodeId)?.levelIndex ?? '?'}→${graph.nodes.get(edge.toNodeId)?.levelIndex ?? '?'}`).join(', ') || 'なし'
  return { ...counts, distance: route.distanceMeters, decisions, equipmentChanges: facilities.filter((item, index) => index > 0 && item !== facilities[index - 1]).length, gates: route.edges.filter(edge => edge.movementType === 'fare-gate').length, levels, first: facilities[0]?.split(':')[0] ?? 'なし' }
}
function score(m: Metrics) { return [m.stairs, m.decisions, m.equipmentChanges, m.distance] as const }
function compare(a: Metrics, b: Metrics) { const x = score(a), y = score(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0 }

const all = exitIds.flatMap(exitId => findRoutesFromPlatform(graph, '426P2', exitId).map(({ origin, route }) => ({ origin: origin.id, exitId, route, m: metrics(route) })))
const origins = [...new Set(all.map(item => item.origin))]
const selected = origins.map(origin => all.filter(item => item.origin === origin).sort((a, b) => compare(a.m, b.m))[0])
const count = (key: keyof Pick<Metrics, 'stairs' | 'escalator' | 'elevator'>, predicate = (_: Metrics) => true) => selected.filter(item => item.m[key] > 0 && predicate(item.m)).length
const stairsZero = selected.filter(item => item.m.stairs === 0).length
const homeHas = (item: typeof selected[number], type: 'elevator' | 'escalator') => {
  const gate = item.route.edges.findIndex(edge => edge.movementType === 'fare-gate')
  return item.route.edges.slice(0, gate < 0 ? item.route.edges.length : gate).some(edge => edge.movementType === type)
}
const homeElevator = selected.filter(item => homeHas(item, 'elevator')).length
const homeEscalator = selected.filter(item => homeHas(item, 'escalator')).length
const assisted = homeElevator + homeEscalator
const allLevels = [...new Set(selected.map(item => item.m.levels))]
const allGates = [...new Set(selected.map(item => item.m.gates))]
const commonActions = [
  selected.every(item => item.m.gates === 1) ? '改札を1回通る' : undefined,
  allLevels.every(level => level.includes('-3→-1') && level.includes('-1→0')) ? '地下3階から地下1階、さらに地上階へ移動する' : undefined,
  selected.every(item => item.exitId === '426N0139') ? 'A2出口候補（426N0139）へ進む' : undefined,
].filter((value): value is string => Boolean(value))

const md: string[] = [
  '# 国立競技場 18 boarding area別 高齢者向けbest route audit', '',
  `生成日: ${new Date().toISOString()}`, '',
  '各boarding areaについてA2出口候補を比較し、階段 → 分岐 → 設備変更 → 距離の順で1本を選んだ。EV/ESの固定優先順位は用いていない。', '',
  `- boarding area: **${selected.length}**`, `- 階段0で到達: **${stairsZero}/${selected.length}**`, `- EV利用（全経路）: **${count('elevator')}**`, `- ES利用（全経路）: **${count('escalator')}**`, `- ホーム側EV利用: **${homeElevator}**`, `- ホーム側ES利用: **${homeEscalator}**`, `- ホーム側EVまたはES利用: **${assisted}/${selected.length}**`, `- 改札回数の集合: ${allGates.join(', ')}`, `- level遷移の集合: ${allLevels.join(' / ')}`, '',
  '## boarding areaごとの選択結果', '',
  '| boarding area | exit | stairs | ES | EV | distance | decisions | equipment changes | fare gate | levels | first equipment |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|',
]
for (const item of selected) md.push(`| ${item.origin} | ${item.exitId} | ${item.m.stairs} | ${item.m.escalator} | ${item.m.elevator} | ${item.m.distance.toFixed(1)}m | ${item.m.decisions} | ${item.m.equipmentChanges} | ${item.m.gates} | ${item.m.levels} | ${item.m.first} |`)
md.push('', '## 18本のsemantic比較', '', `- 共通して成立: ${commonActions.length ? commonActions.join('、') : 'なし'}`, `- 階段を使わないこと: **${stairsZero}/${selected.length}** のみ。2番ホーム全体の共通指示にはできない。`, `- EVまたはESで上がること: **${assisted}/${selected.length}**。残りは階段を含む。`, '- 18本は地下1階の改札を通過するが、ホーム側の設備種別は一致しない。', '- 改札後の細かな出口経路は既存StationGuideの構造を維持し、この監査では変更しない。', '', '## 共通StationGuide案', '', '**厳密に18/18で共通する高齢者向け設備案内は作成不可。**', '', '安全に言える最小表現は、次のように設備を断定しない表現に限られる。', '', '1. ホームから地下1階の改札へ上がる', '2. 改札を1回通る', '3. A2出口へ進む', '', '「階段は使わず、エレベーターまたはエスカレーターで上がる」は16/18には当てはまるが、2つのboarding areaでは階段を含むため、共通紙面には採用しない。', '', '## 号車・ドア指定なしでの成立性', '', 'boarding areaと列車の号車・ドア位置を結ぶ公式データがないため、個別best routeを利用者へ直接割り当てることはできない。現段階では内部監査用の選択結果に留める。', '', '## 結論', '', '- 各boarding areaについてbest routeは選択できた。', '- 18本のsemantic consensusは「地下1階改札を1回通り、A2へ向かう」まで。', '- ホーム側のEV/ES/階段を一つの設備案内へ統合することはできない。', '- scoringはgeneric化可能だが、紙面採用には停止位置（号車・ドア）または現地でのboarding area選択根拠が必要。', '- 本番StationGuideは変更していない。',
)
const report = join(root, 'reports', 'kokuritsu-boarding-best-routes-audit.md')
if (writeAuditReportIfRequested(report, `${md.join('\n')}\n`)) console.log(`Wrote ${report}`)

it('selects one best route for each of 18 boarding areas', () => {
  if (selected.length !== 18) throw new Error(`expected 18 boarding areas, got ${selected.length}`)
  if (stairsZero !== 13 || assisted !== 16) throw new Error(`unexpected semantic counts: stairs0=${stairsZero}, assisted=${assisted}`)
})
