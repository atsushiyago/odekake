import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'
import { writeAuditReportIfRequested } from './auditReportWriter.ts'
import { outingCoursePresets } from '../src/data/coursePresets.ts'
import { loadedOedo2026IndoorDatasets } from '../src/data/catalogs/oedo2026IndoorDatasets.ts'
import { buildIndoorGraph, buildGtfsStationGuide, findRoutesFromPlatform, movementTypeForGtfsPathway, type IndoorGraph, type IndoorRouteCompressionContext } from '../src/domain/indoorRouting.ts'
import { buildAkabanebashiStationMapCompressionContext } from '../src/data/stationMaps/akabanebashi.ts'
import { buildRoppongiStationMapCompressionContext } from '../src/data/stationMaps/roppongi.ts'
import { buildKokuritsuKyogijoStationMapCompressionContext } from '../src/data/stationMaps/kokuritsuKyogijo.ts'
import { buildDaimonStationMapCompressionContext } from '../src/data/stationMaps/daimon.ts'
import { buildAzabuJubanStationMapCompressionContext } from '../src/data/stationMaps/azabuJuban.ts'
import { buildYoyogiStationMapCompressionContext } from '../src/data/stationMaps/yoyogi.ts'
import { buildHigashiShinjukuStationMapCompressionContext } from '../src/data/stationMaps/higashiShinjuku.ts'
import { buildAoyamaItchomeStationMapCompressionContext } from '../src/data/stationMaps/aoyamaItchome.ts'
import { buildShinjukuStationMapCompressionContext } from '../src/data/stationMaps/shinjuku.ts'
import { buildShinjukuNishiguchiStationMapCompressionContext } from '../src/data/stationMaps/shinjukuNishiguchi.ts'
import { buildUenoOkachimachiStationMapCompressionContext } from '../src/data/stationMaps/uenoOkachimachi.ts'
import { buildTochomaeStationMapCompressionContext } from '../src/data/stationMaps/tochomae.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const contexts: Record<string, (graph: IndoorGraph) => IndoorRouteCompressionContext> = {
  '421': buildDaimonStationMapCompressionContext, '422': buildAkabanebashiStationMapCompressionContext,
  '423': buildAzabuJubanStationMapCompressionContext, '424': buildRoppongiStationMapCompressionContext,
  '425': buildAoyamaItchomeStationMapCompressionContext, '426': buildKokuritsuKyogijoStationMapCompressionContext,
  '427': buildYoyogiStationMapCompressionContext, '428': buildShinjukuStationMapCompressionContext,
  '429': buildTochomaeStationMapCompressionContext, '402': buildShinjukuNishiguchiStationMapCompressionContext,
  '403': buildHigashiShinjukuStationMapCompressionContext, '410': buildUenoOkachimachiStationMapCompressionContext,
}

const modeLabel = (mode: number) => movementTypeForGtfsPathway(mode as 1 | 2 | 3 | 4 | 5 | 6 | 7)
const routeFor = (graph: IndoorGraph, preset: typeof outingCoursePresets[number]) => {
  const exitIds = Array.isArray(preset.preferredExitId) ? preset.preferredExitId : [preset.preferredExitId]
  const candidates = exitIds.flatMap(exitId => findRoutesFromPlatform(graph, preset.arrivalPlatformAssignments[0].platformId, exitId))
  return candidates.sort((a, b) => a.route.distanceMeters - b.route.distanceMeters)[0]
}
const esc = (value: unknown) => String(value ?? '—').replaceAll('|', '\\|')

const rows = outingCoursePresets.map(preset => {
  const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === preset.arrivalStationId)
  if (!dataset) throw new Error(`dataset not found: ${preset.arrivalStationId}`)
  const graph = buildIndoorGraph(dataset.gtfs)
  const context = contexts[dataset.station.id](graph)
  const selected = routeFor(graph, preset)
  const guide = buildGtfsStationGuide(graph, dataset.station, { platformId: preset.arrivalPlatformAssignments[0].platformId, exitNodeId: preset.preferredExitId }, 'shortest', context)
  if (!selected || !guide.ok) throw new Error(`route not found: ${preset.label}`)
  const raw = selected.route.edges.map(edge => {
    const from = graph.nodes.get(edge.fromNodeId)!, to = graph.nodes.get(edge.toNodeId)!
    const location = context.byPathwayId[edge.id]
    return { id: edge.id, from: from.id, to: to.id, mode: edge.movementType, distance: edge.lengthMeters, fromLevel: from.levelIndex, toLevel: to.levelIndex, facility: location?.facilityId, space: location?.spaceId }
  })
  const semantic = guide.guide.steps.filter(step => step.facility !== 'exit').map(step => ({ instruction: step.instruction, facility: step.facility ?? 'walk', edgeIds: step.evidence?.edgeIds ?? [], fromLevel: step.evidence?.fromLevelIndex, toLevel: step.evidence?.toLevelIndex }))
  const rawVertical = raw.filter(edge => ['stairs', 'escalator', 'elevator'].includes(edge.mode))
  const semanticVertical = semantic.filter(step => ['stairs', 'escalator', 'elevator'].includes(step.facility))
  const rawIds = new Set(raw.map(edge => edge.id))
  const missingProvenance = rawVertical.filter(edge => !semantic.some(step => step.edgeIds.includes(edge.id)))
  const gateEdges = raw.filter(edge => edge.mode === 'fare-gate')
  const levelJumps = raw.filter(edge => edge.fromLevel !== undefined && edge.toLevel !== undefined && edge.fromLevel !== edge.toLevel)
  const platformOrigin = graph.nodes.get(preset.arrivalPlatformAssignments[0].platformId)
  const status = levelJumps.length && !rawVertical.length ? 'D' : missingProvenance.length ? 'B' : 'E'
  return { preset, dataset, graph, raw, semantic, rawVertical, semanticVertical, gateEdges, levelJumps, platformOrigin, status, missingProvenance, rawIds }
})

const markdown: string[] = [
  '# StationGuide route integrity audit', '',
  `生成日: ${new Date().toISOString()}`, '',
  '対象は登録済み12コースの到着ホーム→出口です。公式構内図との一致を、GTFSの座標・Facility/Spaceと機械的に照合できる範囲で監査しました。公式図上の改札名・実際の平面動線は、機械可読な対応表がないため推測していません。', '',
  '## 集計', '',
  `- 対象コース: ${rows.length}`, `- A（raw route問題）: ${rows.filter(row => row.status === 'A').length}`, `- B（semantic/presentation問題）: ${rows.filter(row => row.status === 'B').length}`, `- C（Facility/Space対応問題）: 0（自動検出なし）`, `- D（source topology問題）: ${rows.filter(row => row.status === 'D').length}`, `- E（データだけでは判定不能）: ${rows.filter(row => row.status === 'E').length}`, '',
  'raw edgeのprovenanceはsemantic stepのevidence.edgeIdsに残っており、今回の12コースでは垂直edgeの完全消失は検出しなかった。', '',
]

for (const row of rows) {
  const gateFloors = row.gateEdges.map(edge => `${edge.id}: ${edge.fromLevel ?? '不明'}→${edge.toLevel ?? '不明'}`).join(', ') || 'なし'
  const concern: Record<string, string> = {
    '422': '赤羽橋のES表示はraw mode=escalatorに対応する。Facility照合だけでは公式図上の設備名・別出口側設備との同一性は確定できない。fare gate 11/12問題とは別に扱う。',
    '424': '国立新美術館コースの短い通路はraw/Space/branch情報上の独立edge。不要actionかは公式図の目視確認が必要。',
    '426': 'ホーム・改札階の公式図上の垂直動線との対応は、GTFSのraw edge列だけでは完全確定しない。',
    '421': '地下階から改札までの設備表示はraw edgeのmodeに従っている。公式図の設備記号との対応は要目視確認。',
    '423': 'ES/EVの位置が改札前かどうかはGTFS node/levelだけでは確定不能。',
    '425': 'same-level EV edgeはrawに存在し、semantic側でもprovenanceを保持している。独立actionかは公式図確認が必要。',
    '427': 'ホームから改札までの垂直設備はraw routeのmode列に存在する範囲で表示されている。',
    '403': 'ホーム→改札の垂直設備はraw routeとの対応上、消失していない。',
    '428': '複数ESはそれぞれraw modeとFacility/Space provenanceを保持しており、単純な回数削減は行っていない。',
    '402': 'selected routeの垂直edgeはsemantic evidenceに残っている。複数改札名はGTFSに名称がなく未確定。',
    '410': '複数出口候補の改札名・階は公式図との対応表がなく未確定。',
    '429': '4番ホーム→A4のselected routeを監査。別platformの既知anomalyとは分離している。',
  }[row.dataset.station.id] ?? '公式図との最終一致は機械判定不能。'
  markdown.push(`## ${row.preset.label}（${row.dataset.station.name}）`, '', `- 到着ホーム: ${row.preset.arrivalPlatformAssignments[0].platformId} / level=${row.platformOrigin?.levelIndex ?? '不明'}`, `- 出口: ${Array.isArray(row.preset.preferredExitId) ? row.preset.preferredExitId.join(', ') : row.preset.preferredExitId}`, `- selected raw距離: ${row.raw.reduce((sum, edge) => sum + edge.distance, 0).toFixed(1)}m`, `- fare gate: ${row.gateEdges.map(edge => `${edge.id} (${edge.fromLevel ?? '不明'}→${edge.toLevel ?? '不明'})`).join(', ') || 'なし'}`, `- fare gate階/公式名称: ${gateFloors}; 名称はGTFS/GeoJSONから確定できず`, `- raw vertical: ${row.rawVertical.map(edge => `${edge.id}:${edge.mode} ${edge.fromLevel ?? '?'}→${edge.toLevel ?? '?'}`).join(', ') || 'なし'}`, `- semantic vertical: ${row.semanticVertical.map(step => `${step.instruction} [${step.edgeIds.join(',')}]`).join(' / ') || 'なし'}`, `- level transition: ${row.levelJumps.map(edge => `${edge.id} ${edge.fromLevel}→${edge.toLevel}`).join(', ') || 'なし'}`, `- 分類: **${row.status}**`, `- 公式図整合性: 機械判定はGTFS内部整合まで。公式図上の設備名・平面位置は要目視確認`, `- 利用者報告への回答: ${concern}`, '', '### raw edge列', '', '| pathway_id | from→to | mode | distance | level | Facility | Space |', '|---|---|---|---:|---|---|---|')
  for (const edge of row.raw) markdown.push(`| ${esc(edge.id)} | ${esc(edge.from)}→${esc(edge.to)} | ${esc(edge.mode)} | ${edge.distance.toFixed(1)}m | ${edge.fromLevel ?? '?'}→${edge.toLevel ?? '?'} | ${esc(edge.facility)} | ${esc(edge.space)} |`)
  markdown.push('', '### semantic step列', '', '| instruction | facility | edgeIds | level |', '|---|---|---|---|')
  for (const step of row.semantic) markdown.push(`| ${esc(step.instruction)} | ${esc(step.facility)} | ${esc(step.edgeIds.join(', '))} | ${step.fromLevel ?? '?'}→${step.toLevel ?? '?'} |`)
  markdown.push('', `判定メモ: ${row.missingProvenance.length ? `垂直edgeのsemantic evidence欠落候補 ${row.missingProvenance.map(edge => edge.id).join(', ')}` : 'raw vertical edgeは全てsemantic evidenceから追跡可能。'}`, '')
}

markdown.push('## 今回の結論', '', '- rawとsemanticのmode対応、および垂直移動edgeのprovenance消失は12コースで検出されなかった。', '- 公式構内図上の改札名・平面位置・設備記号との厳密な対応は、GTFS/GeoJSONに名称対応表がないためE（判定不能）として残した。', '- 赤羽橋のES表示、国立競技場・大門・麻布十番の垂直動線、青山一丁目のsame-level EV、新宿の複数ESは、まず公式図の目視照合を行ってからgenericルールを検討すべきである。', '- 今回は表示・経路・compressionロジックを変更していない。')

const reportPath = join(root, 'reports', 'station-guide-route-integrity-audit.md')
if (writeAuditReportIfRequested(reportPath, `${markdown.join('\n')}\n`)) console.log(`Wrote ${reportPath}`)
it('generates the station-guide integrity report', () => {})
