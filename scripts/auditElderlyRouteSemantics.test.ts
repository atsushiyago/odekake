import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { it, expect } from 'vitest'
import { writeAuditReportIfRequested } from './auditReportWriter.ts'
import { loadedOedo2026IndoorDatasets } from '../src/data/catalogs/oedo2026IndoorDatasets.ts'
import { buildIndoorGraph, compactIndoorRouteSteps, formatIndoorStep, routeTopologyContext } from '../src/domain/indoorRouting.ts'
import { findBestElderlyRoute } from '../src/domain/elderlyRouteScoring.ts'
import { buildKokuritsuKyogijoStationMapCompressionContext } from '../src/data/stationMaps/kokuritsuKyogijo.ts'
import { buildRoppongiStationMapCompressionContext } from '../src/data/stationMaps/roppongi.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const cases = [
  { name: '国立競技場', stationId: '426', platformId: '426P2', exits: ['426N0139', '426N0241'], context: buildKokuritsuKyogijoStationMapCompressionContext },
  { name: '六本木', stationId: '424', platformId: '424P2', exits: ['424N0053'], context: buildRoppongiStationMapCompressionContext },
]

const lines: string[] = ['# 高齢者向けroute scoring 設備利用監査', '', `生成日: ${new Date().toISOString()}`, '']
for (const item of cases) {
  const dataset = loadedOedo2026IndoorDatasets.find(value => value.station.id === item.stationId)!
  const graph = buildIndoorGraph(dataset.gtfs)
  const overlay = item.context(graph)
  const score = findBestElderlyRoute(graph, item.platformId, item.exits, overlay)!
  const compacted = compactIndoorRouteSteps(score.route, routeTopologyContext(graph, score.route, overlay))
  lines.push(`## ${item.name}`, '', `選択起点: ${score.originId}`, `選択出口: ${score.exitId}`, `集計: 階段${score.stairs} / ES${score.escalators} / EV${score.elevators} / 距離${score.distanceMeters.toFixed(1)}m`, '', '| # | pathway | mode | from → to | level | length | to-node degree | facility | facility group | space |', '|---:|---|---|---|---|---:|---:|---|---|---|')
  score.route.edges.forEach((edge, index) => {
    const from = graph.nodes.get(edge.fromNodeId)!, to = graph.nodes.get(edge.toNodeId)!
    const location = overlay.byPathwayId[edge.id]
    lines.push(`| ${index + 1} | ${edge.id} | ${edge.movementType} | ${edge.fromNodeId} → ${edge.toNodeId} | ${from.levelIndex ?? '?'} → ${to.levelIndex ?? '?'} | ${edge.lengthMeters.toFixed(1)}m | ${graph.adjacency.get(to.id)?.length ?? 0} | ${location?.facilityId ?? '—'} | ${location?.facilityGroupId ?? '—'} | ${location?.spaceId ?? '—'} |`)
  })
  const semanticEquipmentCount = compacted.filter(step => ['elevator', 'escalator', 'stairs'].includes(step.type)).length
  lines.push('', `圧縮後semantic設備列: ${compacted.filter(step => ['elevator', 'escalator', 'stairs'].includes(step.type)).map(step => `${step.type}[${step.evidence.edgeIds.join(',')}]`).join(' → ')}`, `semantic設備step数: ${semanticEquipmentCount}`, `scorer集計: EV${score.elevators} / ES${score.escalators}`, '', '### 圧縮後の行動文', ...compacted.map((step, index) => `${index + 1}. ${formatIndoorStep(step)}`), '')
}
const reportPath = join(root, 'reports', 'elderly-route-semantics-audit.md')
if (writeAuditReportIfRequested(reportPath, `${lines.join('\n')}\n`)) console.log(`Wrote ${reportPath}`)

it('audits the two trial routes without changing production output', () => {
  for (const item of cases) {
    const dataset = loadedOedo2026IndoorDatasets.find(value => value.station.id === item.stationId)!
    const graph = buildIndoorGraph(dataset.gtfs)
    const score = findBestElderlyRoute(graph, item.platformId, item.exits, item.context(graph))
    expect(score).not.toBeNull()
    if (item.stationId === '426') {
      expect(score?.elevators).toBe(2)
      expect(score?.route.edges.some(edge => edge.id === '426L0052')).toBe(true)
    }
    if (item.stationId === '424') {
      expect(score?.elevators).toBe(1)
      expect(score?.escalators).toBe(1)
    }
  }
})
