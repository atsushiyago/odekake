import { useEffect, useMemo, useRef, useState } from 'react'
import type { PrintableGuide, StationGuide, WalkingRoute } from '../domain/types'
import { akabanebashiWalkingNetworkFixture } from '../data/fixtures/akabanebashi-walking-network'
import { akabanebashiStationMapFixture } from '../data/fixtures/akabanebashi-station-map'
import { loadedOedo2026IndoorDatasetByKey, loadedOedo2026IndoorDatasets, oedo2026StationAvailability, type IndoorStationDataset } from '../data/catalogs/oedo2026IndoorDatasets'
import { buildAkabanebashiStationMapCompressionContext } from '../data/stationMaps/akabanebashi'
import { buildRoppongiStationMapCompressionContext } from '../data/stationMaps/roppongi'
import { buildKokuritsuKyogijoStationMapCompressionContext } from '../data/stationMaps/kokuritsuKyogijo'
import { buildDaimonStationMapCompressionContext } from '../data/stationMaps/daimon'
import { buildAzabuJubanStationMapCompressionContext } from '../data/stationMaps/azabuJuban'
import { buildYoyogiStationMapCompressionContext } from '../data/stationMaps/yoyogi'
import { buildHigashiShinjukuStationMapCompressionContext } from '../data/stationMaps/higashiShinjuku'
import { buildAoyamaItchomeStationMapCompressionContext } from '../data/stationMaps/aoyamaItchome'
import { buildShinjukuStationMapCompressionContext } from '../data/stationMaps/shinjuku'
import { buildShinjukuNishiguchiStationMapCompressionContext } from '../data/stationMaps/shinjukuNishiguchi'
import { buildUenoOkachimachiStationMapCompressionContext } from '../data/stationMaps/uenoOkachimachi'
import { buildTochomaeStationMapCompressionContext } from '../data/stationMaps/tochomae'
import { auditIndoorGraph, buildGtfsStationGuide, buildGtfsStationGuideFromRoute, buildIndoorGraph, buildVerifiedStationGuide, commonRouteSuffix, compactIndoorRouteSteps, findIndoorRoute, findPlatformGateLevelConsensus, findRoutesFromPlatform, formatIndoorStep, platformOriginNodes, routePreferenceSupport, type IndoorGraph, type PlatformGateLevelConsensus, type RoutePreference, type VerifiedIndoorRouteAnchor, type VerifiedStationGuideDetails } from '../domain/indoorRouting'
import { findBestElderlyRoute, formatElderlyRouteScore, type ElderlyRouteScore } from '../domain/elderlyRouteScoring'
import { elderlyRouteRecommendations, levelTransitionSummaryStationIds } from '../data/elderlyRouteRecommendations'
import { formatAlightingHomeAction, formatBoardingHomeAction, formatExitAction, formatExitLabel } from '../domain/paperLabels'
import { normalizeStationMapFacilities } from '../domain/stationMap'
import { buildWalkingNetworkGraph } from '../domain/walkingNetwork'
import type { ArrivalPlatformConnection } from '../domain/itineraryConnection'
import { resolveArrivalPlatform, resolveDeparturePlatform, type OfficialDeparturePlatformAssignment } from '../domain/itineraryConnection'
import type { RailJourneyQuery } from '../domain/railJourneySearch'
import { staticGtfsRailJourneyRepository } from '../data/repositories/staticGtfsRailJourneyRepository'
import { validateIndoorDatasets } from '../domain/indoorDatasetValidation'
import { fitOutdoorRouteGeometry, outdoorMapZoomForDistance, webMercatorPixel } from '../domain/outdoorMap'
import { countVisibleFareGateSteps, formatFareGateSummary, summarizeVisiblePostGateSteps, withFareGateExitDirections, withStationGuidePresentation, withWalkDistanceInstructions } from '../domain/stationGuidePresentation'
import { outingCoursePresetById, outingCoursePresets, type OutingCoursePreset } from '../data/coursePresets'
import { akabanebashiToTokyoTowerWalkingRoute } from '../data/fixtures/akabanebashi-to-tokyo-tower'

function WalkingMap() {
  return <section className="walking-map" aria-label="徒歩概略地図"><div className="map-note">徒歩概略図（fixture・現地確認が必要）</div><svg viewBox="0 0 620 300" role="img" aria-label="高座渋谷駅西口から大和市渋谷学習センターまでの概略図"><path d="M90 210 C190 210 170 90 315 110 S420 220 535 85" fill="none" stroke="#d9d2c4" strokeWidth="34" /><path d="M90 210 C190 210 170 90 315 110 S420 220 535 85" fill="none" stroke="#226fd1" strokeWidth="9" strokeDasharray="14 9" /><circle cx="90" cy="210" r="22" fill="#135c38"/><circle cx="535" cy="85" r="22" fill="#d4482f"/><text x="48" y="260">高座渋谷駅 西口</text><text x="430" y="43">大和市渋谷学習センター</text><text x="240" y="185" fill="#333">交差点では案内表示を確認</text></svg></section>
}

function DataStatusWarning({ guide }: { guide: PrintableGuide }) {
  const reasons = [guide.stationGuide.confidence !== 'verified' && '駅構内', guide.walkingRoute.confidence !== 'verified' && '徒歩経路'].filter(Boolean)
  if (!reasons.length) return null
  return <aside className="paper-status"><b>検証用の案内です</b><span>{reasons.join('・')}が未確認です。持ち歩き用には使わず、公式資料と現地確認を完了してください。</span></aside>
}

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OUTDOOR_MAP_VIEW = { width: 800, height: 560 }

function OutdoorRouteMap({ route, fromLabel, toLabel }: { route: NonNullable<WalkingRoute['geometry']> & { from: [number, number]; to: [number, number] }; fromLabel: string; toLabel: string }) {
  const projection = fitOutdoorRouteGeometry(route.coordinates, outdoorMapZoomForDistance(route.distanceMeters), OUTDOOR_MAP_VIEW.width, OUTDOOR_MAP_VIEW.height)
  const zoom = projection.zoom
  const { centerPixel: [centerX, centerY] } = projection
  const start = webMercatorPixel(route.from, zoom)
  const destination = webMercatorPixel(route.to, zoom)
  const tileX = Math.floor(centerX / 256), tileY = Math.floor(centerY / 256)
  const routePoints = projection.projected.map(([x, y]) => `${x},${y}`).join(' ')
  const point = ([x, y]: readonly [number, number]) => ({ x: x - centerX + OUTDOOR_MAP_VIEW.width / 2, y: y - centerY + OUTDOOR_MAP_VIEW.height / 2 })
  const startPoint = point(start), destinationPoint = point(destination)
  const destinationDiamond = `${destinationPoint.x},${destinationPoint.y - 22} ${destinationPoint.x + 22},${destinationPoint.y} ${destinationPoint.x},${destinationPoint.y + 22} ${destinationPoint.x - 22},${destinationPoint.y}`
  return <div className="outdoor-route-map" role="img" aria-label={`${fromLabel}から${toLabel}までの実地図と徒歩ルート`}><div className="outdoor-map-tiles">{Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, column) => { const x = tileX - 2 + column, y = tileY - 2 + row; return <img key={`${x}-${y}`} src={OSM_TILE_URL.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y))} alt="" style={{ left: x * 256 - centerX + OUTDOOR_MAP_VIEW.width / 2, top: y * 256 - centerY + OUTDOOR_MAP_VIEW.height / 2 }} /> }))}</div><svg viewBox={`0 0 ${OUTDOOR_MAP_VIEW.width} ${OUTDOOR_MAP_VIEW.height}`} preserveAspectRatio="none"><polyline className="route-outline" points={routePoints} fill="none" stroke="#fff" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" /><polyline className="route-core" points={routePoints} fill="none" stroke="#d4482f" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" /><circle className="start-marker" cx={startPoint.x} cy={startPoint.y} r="18" fill="#135c38" stroke="#fff" strokeWidth="4" /><circle className="start-marker-core" cx={startPoint.x} cy={startPoint.y} r="6" fill="#fff" /><polygon className="goal-marker" points={destinationDiamond} fill="#d4482f" stroke="#fff" strokeWidth="4" /><circle className="goal-marker-core" cx={destinationPoint.x} cy={destinationPoint.y} r="6" fill="#fff" /><g className="outdoor-map-label start-label"><rect x={startPoint.x - 92} y={startPoint.y - 58} width="184" height="34" rx="8" /><text x={startPoint.x} y={startPoint.y - 35}>出発　{fromLabel}</text></g><g className="outdoor-map-label destination"><rect x={destinationPoint.x - 82} y={destinationPoint.y + 24} width="164" height="34" rx="8" /><text x={destinationPoint.x} y={destinationPoint.y + 47}>到着　{toLabel}</text></g></svg><small className="outdoor-map-attribution">© OpenStreetMap contributors　／　地図：OpenStreetMap</small></div>
}

function FrontPage({ guide, slowWalking }: { guide: PrintableGuide; slowWalking: boolean }) {
  const leg = guide.trip.legs[0]
  return <article className="paper front-page"><header><span>おでかけ紙　表</span><span>{guide.trip.serviceDate}</span></header><DataStatusWarning guide={guide} /><h1>今日は<br />{guide.trip.destinationLabel}へ</h1><div className="goal">着きたい時刻　<strong>{guide.trip.arriveBy}</strong></div><section className="action"><b>1. 家を出る</b><strong>{guide.trip.leaveHomeAt}</strong></section><section className="action"><b>2. 大和駅で</b><strong>{leg.platform}</strong><em>{leg.direction}</em></section><section className="action"><b>3. {leg.service}に乗る</b><strong>{leg.boardAt}</strong><em>{leg.from.name} → {leg.to.name}</em></section><section className="action"><b>4. 降りる駅</b><strong>{leg.to.name}</strong><em>{leg.alightAt}</em></section><section className="station"><h2>5. 駅の中では</h2>{guide.stationGuide.steps.map((step, index) => <p key={step.id}><span>{index + 1}</span>{step.instruction}</p>)}</section><section className="safe"><b>迷ったら</b><p>{guide.stationGuide.safeAlternative}</p></section></article>
}

function BackPage({ guide, slowWalking }: { guide: PrintableGuide; slowWalking: boolean }) {
  const minutes = Math.ceil(guide.walkingRoute.baseMinutes * (slowWalking ? guide.walkingRoute.slowWalkingMultiplier : 1))
  return <article className="paper back-page"><header><span>おでかけ紙　裏</span><span>高座渋谷駅 西口から</span></header><DataStatusWarning guide={guide} /><h1>駅を出たら<br />学習センターまで歩く</h1><div className="walk-time">ゆっくり歩いて <strong>約{minutes}分</strong><small>（{guide.walkingRoute.distanceMeters}m・fixtureの目安）</small></div><WalkingMap /><ol className="walk-steps">{guide.walkingRoute.directions.map(step => <li key={step}>{step}</li>)}</ol><section className="safe"><b>迷ったら</b><p>近くの人やお店の人に「大和市渋谷学習センターはどこですか」と、この紙を見せて聞いてください。</p></section></article>
}

/** A StationGuide alone must not be mixed with an unrelated train or walking fixture. */
function paperSections(guide: StationGuide, levelTransitionOnlyHome: boolean) {
  const gateIndex = guide.steps.findIndex(step => step.facility === 'gate')
  const hidden = levelTransitionOnlyHome
    ? new Set(guide.steps.slice(0, gateIndex >= 0 ? gateIndex : guide.steps.length).map(step => step.id))
    : new Set<string>()
  let number = 0
  return (guide.sections ?? []).map(section => ({
    ...section,
    steps: section.steps.filter(step => !hidden.has(step.id)).map(step => ({ step, number: ++number })),
  })).filter(section => section.steps.length > 0)
}

function IndoorStationPaper({ stationGuide, graph, connection, departurePlatform, arrivalPlatformFloor, elderlyRecommendation, levelTransitionConsensus, humanizeWalkDistance = false, humanizeGateDirection = false }: { stationGuide: StationGuide; graph?: IndoorGraph; connection?: ArrivalPlatformConnection; departurePlatform?: OfficialDeparturePlatformAssignment; arrivalPlatformFloor?: OutingCoursePreset['arrivalPlatformFloor']; elderlyRecommendation?: typeof elderlyRouteRecommendations[string]; levelTransitionConsensus?: PlatformGateLevelConsensus | null; humanizeWalkDistance?: boolean; humanizeGateDirection?: boolean }) {
  const leg = connection?.leg
  const directed = graph ? withFareGateExitDirections(stationGuide, graph, { enabled: humanizeGateDirection }) : stationGuide
  const presentation = withStationGuidePresentation(withWalkDistanceInstructions(directed, { enabled: humanizeWalkDistance }))
  // The first semantic edge may begin after a common-prefix compression. Use
  // the registered platform's boarding-area nodes for the floor check instead
  // of assuming that edge evidence starts at the platform itself.
  const corroboratedFloor = arrivalPlatformFloor && connection && graph
    && [...graph.nodes.values()].some(node => node.parentPlatformId === connection.platformId && node.levelIndex === arrivalPlatformFloor.levelIndex)
    ? arrivalPlatformFloor.label
    : undefined
  const summary = presentation.summary!
  const levelTransitionOnlyHome = elderlyRecommendation?.paperDisplay === 'level-transition-only' && Boolean(levelTransitionConsensus)
  const officialLayeredRejoin = elderlyRecommendation?.paperDisplay === 'official-layered-rejoin' && Boolean(levelTransitionConsensus)
  const carPositionOnly = elderlyRecommendation?.paperDisplay === 'car-position-only'
  const hideHomeDetails = (levelTransitionOnlyHome || officialLayeredRejoin || carPositionOnly) && Boolean(levelTransitionConsensus)
  const layeredOfficial = elderlyRecommendation?.equipmentRelation === 'official-layered' && Boolean(levelTransitionConsensus) && !levelTransitionOnlyHome && !carPositionOnly
  const displayElderlyRecommendation = elderlyRecommendation && !levelTransitionOnlyHome && (carPositionOnly || elderlyRecommendation.equipmentRelation !== 'official-layered' || layeredOfficial) ? elderlyRecommendation : undefined
  const sections = paperSections(presentation, hideHomeDetails)
  const visibleFareGateCount = countVisibleFareGateSteps(sections.flatMap(section => section.steps.map(({ step }) => step)))
  const displayFareGateCount = visibleFareGateCount > 0 ? visibleFareGateCount : summary.fareGateCount
  const displaySummaryParts = [summary.escalatorCount && `エスカレーター${summary.escalatorCount}回`, summary.stairsCount && `階段${summary.stairsCount}回`, summary.elevatorCount && `エレベーター${summary.elevatorCount}回`, formatFareGateSummary(displayFareGateCount)].filter(Boolean).join('・')
  const layeredStation = levelTransitionSummaryStationIds.has(connection?.assignment.stationId ?? '')
  const visiblePostGateSummary = summarizeVisiblePostGateSteps(sections.find(section => section.id === 'gate-to-exit')?.steps.map(({ step }) => step) ?? [])
  const carPositionLabel = displayElderlyRecommendation && (displayElderlyRecommendation.carPosition.endsWith('付近') ? displayElderlyRecommendation.carPosition : `${displayElderlyRecommendation.carPosition}付近`)
  const homeEquipmentInstruction = layeredOfficial && displayElderlyRecommendation
    ? `${carPositionLabel}の${displayElderlyRecommendation.equipment}で改札階へ上がる`
    : undefined
  const abstractLevelInstruction = levelTransitionConsensus && (levelTransitionOnlyHome || carPositionOnly || (!layeredOfficial && !displayElderlyRecommendation))
    ? 'ホームから改札階へ上がる'
    : undefined
  return (
    <article className="paper arrival-station-paper front-page">
      <header><span>迷わないおでかけ紙　表</span><span>到着駅の案内</span></header>
      {leg && <section className="arrival-train"><b>電車</b><strong>{leg.from.stationName} {leg.from.departureTime}発</strong>{departurePlatform && <strong className="departure-platform">{formatBoardingHomeAction(departurePlatform.platformCode)}</strong>}{displayElderlyRecommendation && <p className="elderly-route-note departure-car-note"><b>できれば{displayElderlyRecommendation.carPosition}に乗る</b>{!layeredOfficial && !carPositionOnly && <span>{displayElderlyRecommendation.equipmentRelation === 'official-options' ? `${displayElderlyRecommendation.targetGate}へ（${displayElderlyRecommendation.equipment}）` : `${displayElderlyRecommendation.equipment}で${displayElderlyRecommendation.targetGate}へ`}</span>}</p>}<span>{leg.routeName}　{leg.headsign}行</span><strong>{leg.to.stationName} {leg.to.arrivalTime}着</strong></section>}
      {connection && <section className="arrival-platform"><strong>{formatAlightingHomeAction(presentation.arrivalPlatform, corroboratedFloor)}</strong></section>}
      {presentation.exit && <p className="arrival-goal">目指す出口：<b>{formatExitLabel(presentation.exit)}</b></p>}
      {layeredStation ? visiblePostGateSummary && <section className="arrival-summary"><b>改札から出口まで</b><span>{visiblePostGateSummary}</span></section> : <section className="arrival-summary"><b>出口まで</b><span>{displaySummaryParts || '構内の設備情報はありません'}</span></section>}
      <div className="arrival-sections">{sections.map(section => <section className="arrival-section" key={section.id}><h2>{section.title}</h2>{section.id === 'platform-to-gate' && (homeEquipmentInstruction || abstractLevelInstruction) && <p className="home-equipment-note"><b>{homeEquipmentInstruction ?? abstractLevelInstruction}</b></p>}{section.id === 'gate-to-exit' && elderlyRecommendation?.timeLimit && <p className="home-equipment-note"><b>※{elderlyRecommendation.timeLimit}</b></p>}{section.steps.map(({ step, number }) => <p key={step.id}><span>{number}</span>{step.facility === 'exit' ? formatExitAction(presentation.exit) : step.instruction}</p>)}</section>)}</div>
    </article>
  )
}

/** Outdoor instructions retain their own destination-published provenance, separate from GTFS. */
function OutdoorWalkingPaper({ route }: { route: WalkingRoute }) {
  const slowMinutes = Math.ceil(route.baseMinutes * route.slowWalkingMultiplier)
  const geometry = route.geometry
  return <article className="paper walking-back-paper back-page"><header><span>迷わないおでかけ紙　裏</span><span>駅を出てから</span></header><h1>{route.from.label}から<br />{route.to.label}まで歩く</h1><div className="walk-time">{route.timeBasis === 'official' ? '公式の目安' : '徒歩ルートの目安'} <strong>約{route.baseMinutes}分</strong><small>ゆっくり歩く目安：約{slowMinutes}分</small></div>{geometry ? <OutdoorRouteMap route={{ ...geometry, from: [route.from.longitude!, route.from.latitude!], to: [route.to.longitude!, route.to.latitude!] }} fromLabel={route.from.label} toLabel={route.to.label} /> : <section className="walking-route-map" aria-label="徒歩経路の概略"><div>{route.from.label}</div><b>↓</b><div className="walking-route-road">公式案内に沿って歩く</div><b>↓</b><div className="destination">{route.to.label}</div></section>}<section className="arrival-steps walking-steps"><h2>駅を出たら</h2>{route.directions.map((direction, index) => <p key={direction}><span>{index + 1}</span>{direction}</p>)}</section></article>
}

/** A sequence diagram, not a geographic map: no unavailable geometry is fabricated. */
function CompactWalkingDiagram() {
  return <div className="compact-walking-map" role="img" aria-label="赤羽橋口から東京タワーまでの徒歩経路図。縮尺や方位は示さない。"><div>赤羽橋口</div><i>↓</i><div>横断歩道を2回</div><i>↓</i><div>ガソリンスタンドを左に</div><i>↓</i><div>公園の木を左に</div><i>↓</i><div className="destination">東京タワー</div><small>縮尺・方位なし／公式アクセス案内の順序図</small></div>
}

/** The one-page paper is intentionally focused on the station guide; provenance stays compact. */
function CompactTripPaper({ stationGuide, connection, contact }: { stationGuide: StationGuide; connection: ArrivalPlatformConnection; contact: string }) {
  const walking = akabanebashiToTokyoTowerWalkingRoute
  const slowMinutes = Math.ceil(walking.baseMinutes * walking.slowWalkingMultiplier)
  return <article className="paper compact-trip-paper"><header><span>迷わないおでかけ紙　往路</span><span>検証用</span></header><h1>東京タワーへ行く</h1><section className="compact-train"><b>1. 電車に乗る</b><strong>{connection.leg.from.stationName} {connection.leg.from.departureTime}発</strong><span>{connection.leg.routeName}　{connection.leg.headsign}行　→　{connection.leg.to.stationName} {connection.leg.to.arrivalTime}着</span></section><section className="compact-indoor"><div className="compact-platform"><b>到着ホーム</b><strong>{stationGuide.arrivalPlatform}</strong><span>目標：{stationGuide.exit}</span></div><ol>{stationGuide.steps.map((step, index) => <li key={step.id}><span>{index + 1}</span>{step.instruction}</li>)}</ol></section><section className="compact-outdoor"><h2>3. 赤羽橋口を出たら　東京タワーまで歩く</h2><div className="compact-outdoor-content"><CompactWalkingDiagram /><div><p className="compact-walk-time">公式の目安：徒歩約{walking.baseMinutes}分<br /><small>ゆっくり歩く目安：約{slowMinutes}分</small></p><ol>{walking.directions.slice(0, 3).map(direction => <li key={direction}>{direction}</li>)}</ol><p className="compact-arrival">公園の木が左に見える歩道を進み、交差点で左へ。少し進むと東京タワーです。</p></div></div></section><section className="compact-help"><b>迷ったら</b> 駅では案内表示または係員へ。駅の外では「東京タワーへの行き方」をこの紙を見せて聞いてください。</section></article>
}

function ReviewerAnchorPanel({ dataset, graph, onApplyToPaper }: { dataset: IndoorStationDataset; graph: IndoorGraph; onApplyToPaper?: (guide: StationGuide) => void }) {
  const platforms = [...graph.nodes.values()].filter(node => node.kind === 'platform')
  const exits = [...graph.nodes.values()].filter(node => node.kind === 'entrance-exit')
  const [platformId, setPlatformId] = useState(platforms[0]?.id ?? '')
  const origins = platformOriginNodes(graph, platformId)
  const [boardingAreaId, setBoardingAreaId] = useState(origins[0]?.id ?? '')
  const [exitNodeId, setExitNodeId] = useState(exits[0]?.id ?? '')
  const [confirmed, setConfirmed] = useState(false)
  const [saved, setSaved] = useState(false)
  const [anchor, setAnchor] = useState<Omit<VerifiedIndoorRouteAnchor, 'stationId' | 'platformId' | 'boardingAreaId' | 'exitNodeId'>>({ verifiedBy: '', verifiedAt: '', evidenceUrl: '' })
  const [details, setDetails] = useState<VerifiedStationGuideDetails>({ arrivalPlatformLabel: '', gateLabel: '', exitLabel: '', safeAlternative: '' })
  const storageKey = `odekake.indoor-review.${dataset.key}.v1`
  useEffect(() => {
    try {
      const value = window.localStorage.getItem(storageKey)
      if (!value) return
      const record = JSON.parse(value) as { anchor?: VerifiedIndoorRouteAnchor; details?: VerifiedStationGuideDetails }
      if (!record.anchor || !record.details || record.anchor.stationId !== dataset.station.id) return
      setPlatformId(record.anchor.platformId); setBoardingAreaId(record.anchor.boardingAreaId); setExitNodeId(record.anchor.exitNodeId)
      setAnchor({ verifiedBy: record.anchor.verifiedBy, verifiedAt: record.anchor.verifiedAt, evidenceUrl: record.anchor.evidenceUrl })
      setDetails(record.details); setConfirmed(true); setSaved(true)
    } catch { window.localStorage.removeItem(storageKey) }
  }, [dataset.station.id, storageKey])
  useEffect(() => { if (!origins.some(origin => origin.id === boardingAreaId)) setBoardingAreaId(origins[0]?.id ?? '') }, [boardingAreaId, origins])
  const result = useMemo(() => !confirmed ? null : buildVerifiedStationGuide(graph, dataset.station, { stationId: dataset.station.id, platformId, boardingAreaId, exitNodeId, ...anchor }, details), [anchor, boardingAreaId, confirmed, dataset.station, details, exitNodeId, graph, platformId])
  const markDirty = () => setSaved(false)
  const save = () => { if (!result?.ok) return; window.localStorage.setItem(storageKey, JSON.stringify({ anchor: { stationId: dataset.station.id, platformId, boardingAreaId, exitNodeId, ...anchor }, details })); setSaved(true) }
  const clear = () => { window.localStorage.removeItem(storageKey); setSaved(false) }
  return <details className="review-panel"><summary>レビュー担当者用：確認済みアンカーを試す</summary><p>公式根拠と現地確認を済ませた担当者だけが入力します。{saved ? ' このブラウザにレビュー記録を保存済みです。' : ' 未保存です。'} 先頭の候補は便宜上の初期値であり、降車位置を示すものではありません。</p><div className="review-fields"><label>ホーム<select value={platformId} onChange={event => { markDirty(); setPlatformId(event.target.value) }}>{platforms.map(platform => <option key={platform.id} value={platform.id}>{platform.platformCode ? `${platform.platformCode}番ホーム` : platform.id}</option>)}</select></label><label>正確な乗降位置<select value={boardingAreaId} onChange={event => { markDirty(); setBoardingAreaId(event.target.value) }}>{origins.map(origin => <option key={origin.id} value={origin.id}>{origin.id}</option>)}</select></label><label>出口<select value={exitNodeId} onChange={event => { markDirty(); setExitNodeId(event.target.value) }}>{exits.map(exit => <option key={exit.id} value={exit.id}>{exit.name ?? exit.id}</option>)}</select></label><label>確認者<input value={anchor.verifiedBy} onChange={event => { markDirty(); setAnchor({ ...anchor, verifiedBy: event.target.value }) }} /></label><label>確認日<input type="date" value={anchor.verifiedAt} onChange={event => { markDirty(); setAnchor({ ...anchor, verifiedAt: event.target.value }) }} /></label><label>公式根拠URL<input type="url" value={anchor.evidenceUrl} onChange={event => { markDirty(); setAnchor({ ...anchor, evidenceUrl: event.target.value }) }} /></label><label>紙のホーム表記<input value={details.arrivalPlatformLabel} onChange={event => { markDirty(); setDetails({ ...details, arrivalPlatformLabel: event.target.value }) }} /></label><label>紙の改札表記<input value={details.gateLabel} onChange={event => { markDirty(); setDetails({ ...details, gateLabel: event.target.value }) }} /></label><label>紙の出口表記<input value={details.exitLabel} onChange={event => { markDirty(); setDetails({ ...details, exitLabel: event.target.value }) }} /></label><label className="wide">迷った場合の案内<input value={details.safeAlternative} onChange={event => { markDirty(); setDetails({ ...details, safeAlternative: event.target.value }) }} /></label></div><label className="review-check"><input type="checkbox" checked={confirmed} onChange={event => { markDirty(); setConfirmed(event.target.checked) }} />公式根拠と現地確認を完了したと、担当者として確認します。</label>{result && (result.ok ? <section className="review-guide-preview"><p className="review-ok">構造化StationGuideを生成しました。</p><dl><div><dt>到着ホーム</dt><dd>{result.guide.arrivalPlatform}</dd></div><div><dt>改札</dt><dd>{result.guide.gate}</dd></div><div><dt>出口</dt><dd>{result.guide.exit}</dd></div></dl><ol>{result.guide.steps.map(step => <li key={step.id}>{step.instruction}<small>{step.evidence?.source === 'gtfs-pathways' ? ` 根拠: ${step.evidence.edgeIds?.join(', ')}` : ' 根拠: 人手レビュー'}</small></li>)}</ol><div className="review-actions">{onApplyToPaper && <button type="button" onClick={() => onApplyToPaper(result.guide)}>A4プレビューへ反映</button>}<button type="button" onClick={save}>このレビュー記録を保存</button>{saved && <button type="button" onClick={clear}>保存記録を削除</button>}</div></section> : <p className="poc-unsupported">生成しません：{result.reason}</p>)}</details>
}

function IndoorPoc() {
  const [selectedKey, setSelectedKey] = useState(loadedOedo2026IndoorDatasets[0].key)
  const [preference, setPreference] = useState<RoutePreference>('shortest')
  const dataset = loadedOedo2026IndoorDatasetByKey.get(selectedKey) ?? loadedOedo2026IndoorDatasets[0]
  const graph = useMemo(() => buildIndoorGraph(dataset.gtfs), [dataset])
  const audit = useMemo(() => auditIndoorGraph(dataset.gtfs, graph), [dataset, graph])
  const platforms = [...graph.nodes.values()].filter(node => node.kind === 'platform')
  const exits = [...graph.nodes.values()].filter(node => node.kind === 'entrance-exit')
  const diagnosticPlatform = platforms[0]
  const diagnosticExit = exits[0]
  const preferenceSupport = routePreferenceSupport(preference)
  const platformOrigins = useMemo(() => diagnosticPlatform ? platformOriginNodes(graph, diagnosticPlatform.id) : [], [diagnosticPlatform, graph])
  const platformRoutes = useMemo(() => preferenceSupport.supported && diagnosticPlatform && diagnosticExit ? findRoutesFromPlatform(graph, diagnosticPlatform.id, diagnosticExit.id, preference) : [], [diagnosticExit, diagnosticPlatform, graph, preference, preferenceSupport.supported])
  const sharedTail = useMemo(() => commonRouteSuffix(platformRoutes.map(candidate => candidate.route)), [platformRoutes])
  const validationRoute = useMemo(() => preferenceSupport.supported && platformOrigins[0] && diagnosticExit ? findIndoorRoute(graph, platformOrigins[0].id, diagnosticExit.id, preference) : null, [diagnosticExit, graph, platformOrigins, preference, preferenceSupport.supported])
  const modes = Object.entries(graph.edges.reduce<Record<string, number>>((counts, edge) => ({ ...counts, [edge.movementType]: (counts[edge.movementType] ?? 0) + 1 }), {}))
  const isAkabanebashi = dataset.key === 'akabanebashi'
  const walkingNetwork = useMemo(() => isAkabanebashi ? buildWalkingNetworkGraph(akabanebashiWalkingNetworkFixture) : null, [isAkabanebashi])
  const stationMapFacilities = useMemo(() => isAkabanebashi ? normalizeStationMapFacilities(akabanebashiStationMapFixture) : [], [isAkabanebashi])
  const allValidation = useMemo(() => validateIndoorDatasets(loadedOedo2026IndoorDatasets), [])
  const loadedCount = allValidation.filter(item => item.loaded).length
  const routedCount = allValidation.filter(item => item.routeGenerated).length
  const failedRoutes = allValidation.filter(item => !item.routeGenerated)
  return <section className="indoor-poc no-print"><div><p className="eyebrow">駅構内ルーティング PoC</p><h2>{dataset.station.name}駅：共通GTFS-Pathwaysモデル</h2><p>出典：{graph.source.name}（feed version {graph.source.feedVersion}、{graph.source.license}）。実エッジだけを扱い、共通末尾に加えて候補経路で確認された改札イベントを provenance 付きで保持します。正確な降車位置を起点にする案内は、別途レビューが必要です。</p></div><p className="network-note"><b>{loadedCount}/12駅 読込成功</b> ／ <b>{routedCount}/12駅 ホーム→出口StationGuide生成成功</b>{failedRoutes.length ? ` ／ 未生成：${failedRoutes.map(item => `${item.stationName}（${item.routeFailureReason}）`).join('、')}` : ''}</p><label className="poc-control">検証する駅<select value={selectedKey} onChange={event => setSelectedKey(event.target.value)}>{oedo2026StationAvailability.map(station => <option key={station.key} value={station.key} disabled={!station.dataset}>{station.name}{station.dataset ? '（GTFS fixture取込済み）' : '（未取込）'}</option>)}</select></label><div className="poc-stats"><span><b>{graph.nodes.size}</b> GTFSノード</span><span><b>{dataset.gtfs.pathways.length}</b> GTFS原本経路</span><span><b>{graph.edges.length}</b> GTFS有向エッジ</span></div><label className="poc-control">検証する経路選好<select value={preference} onChange={event => setPreference(event.target.value as RoutePreference)}><option value="shortest">最短</option><option value="avoid-stairs">階段を避ける</option><option value="elevator-priority">エレベーター優先</option><option value="wheelchair-accessible">車椅子対応</option></select></label>{!preferenceSupport.supported && <p className="poc-unsupported"><b>探索しません。</b> {preferenceSupport.reason}</p>}<p className="network-note">公開対象12駅のGTFS-Pathways fixtureを同じ登録簿から読み込んでいます。残りの駅も個別ロジックを追加せず、選択・グラフ生成・診断に同じ処理を使います。</p>{walkingNetwork && <p className="network-note">赤羽橋駅だけは別途、歩行空間ネットワークfixture {akabanebashiWalkingNetworkFixture.nodes.length} ノード／{akabanebashiWalkingNetworkFixture.links.length} リンクも確認中です。GTFSとのID対応が未確認のため、グラフ結合はしません。</p>}{stationMapFacilities.length > 0 && <p className="network-note">赤羽橋駅の構内地図fixture設備POI：{stationMapFacilities.length}件。GTFSとのID対応が未確認のため、表示・確認用です。</p>}<div className="poc-grid"><section><h3>読み取れた経路種別</h3><p>{modes.map(([mode, count]) => `${({ walk: '通路', stairs: '階段', 'moving-walkway': '動く歩道', escalator: 'ES', elevator: 'EV', 'fare-gate': '改札', 'exit-gate': '退出改札' } as Record<string, string>)[mode]} ${count}`).join(' ／ ')}</p><p>緯度・経度と階層は各ノードに保持します。方向表示は分岐・距離・地図空間の条件を満たす場合だけ生成し、それ以外は表示しません。</p></section><section className="poc-block"><h3>安全ゲート：ホーム起点</h3><p>診断対象の{diagnosticPlatform?.platformCode ? `${diagnosticPlatform.platformCode}番ホーム` : 'ホーム'}には boarding area が {platformOrigins.length} 件あります。出口への候補経路は {platformRoutes.length} 件です。</p><p><b>候補のうち一つを自動採用しません。</b> 実際の列車の降車位置はGTFS-Pathwaysにないためです。</p><p>候補経路の共通末尾：{sharedTail.length}エッジ。利用者向け名称の根拠がない区間は紙面に載せません。確認済み起点レコード：{dataset.reviewedAnchors.length}件。</p><p>監査結果：ホーム {audit.platforms.length}件中、出口へ到達できないもの {audit.platformsWithoutExitRoute.length}件。</p></section></div><ReviewerAnchorPanel key={dataset.key} dataset={dataset} graph={graph} />{validationRoute && <section className="validation"><h3>検証用の接続済みノード経路（利用者向けではありません）</h3><p>{validationRoute.nodes[0].id} → {diagnosticExit?.name ?? diagnosticExit?.id}：{validationRoute.distanceMeters.toFixed(1)}m。Dijkstraは実エッジだけで実行しています。</p><ol>{compactIndoorRouteSteps(validationRoute).map((step, index) => <li key={`${step.evidence.edgeIds[0]}-${index}`}>{formatIndoorStep(step)} <small>根拠: {step.evidence.edgeIds.join(', ')}</small></li>)}</ol></section>}</section>
}

const searchReasonText: Record<Exclude<ReturnType<typeof staticGtfsRailJourneyRepository.findDirectJourney>, { ok: true }>['reason'], string> = {
  'invalid-date': '出発日または時刻の形式を確認してください。',
  'weekend-not-supported': 'このPoCは平日ダイヤだけに対応しています。',
  'outside-feed-validity': '入力日は取り込み済みGTFSの有効期間外です。',
  'unsupported-station-pair': 'このローカル時刻表では、指定区間の直通便を検索できません。',
  'no-scheduled-trip': '入力時刻以降の取り込み済み列車がありません。',
}

function UnavailableCoursePaper({ course, reason, back = false }: { course: OutingCoursePreset; reason: string; back?: boolean }) {
  return <article className={`paper ${back ? 'back-page' : 'front-page'} unavailable-course-paper`}><header><span>迷わないおでかけ紙　{back ? '裏' : '表'}</span><span>{course.label}</span></header><h1>{back ? `${course.destination.name}まで歩く` : `${course.originStationName}から${course.arrivalStationName}へ`}</h1><section className="course-unavailable"><b>このコースは未確定です</b><p>{reason}</p><p>{course.originStationName} → {course.arrivalStationName} → {course.destination.name}</p></section></article>
}

export default function App() {
  const defaultCourse = outingCoursePresets[0]
  const [selectedCourseId, setSelectedCourseId] = useState(defaultCourse.id)
  const course = outingCoursePresetById.get(selectedCourseId) ?? defaultCourse
  const [query, setQuery] = useState<RailJourneyQuery>({ originName: course.originStationName, destinationName: course.arrivalStationName, departureDate: '2026-09-21', departureTime: '07:00' })
  const courseScrollerRef = useRef<HTMLDivElement>(null)
  const searchResult = useMemo(() => staticGtfsRailJourneyRepository.findDirectJourney(query), [query])
  const itineraryGuide = useMemo(() => {
    if (course.unavailableReason) return { ok: false as const, reason: course.unavailableReason }
    if (!searchResult.ok) return { ok: false as const, reason: searchReasonText[searchResult.reason] }
    // Train search is independent from the later platform/exit/walking data.
    // Keep a verified train result visible in the diagnostic reason even when
    // the rest of a course is intentionally not yet generated.
    if (!course.walkingRoute || !course.preferredExitId || course.arrivalPlatformAssignments.length === 0) {
      return { ok: false as const, reason: `列車 ${searchResult.leg.tripId} は ${searchResult.leg.from.stationName} ${searchResult.leg.from.departureTime}発 → ${searchResult.leg.to.stationName} ${searchResult.leg.to.arrivalTime}着（${searchResult.leg.headsign}行）として検索できました。ただし、公式ホーム・出口・徒歩routeが未登録のため、構内・徒歩案内は生成しません。` }
    }
    const dataset = loadedOedo2026IndoorDatasets.find(item => item.station.id === course.arrivalStationId)
    if (!dataset) return { ok: false as const, reason: '到着駅のGTFS-Pathways fixtureが未取込です。' }
    const arrival = resolveArrivalPlatform(searchResult.leg, dataset.station.id, course.arrivalPlatformAssignments)
    if (!arrival.ok || !course.preferredExitId) return { ok: false as const, reason: '公式の到着ホームまたは出口が未登録です。推測して案内を生成しません。' }
    const departure = resolveDeparturePlatform(searchResult.leg, searchResult.leg.from.stationId, course.departurePlatformAssignments)
    const graph = buildIndoorGraph(dataset.gtfs)
    const compressionContext = dataset.key === 'akabanebashi'
      ? buildAkabanebashiStationMapCompressionContext(graph)
      : dataset.station.id === '424'
        ? buildRoppongiStationMapCompressionContext(graph)
        : dataset.station.id === '426'
          ? buildKokuritsuKyogijoStationMapCompressionContext(graph)
          : dataset.station.id === '421'
            ? buildDaimonStationMapCompressionContext(graph)
            : dataset.station.id === '423'
              ? buildAzabuJubanStationMapCompressionContext(graph)
              : dataset.station.id === '427'
                ? buildYoyogiStationMapCompressionContext(graph)
              : dataset.station.id === '403'
                  ? buildHigashiShinjukuStationMapCompressionContext(graph)
              : dataset.station.id === '425'
                    ? buildAoyamaItchomeStationMapCompressionContext(graph)
                    : dataset.station.id === '428'
                      ? buildShinjukuStationMapCompressionContext(graph)
                        : dataset.station.id === '402'
                        ? buildShinjukuNishiguchiStationMapCompressionContext(graph)
                        : dataset.station.id === '410'
                          ? buildUenoOkachimachiStationMapCompressionContext(graph)
                          : dataset.station.id === '429'
                            ? buildTochomaeStationMapCompressionContext(graph)
                        : undefined
    const elderlyEnabled = ['421', '423', '424', '426', '427', '429', '403'].includes(dataset.station.id)
    const elderlyScore = elderlyEnabled ? findBestElderlyRoute(graph, arrival.connection.platformId, Array.isArray(course.preferredExitId) ? course.preferredExitId : [course.preferredExitId], compressionContext) : null
    const stationGuide = elderlyScore
      ? buildGtfsStationGuideFromRoute(graph, dataset.station, { platformId: arrival.connection.platformId, exitNodeId: elderlyScore.exitId }, elderlyScore.route, compressionContext)
      : buildGtfsStationGuide(graph, dataset.station, { platformId: arrival.connection.platformId, exitNodeId: course.preferredExitId }, 'shortest', compressionContext)
    const levelTransitionConsensus = levelTransitionSummaryStationIds.has(dataset.station.id)
      ? findPlatformGateLevelConsensus(graph, arrival.connection.platformId, Array.isArray(course.preferredExitId) ? course.preferredExitId : [course.preferredExitId])
      : null
    return stationGuide.ok ? { ok: true as const, guide: stationGuide.guide, graph, connection: arrival.connection, departurePlatform: departure.ok ? departure.assignment : undefined, walkingRoute: course.walkingRoute, elderlyScore: elderlyScore ?? undefined, elderlyRecommendation: elderlyRouteRecommendations[dataset.station.id], levelTransitionConsensus } : { ok: false as const, reason: '公式GTFS-Pathwaysからホーム共通区間を解決できませんでした。' }
  }, [course, defaultCourse.id, query, searchResult])
  const selectCourse = (courseId: string) => {
    const next = outingCoursePresetById.get(courseId) ?? defaultCourse
    setSelectedCourseId(next.id)
    setQuery(current => ({ ...current, originName: next.originStationName, destinationName: next.arrivalStationName }))
    window.requestAnimationFrame(() => {
      courseScrollerRef.current?.querySelector<HTMLElement>(`[data-course-id="${next.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    })
  }
  const selectAdjacentCourse = (direction: -1 | 1) => {
    const currentIndex = outingCoursePresets.findIndex(item => item.id === course.id)
    const nextIndex = (currentIndex + direction + outingCoursePresets.length) % outingCoursePresets.length
    selectCourse(outingCoursePresets[nextIndex].id)
  }
  return <main><IndoorPoc /><section className="editor no-print course-picker"><div><p className="eyebrow">おでかけ先を選ぶ</p><div className="course-selector"><span>コース一覧</span><div className="course-picker-row"><button type="button" className="course-scroll-button" aria-label="前のコースを選択" onClick={() => selectAdjacentCourse(-1)}>‹</button><div className="course-options" ref={courseScrollerRef} role="group" aria-label="おでかけコース">{outingCoursePresets.map(item => <button key={item.id} data-course-id={item.id} type="button" className={item.id === course.id ? 'course-option is-selected' : 'course-option'} aria-pressed={item.id === course.id} onClick={() => selectCourse(item.id)}><span className="course-option-destination">{item.label}</span><small className="course-option-station">（{item.arrivalStationName}駅）</small></button>)}</div><button type="button" className="course-scroll-button" aria-label="次のコースを選択" onClick={() => selectAdjacentCourse(1)}>›</button></div></div><h1>{itineraryGuide.ok ? `${course.label}への往路を接続中` : `${course.label}コース`}</h1><p>{itineraryGuide.ok ? `列車 ${itineraryGuide.connection.leg.tripId}から${course.arrivalStationName}駅の構内案内へ接続しています。` : itineraryGuide.reason}</p>{itineraryGuide.ok && itineraryGuide.elderlyScore && <p className="network-note"><b>高齢者向け route scoring:</b> {formatElderlyRouteScore(itineraryGuide.elderlyScore)}</p>}</div></section><section className="print-area"><div className="preview-pages">{itineraryGuide.ok && itineraryGuide.walkingRoute ? <><IndoorStationPaper stationGuide={itineraryGuide.guide} graph={itineraryGuide.graph} connection={itineraryGuide.connection} departurePlatform={itineraryGuide.departurePlatform} arrivalPlatformFloor={course.arrivalPlatformFloor} elderlyRecommendation={itineraryGuide.elderlyRecommendation} levelTransitionConsensus={itineraryGuide.levelTransitionConsensus} humanizeWalkDistance humanizeGateDirection /><OutdoorWalkingPaper route={itineraryGuide.walkingRoute} /></> : <><UnavailableCoursePaper course={course} reason={itineraryGuide.reason ?? '必要な情報が未登録です。'} /><UnavailableCoursePaper course={course} reason={itineraryGuide.reason ?? '必要な情報が未登録です。'} back /></>}</div></section></main>
}
