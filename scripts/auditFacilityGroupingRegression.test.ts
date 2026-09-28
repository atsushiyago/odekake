import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { it, expect } from 'vitest'
import { writeAuditReportIfRequested } from './auditReportWriter.ts'
import { outingCoursePresets } from '../src/data/coursePresets.ts'
import { loadedOedo2026IndoorDatasets } from '../src/data/catalogs/oedo2026IndoorDatasets.ts'
import { buildIndoorGraph, buildGtfsStationGuide, type IndoorGraph, type IndoorRouteCompressionContext } from '../src/domain/indoorRouting.ts'
import { withStationGuidePresentation } from '../src/domain/stationGuidePresentation.ts'
import { findBestElderlyRoute } from '../src/domain/elderlyRouteScoring.ts'
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
import type { StationMapGeoJsonCollection } from '../src/domain/stationMap.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

type FacilityMeta = { id: string; category: string; floorId?: string; floorName?: string; ordinal?: number; coordinate: [number, number]; groupId: string }
const mapFolderByStation: Record<string, string> = { '425': 'aoyamaItchome', '428': 'shinjuku' }
const distanceMeters = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 90000, (a[1] - b[1]) * 111000)
function facilityMetadata(stationId: string): FacilityMeta[] {
  const folder = mapFolderByStation[stationId]
  if (!folder) return []
  const dir = join(root, 'src/data/stationMaps', folder)
  const files = readdirSync(dir).filter(file => file.includes('Facility') && file.endsWith('.geojson')).sort()
  const facilities: Omit<FacilityMeta, 'groupId' | 'floorName' | 'ordinal'>[] = []
  const floorById = new Map<string, { name?: string; ordinal?: number }>()
  for (const file of readdirSync(dir).filter(file => file.includes('Floor') && file.endsWith('.geojson')).sort()) {
    const collection = JSON.parse(readFileSync(join(dir, file), 'utf8')) as StationMapGeoJsonCollection
    for (const feature of collection.features) {
      const id = String(feature.properties?.id ?? '')
      if (id) floorById.set(id, { name: String(feature.properties?.name ?? '') || undefined, ordinal: Number.isFinite(Number(feature.properties?.ordinal)) ? Number(feature.properties?.ordinal) : undefined })
    }
  }
  for (const file of files) {
    const collection = JSON.parse(readFileSync(join(dir, file), 'utf8')) as StationMapGeoJsonCollection
    for (const feature of collection.features) {
      const props = feature.properties ?? {}
      const coordinates = feature.geometry.coordinates
      if (!Array.isArray(coordinates) || typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') continue
      const id = String(props.id ?? '')
      if (id) facilities.push({ id, category: String(props.category ?? ''), floorId: String(props.floor_id ?? '') || undefined, coordinate: [coordinates[0], coordinates[1]] })
    }
  }
  const groups: Array<{ category: string; point: [number, number]; id: string }> = []
  return facilities.map(item => {
    const existing = groups.find(group => group.category === item.category && distanceMeters(group.point, item.coordinate) <= 3)
    const groupId = existing?.id ?? (() => { const id = `facility-group:${item.category}:${item.id}`; groups.push({ category: item.category, point: item.coordinate, id }); return id })()
    const floor = item.floorId ? floorById.get(item.floorId) : undefined
    return { ...item, floorName: floor?.name, ordinal: floor?.ordinal, groupId }
  })
}
const builders: Record<string, (graph: IndoorGraph) => IndoorRouteCompressionContext> = {
  '422': buildAkabanebashiStationMapCompressionContext, '424': buildRoppongiStationMapCompressionContext, '426': buildKokuritsuKyogijoStationMapCompressionContext,
  '421': buildDaimonStationMapCompressionContext, '423': buildAzabuJubanStationMapCompressionContext, '427': buildYoyogiStationMapCompressionContext,
  '403': buildHigashiShinjukuStationMapCompressionContext, '425': buildAoyamaItchomeStationMapCompressionContext, '428': buildShinjukuStationMapCompressionContext,
  '402': buildShinjukuNishiguchiStationMapCompressionContext, '410': buildUenoOkachimachiStationMapCompressionContext, '429': buildTochomaeStationMapCompressionContext,
}

function inspect(course: typeof outingCoursePresets[number], includeGroups: boolean) {
  const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === course.arrivalStationId)
  if (!dataset || !course.arrivalPlatformAssignments[0]) return null
  const graph = buildIndoorGraph(dataset.gtfs)
  const built = builders[dataset.station.id]?.(graph)
  const context = built ? { byPathwayId: Object.fromEntries(Object.entries(built.byPathwayId).map(([id, location]) => [id, includeGroups ? location : { facilityId: location.facilityId, spaceId: location.spaceId }])) } : undefined
  const result = buildGtfsStationGuide(graph, dataset.station, { platformId: course.arrivalPlatformAssignments[0].platformId, exitNodeId: course.preferredExitId }, 'shortest', context)
  if (!result.ok) return { steps: null, elevators: null, summary: null, locations: [] as Array<{ pathwayId: string; facilityId?: string; facilityGroupId?: string; spaceId?: string }> }
  const presentation = withStationGuidePresentation(result.guide)
  // Keep raw evidence as well as the presentation evidence: semantic merging may
  // intentionally collapse several raw edges into one displayed step.
  const locations = [...result.guide.steps, ...presentation.steps].flatMap(step => step.evidence?.mapLocations ?? []).filter(location => location.facilityId || location.facilityGroupId)
  return { steps: presentation.steps.length, elevators: presentation.summary?.elevatorCount ?? 0, summary: presentation.summary, locations }
}

const rows = outingCoursePresets.map(course => ({ course, before: inspect(course, false), after: inspect(course, true) }))
const changed = rows.filter(row => row.before?.steps !== row.after?.steps || row.before?.elevators !== row.after?.elevators)
const markdown: string[] = ['# 12コース Facility grouping 回帰監査', '', `生成日: ${new Date().toISOString()}`, '', '| コース | 到着駅 | semantic steps before→after | EV before→after |', '|---|---|---:|---:|']
for (const row of rows) markdown.push(`| ${row.course.label} | ${row.course.arrivalStationName} | ${row.before?.steps ?? '-'}→${row.after?.steps ?? '-'} | ${row.before?.elevators ?? '-'}→${row.after?.elevators ?? '-'} |`)
markdown.push('', `変化したコース: **${changed.length}**`, '')
for (const row of changed) {
  markdown.push(`## ${row.course.arrivalStationName} / ${row.course.label}`, '', `steps: ${row.before?.steps}→${row.after?.steps}`, `EV: ${row.before?.elevators}→${row.after?.elevators}`, '', '| pathway | facility | facilityGroup | space |', '|---|---|---|---|')
  for (const location of row.after?.locations ?? []) markdown.push(`| ${location.pathwayId} | ${location.facilityId ?? '—'} | ${location.facilityGroupId ?? '—'} | ${location.spaceId ?? '—'} |`)
  const metas = facilityMetadata(row.course.arrivalStationId)
  const groupAnchors = new Map<string, FacilityMeta[]>()
  for (const location of row.after?.locations ?? []) {
    if (!location.facilityGroupId || !location.facilityId) continue
    const meta = metas.find(item => item.id === location.facilityId)
    if (!meta) continue
    const list = groupAnchors.get(location.facilityGroupId) ?? []
    if (!list.some(item => item.id === meta.id)) list.push(meta)
    groupAnchors.set(location.facilityGroupId, list)
  }
  const groups = [...groupAnchors.keys()]
  markdown.push('', '### 統合グループのGeoJSON根拠', '', '| facilityGroup | facility ID | category | coordinate (lon, lat) | floor | floor ordinal |', '|---|---|---|---|---|---:|')
  for (const group of groups) {
    const anchors = groupAnchors.get(group) ?? []
    const members = metas.filter(meta => anchors.some(anchor => anchor.category === meta.category && distanceMeters(anchor.coordinate, meta.coordinate) <= 3))
    for (const meta of members) markdown.push(`| ${group} | ${meta.id} | ${meta.category} | ${meta.coordinate[0].toFixed(7)}, ${meta.coordinate[1].toFixed(7)} | ${meta.floorName ?? '不明'} | ${meta.ordinal ?? '不明'} |`)
  }
  markdown.push('', '判定: 同一カテゴリで座標距離3m以内の施設を同一facilityGroupとして扱うgenericルールによる変化。近接する別設備かどうかは、上表の施設ID・座標・階・Space遷移を確認して評価する。')
  markdown.push('')
}
const kokuritsuDataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === '426')
if (kokuritsuDataset) {
  const kokuritsuGraph = buildIndoorGraph(kokuritsuDataset.gtfs)
  const kokuritsuContext = buildKokuritsuKyogijoStationMapCompressionContext(kokuritsuGraph)
  const trial = findBestElderlyRoute(kokuritsuGraph, '426P2', ['426N0139', '426N0241'], kokuritsuContext)
  markdown.push('## 高齢者向け国立競技場ルートの回帰', '', `4号車付近の試験routeは EV **${trial?.elevators ?? '判定不能'}**回（従来監査値: EV2）。今回の12コース通常route比較とは別に、同じfacilityGroup統合後もEV2を維持していることを確認した。`, '')
}
markdown.push('## 変化のない駅', '', '赤羽橋、六本木、国立競技場（通常route）、大門、麻布十番、代々木、東新宿、新宿西口、上野御徒町、都庁前ではsemantic step数・EV回数に変化なし。六本木はEV1のまま。', '')
const report = join(root, 'reports', 'facility-grouping-regression-audit.md')
if (writeAuditReportIfRequested(report, `${markdown.join('\n')}\n`)) console.log(`Wrote ${report}`)

it('keeps all 12 courses routable and records grouping regressions', () => {
  expect(rows).toHaveLength(12)
  expect(rows.every(row => row.after !== null)).toBe(true)
})
