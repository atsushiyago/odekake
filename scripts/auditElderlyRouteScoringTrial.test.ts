import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { it, expect } from 'vitest'
import { loadedOedo2026IndoorDatasets } from '../src/data/catalogs/oedo2026IndoorDatasets.ts'
import { buildIndoorGraph, compactIndoorRouteSteps, findRoutesFromPlatform } from '../src/domain/indoorRouting.ts'
import { findBestElderlyRoute, formatElderlyRouteScore, type ElderlyRouteScore } from '../src/domain/elderlyRouteScoring.ts'
import { buildRoppongiStationMapCompressionContext } from '../src/data/stationMaps/roppongi.ts'
import { buildKokuritsuKyogijoStationMapCompressionContext } from '../src/data/stationMaps/kokuritsuKyogijo.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

function trial(stationId: string, platformId: string, exitIds: string[]): ElderlyRouteScore | null {
  const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === stationId)
  if (!dataset) return null
  const graph = buildIndoorGraph(dataset.gtfs)
  const context = stationId === '424' ? buildRoppongiStationMapCompressionContext(graph) : stationId === '426' ? buildKokuritsuKyogijoStationMapCompressionContext(graph) : undefined
  return findBestElderlyRoute(graph, platformId, exitIds, context)
}

function shortestSemanticStepCount(stationId: string, platformId: string, exitIds: string[]) {
  const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === stationId)
  if (!dataset) return null
  const graph = buildIndoorGraph(dataset.gtfs)
  const routes = exitIds.flatMap(exitId => findRoutesFromPlatform(graph, platformId, exitId).map(item => item.route))
  const shortest = routes.sort((a, b) => a.distanceMeters - b.distanceMeters)[0]
  const context = stationId === '424' ? buildRoppongiStationMapCompressionContext(graph) : stationId === '426' ? buildKokuritsuKyogijoStationMapCompressionContext(graph) : undefined
  return shortest ? compactIndoorRouteSteps(shortest, context).length : null
}

const cases = [
  { name: '国立競技場', stationId: '426', platformId: '426P2', exitIds: ['426N0139', '426N0241'], car: '4号車付近', official: 'エレベーター（国立競技場方面改札）' },
  { name: '六本木', stationId: '424', platformId: '424P2', exitIds: ['424N0053'], car: '8号車付近', official: 'エレベーターまたはエスカレーター（東京ミッドタウン方面改札）' },
]

const rows = cases.map(item => ({ ...item, score: trial(item.stationId, item.platformId, item.exitIds), beforeSteps: shortestSemanticStepCount(item.stationId, item.platformId, item.exitIds) }))
const markdown = [
  '# 国立競技場・六本木 高齢者向けroute scoring試験',
  '',
  `生成日: ${new Date().toISOString()}`,
  '',
  '対象駅だけで、既存のGTFS-Pathways候補を「階段 → 設備乗換 → 分岐 → 距離」の順に評価した。EVを常にESより優先するルールは設けず、距離が10m以内で設備利用回数も同じ場合だけESを最終タイブレークにした。',
  '',
  '| 駅 | 公式乗車位置 | 公式設備・改札 | 選択exit | 階段 | ES | EV | 設備乗換 | 分岐 | 距離 | semantic steps (旧→試験) |',
  '|---|---|---|---|---:|---:|---:|---:|---:|---:|---|',
]
for (const row of rows) {
  const s = row.score
  const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === row.stationId)
  const graph = dataset ? buildIndoorGraph(dataset.gtfs) : undefined
  const context = graph && row.stationId === '424' ? buildRoppongiStationMapCompressionContext(graph) : graph && row.stationId === '426' ? buildKokuritsuKyogijoStationMapCompressionContext(graph) : undefined
  markdown.push(`| ${row.name} | ${row.car} | ${row.official} | ${s?.exitId ?? 'なし'} | ${s?.stairs ?? '-'} | ${s?.escalators ?? '-'} | ${s?.elevators ?? '-'} | ${s?.equipmentChanges ?? '-'} | ${s?.decisionPoints ?? '-'} | ${s ? `${s.distanceMeters.toFixed(1)}m` : '-'} | ${row.beforeSteps ?? '-'}→${s ? compactIndoorRouteSteps(s.route, context).length : '-'} |`)
}
markdown.push('', '## 紙面への試験表示', '', '- 国立競技場: 「できれば4号車付近に乗る」／「エレベーターで国立競技場方面改札へ」', '- 六本木: 「できれば8号車付近に乗る」／「エレベーターまたはエスカレーターで東京ミッドタウン方面改札へ」', '', '号車・ドアとGTFS boarding areaの対応は提供されていないため、個別の号車位置から特定boarding areaを断定していない。上の文言は公式バリアフリー資料の補助的な目安として表示する。', '', '## before / after', '', '従来のStationGuideは最短経路を使っていた。今回の2駅だけ、同じA4構造のまま候補routeを評価し、選択したrouteのsemantic stepsとsummaryを表示する。', '')

const reportPath = join(root, 'reports', 'elderly-route-scoring-trial.md')
mkdirSync(join(root, 'reports'), { recursive: true })
writeFileSync(reportPath, `${markdown.join('\n')}\n`)
console.log(`Wrote ${reportPath}`)

it('scores both trial stations without station-specific pathway rules', () => {
  for (const row of rows) {
    expect(row.score, row.name).not.toBeNull()
    if (row.score) expect(formatElderlyRouteScore(row.score)).toContain('階段')
  }
})
