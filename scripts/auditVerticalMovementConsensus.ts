import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'
import { outingCoursePresets } from '../src/data/coursePresets.ts'
import { loadedOedo2026IndoorDatasets } from '../src/data/catalogs/oedo2026IndoorDatasets.ts'
import { buildIndoorGraph, commonRouteSuffix, findRoutesFromPlatform, type IndoorEdge, type IndoorGraph, type IndoorRoute } from '../src/domain/indoorRouting.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const targetStationIds = new Set(['426', '421', '423', '427', '403', '402', '410', '429'])
const verticalTypes = new Set(['stairs', 'escalator', 'elevator'])
type Action = { type: string; direction: string; fromLevel?: number; toLevel?: number; edgeIds: string[] }

function direction(edge: IndoorEdge, graph: IndoorGraph) {
  const from = graph.nodes.get(edge.fromNodeId), to = graph.nodes.get(edge.toNodeId)
  if (from?.levelIndex === undefined || to?.levelIndex === undefined || from.levelIndex === to.levelIndex) return 'same-level'
  return to.levelIndex > from.levelIndex ? 'up' : 'down'
}

function actions(edges: IndoorEdge[], graph: IndoorGraph): Action[] {
  const result: Action[] = []
  let previousWasVertical = false
  for (const edge of edges) {
    if (!verticalTypes.has(edge.movementType)) { previousWasVertical = false; continue }
    const item = { type: edge.movementType, direction: direction(edge, graph), fromLevel: graph.nodes.get(edge.fromNodeId)?.levelIndex, toLevel: graph.nodes.get(edge.toNodeId)?.levelIndex, edgeIds: [edge.id] }
    const previous = result.at(-1)
    if (previous && previousWasVertical && previous.type === item.type) {
      previous.edgeIds.push(edge.id)
      previous.fromLevel = previous.fromLevel ?? item.fromLevel
      previous.toLevel = item.toLevel ?? previous.toLevel
      previous.direction = previous.fromLevel !== undefined && previous.toLevel !== undefined && previous.fromLevel !== previous.toLevel ? (previous.toLevel > previous.fromLevel ? 'up' : 'down') : 'same-level'
    } else result.push(item)
    previousWasVertical = true
  }
  return result
}

function actionLabel(action: Action) {
  const type = action.type === 'escalator' ? 'ES' : action.type === 'elevator' ? 'EV' : '階段'
  const dir = action.direction === 'up' ? '上がる' : action.direction === 'down' ? '下りる' : '移動する'
  return `${type}${dir}(${action.fromLevel ?? '?'}→${action.toLevel ?? '?'})×${action.edgeIds.length}`
}

const rows = outingCoursePresets.filter(preset => targetStationIds.has(preset.arrivalStationId)).map(preset => {
  const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === preset.arrivalStationId)!
  const graph = buildIndoorGraph(dataset.gtfs)
  const exitIds = Array.isArray(preset.preferredExitId) ? preset.preferredExitId : [preset.preferredExitId]
  const candidates = exitIds.flatMap(exitId => findRoutesFromPlatform(graph, preset.arrivalPlatformAssignments[0].platformId, exitId))
  const suffix = commonRouteSuffix(candidates.map(candidate => candidate.route))
  const candidateRows = candidates.map(({ origin, route }, index) => {
    const prefixLength = Math.max(0, route.edges.length - suffix.length)
    const prefix = route.edges.slice(0, prefixLength)
    const vertical = actions(prefix, graph)
    const gate = route.edges.find(edge => edge.movementType === 'fare-gate')
    const originLevel = graph.nodes.get(origin.id)?.levelIndex
    const gateLevel = gate ? graph.nodes.get(gate.fromNodeId)?.levelIndex : undefined
    return { index: index + 1, origin: origin.id, distance: route.distanceMeters, prefix, vertical, originLevel, gateLevel }
  })
  const signatures = candidateRows.map(candidate => candidate.vertical.map(action => `${action.type}:${action.direction}:${action.fromLevel ?? '?'}>${action.toLevel ?? '?'}`).join('|'))
  const allHaveVertical = candidateRows.every(candidate => candidate.vertical.length > 0)
  const sameSignature = signatures.length > 0 && signatures.every(signature => signature === signatures[0])
  const levelMismatch = candidateRows.some(candidate => candidate.originLevel !== undefined && candidate.gateLevel !== undefined && candidate.originLevel !== candidate.gateLevel && candidate.vertical.length === 0)
  const classification = levelMismatch || !allHaveVertical ? 'C. UNCERTAIN / TOPOLOGY ISSUE' : sameSignature ? 'A. SEMANTIC CONSENSUS' : 'B. CHOICE REQUIRED'
  const gateFloors = [...new Set(candidateRows.map(candidate => candidate.gateLevel).filter(level => level !== undefined))]
  return { preset, dataset, graph, candidates: candidateRows, suffix, signatures, classification, gateFloors, sameSignature, levelMismatch }
})

const markdown: string[] = [
  '# Vertical movement semantic consensus audit', '',
  `生成日: ${new Date().toISOString()}`, '',
  '対象はcommonRouteSuffixの前段で垂直移動がStationGuideから落ちる可能性がある8コースです。candidate routeをedge IDではなく、設備種別・方向・level遷移・意味上の連続利用回数で比較しました。今回は本番生成ロジックを変更していません。', '',
]

for (const row of rows) {
  const platform = row.preset.arrivalPlatformAssignments[0]
  const candidateActions = row.candidates.map(candidate => candidate.vertical.map(actionLabel).join(' / ') || '垂直移動なし')
  const expected = row.classification.startsWith('A') ? row.candidates[0]?.vertical.map(action => action.type === 'escalator' ? `エスカレーターで${action.direction === 'up' ? '上がる' : action.direction === 'down' ? '下りる' : '移動する'}` : action.type === 'elevator' ? `エレベーターで${action.direction === 'up' ? '上がる' : action.direction === 'down' ? '下りる' : '移動する'}` : `階段を${action.direction === 'up' ? '上がる' : action.direction === 'down' ? '下りる' : '使う'}`).join(' / ') : '単一案内を復元しない'
  markdown.push(`## ${row.dataset.station.name} / ${row.preset.label}`, '', `- arrival platform: ${platform.platformId} (${platform.platformCode ?? '番号不明'})`, `- platform floor: candidate origin levels=${[...new Set(row.candidates.map(candidate => candidate.originLevel).filter(level => level !== undefined))].join(', ') || '不明'}`, `- fare gate floor: ${row.gateFloors.length ? row.gateFloors.join(', ') : '不明'}`, `- candidate数: ${row.candidates.length}`, `- common suffix: ${row.suffix.length} edges`, `- classification: **${row.classification}**`, `- semantic consensus: ${row.sameSignature ? 'あり' : 'なし'}`, `- expected restored action: ${expected}`, `- gate floor display: ${row.gateFloors.length === 1 ? 'level値としては可能。ただし公式Floor名称との一致確認が必要' : '不可（candidate間で不一致または不明）'}`, '')
  markdown.push('| candidate | boarding area | prefix vertical actions | pathway detail |', '|---:|---|---|---|')
  for (const candidate of row.candidates) {
    const detail = candidate.vertical.flatMap(action => action.edgeIds.map(id => { const edge = candidate.prefix.find(item => item.id === id)!; const from = row.graph.nodes.get(edge.fromNodeId)!, to = row.graph.nodes.get(edge.toNodeId)!; return `${id} ${edge.movementType} ${from.levelIndex ?? '?'}→${to.levelIndex ?? '?'} ${edge.lengthMeters.toFixed(1)}m` })).join('<br>') || 'なし'
    markdown.push(`| ${candidate.index} | ${candidate.origin} | ${candidateActions[candidate.index - 1]} | ${detail} |`)
  }
  markdown.push('', `- 判定根拠: ${row.levelMismatch ? 'platform→gateのlevel差があるのに垂直移動なし。' : row.sameSignature ? '全candidateで設備種別・方向・level遷移・連続利用回数が一致。' : 'candidate間で設備種別、方向、level遷移、または回数が一致しない。'}`, '', '### 復元候補の注意', '', 'Facility IDが同じでもcandidate間の進入位置が異なる場合があるため、単一candidateの設備を代表値として採用しない。', '')
}

const counts = { consensus: rows.filter(row => row.classification.startsWith('A')).length, choice: rows.filter(row => row.classification.startsWith('B')).length, uncertain: rows.filter(row => row.classification.startsWith('C')).length }
markdown.push('## 集計', '', `- SEMANTIC CONSENSUS: ${counts.consensus}`, `- CHOICE REQUIRED: ${counts.choice}`, `- UNCERTAIN / TOPOLOGY ISSUE: ${counts.uncertain}`, '', '## 結論', '', '- candidate間で意味が一致する場合は、commonRouteSuffixの前段からsemantic actionを復元するgeneric設計が可能。', '- CHOICE REQUIREDでは「EV/ESのどちらか」など単一設備を断定しない。', '- UNCERTAINでは垂直移動を補完しない。', '- 改札階はcandidateで一意なlevel値が取れる場合のみ内部値として扱えるが、「地下○階」表示にはFloor GeoJSONまたは公式図との照合が別途必要。', '- 本番StationGuide生成ロジックは今回変更していない。')

const reportDir = join(root, 'reports')
mkdirSync(reportDir, { recursive: true })
writeFileSync(join(reportDir, 'vertical-movement-semantic-consensus-audit.md'), `${markdown.join('\n')}\n`)
console.log(`Wrote ${join(reportDir, 'vertical-movement-semantic-consensus-audit.md')}`)
it('generates the vertical movement consensus report', () => {})
