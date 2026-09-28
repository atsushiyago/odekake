import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { writeAuditReportIfRequested } from './auditReportWriter.ts'
import { loadedOedo2026IndoorDatasets } from '../src/data/catalogs/oedo2026IndoorDatasets.ts'
import { buildIndoorGraph, findRoutesFromPlatform, type IndoorGraph, type IndoorMovementType, type IndoorRoute } from '../src/domain/indoorRouting.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const cases = [
  { stationId: '421', name: '大門', platformId: '421P3', exits: ['421N0015'] },
  { stationId: '423', name: '麻布十番', platformId: '423P2', exits: ['423N0063'] },
  { stationId: '427', name: '代々木', platformId: '427P2', exits: ['427N0084'] },
  { stationId: '403', name: '東新宿', platformId: '403P2', exits: ['403N0019', '403N0020'] },
  { stationId: '402', name: '新宿西口', platformId: '402P1', exits: ['402N0002'] },
  { stationId: '429', name: '都庁前', platformId: '429P4', exits: ['429N0093'] },
] as const

type Prefix = {
  origin: string
  exit: string
  route: IndoorRoute
  platformLevel?: number
  gateLevel?: number
  vertical: Array<{ type: IndoorMovementType; from?: number; to?: number }>
  missingGate: boolean
}

function prefixes(graph: IndoorGraph, platformId: string, exits: string[]): Prefix[] {
  return exits.flatMap(exitId => findRoutesFromPlatform(graph, platformId, exitId, 'shortest').map(candidate => {
    const gateIndex = candidate.route.edges.findIndex(edge => edge.movementType === 'fare-gate')
    const prefixEdges = gateIndex >= 0 ? candidate.route.edges.slice(0, gateIndex) : candidate.route.edges
    const prefixNodes = candidate.route.nodes.slice(0, Math.min(candidate.route.nodes.length, prefixEdges.length + 1))
    const vertical = prefixEdges.flatMap((edge, index) => {
      if (!['stairs', 'escalator', 'elevator'].includes(edge.movementType)) return []
      const from = prefixNodes[index]?.levelIndex
      const to = prefixNodes[index + 1]?.levelIndex
      return from !== undefined && to !== undefined && from !== to ? [{ type: edge.movementType, from, to }] : []
    })
    return { origin: candidate.origin.id, exit: exitId, route: candidate.route, platformLevel: candidate.route.nodes[0]?.levelIndex, gateLevel: gateIndex >= 0 ? candidate.route.nodes[gateIndex]?.levelIndex : undefined, vertical, missingGate: gateIndex < 0 }
  }))
}

function unique(items: Prefix[]) {
  const seen = new Set<string>()
  return items.filter(item => { const key = `${item.origin}|${item.exit}`; if (seen.has(key)) return false; seen.add(key); return true })
}

const rows = cases.map(item => {
  const dataset = loadedOedo2026IndoorDatasets.find(value => value.station.id === item.stationId)!
  const graph = buildIndoorGraph(dataset.gtfs)
  const candidates = unique(prefixes(graph, item.platformId, item.exits))
  const signatures = candidates.map(candidate => `${candidate.platformLevel ?? '?'}>${candidate.gateLevel ?? '?'}:${candidate.vertical.length ? 'up' : 'none'}`)
  const signatureSet = new Set(signatures)
  const platformLevels = [...new Set(candidates.map(candidate => candidate.platformLevel).filter((value): value is number => value !== undefined))]
  const gateLevels = [...new Set(candidates.map(candidate => candidate.gateLevel).filter((value): value is number => value !== undefined))]
  const equipmentKinds = [...new Set(candidates.flatMap(candidate => candidate.vertical.map(step => step.type)))]
  const verticalUsageCounts = [...new Set(candidates.map(candidate => candidate.vertical.length))]
  const allUp = candidates.length > 0 && candidates.every(candidate => candidate.vertical.length > 0 && candidate.vertical.every(step => (step.to ?? 0) > (step.from ?? 0)))
  const hasMissingGate = candidates.some(candidate => candidate.missingGate)
  const consensus = candidates.length > 0 && !hasMissingGate && signatureSet.size === 1 && allUp ? 'LEVEL CONSENSUS' : signatureSet.size > 1 || hasMissingGate ? 'NO CONSENSUS' : 'DATA CONFLICT'
  return { item, candidates, platformLevels, gateLevels, equipmentKinds, verticalUsageCounts, signatures, consensus, allUp }
})

const markdown = [
  '# 6駅 ホーム→改札階 level transition consensus audit',
  '',
  `調査日: ${new Date().toISOString().slice(0, 10)}`,
  '',
  '設備種類は比較せず、各boarding-area候補の最初のfare gateまでに成立するlevel transitionだけを比較した。公式号車位置やFacilityへのmappingは行わない。',
  '',
  '| station | candidate count | platform level | gate level | upward coverage | equipment kinds (参考) | consensus | proposed wording |',
  '|---|---:|---|---|---:|---|---|---|',
]
for (const row of rows) {
  const wording = row.consensus === 'LEVEL CONSENSUS' ? 'ホームから改札階へ上がる' : '表示しない（候補間のlevel不一致）'
  markdown.push(`| ${row.item.name} | ${row.candidates.length} | ${row.platformLevels.join(', ') || '不明'} | ${row.gateLevels.join(', ') || '不明'} | ${row.candidates.filter(candidate => candidate.vertical.length && candidate.vertical.every(step => (step.to ?? 0) > (step.from ?? 0))).length}/${row.candidates.length} | ${row.equipmentKinds.join(', ') || 'なし'} | ${row.consensus} | ${wording} |`)
}
for (const row of rows) {
  markdown.push('', `## ${row.item.name}`, '', `- platform: ${row.item.platformId}`, `- candidates: ${row.candidates.length}`, `- platform levels: ${row.platformLevels.join(', ') || '不明'}`, `- gate levels: ${row.gateLevels.join(', ') || '不明'}`, `- candidate signatures: ${row.signatures.join(' / ') || 'なし'}`, `- vertical semantic usage count: ${row.verticalUsageCounts.join(', ') || '0'}`, `- equipment kinds (reference only): ${row.equipmentKinds.join(', ') || 'なし'}`, `- upward transitions: ${row.candidates.filter(candidate => candidate.vertical.length && candidate.vertical.every(step => (step.to ?? 0) > (step.from ?? 0))).length}/${row.candidates.length}`, `- classification: **${row.consensus}**`, `- proposed wording: ${row.consensus === 'LEVEL CONSENSUS' ? 'ホームから改札階へ上がる' : '表示しない'}`, '- production StationGuide: 未変更')
}
markdown.push('', '## 結論', '', `- LEVEL CONSENSUS: ${rows.filter(row => row.consensus === 'LEVEL CONSENSUS').map(row => row.item.name).join('、') || 'なし'}`, `- NO CONSENSUS: ${rows.filter(row => row.consensus === 'NO CONSENSUS').map(row => row.item.name).join('、') || 'なし'}`, `- DATA CONFLICT: ${rows.filter(row => row.consensus === 'DATA CONFLICT').map(row => row.item.name).join('、') || 'なし'}`, '', 'LEVEL CONSENSUSの場合も、設備名は本文に出さず、「ホームから改札階へ上がる」だけをgenericに表示候補とする。Floorの正式名称が未照合なら「地下○階」は生成しない。')

const reportPath = join(root, 'reports', 'level-transition-consensus-audit.md')
if (writeAuditReportIfRequested(reportPath, `${markdown.join('\n')}\n`)) console.log(`Wrote ${reportPath}`)

it('audits all six station prefixes without changing production guides', () => {
  expect(rows).toHaveLength(6)
  for (const row of rows) expect(row.candidates.length, row.item.name).toBeGreaterThan(0)
})
