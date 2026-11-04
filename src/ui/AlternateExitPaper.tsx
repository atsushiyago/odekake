import { webMercatorPixel } from '../domain/outdoorMap'

export interface AlternateExitPaperProps {
  stationName: string
  exitLabel: string
  destinationName: string
  exitCoordinates?: { lat: number; lon: number }
}

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const MAP_VIEW = { width: 800, height: 420 }
const MAP_ZOOM = 17

function ExitSurroundingsMap({
  exitLabel,
  lat,
  lon,
}: {
  exitLabel: string
  lat: number
  lon: number
}) {
  const [centerX, centerY] = webMercatorPixel([lon, lat], MAP_ZOOM)
  const tileX = Math.floor(centerX / 256)
  const tileY = Math.floor(centerY / 256)

  const pinX = MAP_VIEW.width / 2
  const pinY = MAP_VIEW.height / 2

  return (
    <div
      className="exit-surroundings-map"
      role="img"
      aria-label={`${exitLabel}周辺の地図`}
    >
      <div className="outdoor-map-tiles">
        {Array.from({ length: 4 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => {
            const x = tileX - 2 + col
            const y = tileY - 1 + row
            return (
              <img
                key={`${x}-${y}`}
                src={OSM_TILE_URL.replace('{z}', String(MAP_ZOOM))
                  .replace('{x}', String(x))
                  .replace('{y}', String(y))}
                crossOrigin="anonymous"
                alt=""
                style={{
                  position: 'absolute',
                  width: 256,
                  height: 256,
                  left: x * 256 - centerX + MAP_VIEW.width / 2,
                  top: y * 256 - centerY + MAP_VIEW.height / 2,
                }}
              />
            )
          }),
        )}
      </div>

      <svg
        viewBox={`0 0 ${MAP_VIEW.width} ${MAP_VIEW.height}`}
        preserveAspectRatio="none"
        className="exit-map-svg"
      >
        <defs>
          <filter id="exit-pin-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Outer pulse circle */}
        <circle
          cx={pinX}
          cy={pinY}
          r="24"
          fill="#d4482f"
          fillOpacity="0.25"
        />

        {/* Pin base point */}
        <circle
          cx={pinX}
          cy={pinY}
          r="14"
          fill="#d4482f"
          stroke="#fff"
          strokeWidth="3.5"
          filter="url(#exit-pin-shadow)"
        />
        <circle cx={pinX} cy={pinY} r="5" fill="#fff" />

        {/* Pin label callout badge */}
        <g
          className="exit-pin-callout"
          transform={`translate(${pinX}, ${pinY - 26})`}
          filter="url(#exit-pin-shadow)"
        >
          {/* Label background pill */}
          <rect
            x="-110"
            y="-42"
            width="220"
            height="38"
            rx="8"
            fill="#d4482f"
            stroke="#fff"
            strokeWidth="2.5"
          />
          {/* Arrow pointing down to marker */}
          <polygon
            points="-8,-4 8,-4 0,4"
            fill="#d4482f"
          />
          <text
            x="0"
            y="-17"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="18"
            fontWeight="800"
            fontFamily="sans-serif"
          >
            📍 ここに出ます（{exitLabel}）
          </text>
        </g>
      </svg>

      <small className="outdoor-map-attribution">
        © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>　／　地図：OpenStreetMap
      </small>
    </div>
  )
}

export function AlternateExitPaper({
  stationName,
  exitLabel,
  destinationName,
  exitCoordinates,
}: AlternateExitPaperProps) {
  return (
    <article className="paper walking-back-paper back-page alternate-exit-paper">
      <div className="alternate-exit-content">
        <header className="alternate-exit-header">
          <h1>
            {stationName}駅 {exitLabel} 周辺図
          </h1>
          <p className="alternate-exit-subtitle">
            地上に出たあとの周辺案内と、本日の予定・手書きメモ欄
          </p>
        </header>

        {/* Upper half: Map */}
        <section className="alternate-exit-map-section" aria-label="出口周辺図">
          {exitCoordinates ? (
            <ExitSurroundingsMap
              exitLabel={exitLabel}
              lat={exitCoordinates.lat}
              lon={exitCoordinates.lon}
            />
          ) : (
            <div className="exit-map-fallback">
              <p>📍 {exitLabel} 付近の地図</p>
              <small>地上に出た後は駅前広場の案内表示板をご確認ください</small>
            </div>
          )}
        </section>

        {/* Lower half: Memo & Notes */}
        <section className="alternate-exit-memo" aria-label="おでかけメモ">
          <div className="memo-header-row">
            <h2>
              <span>✎</span> 本日のおでかけメモ
            </h2>
            <div className="memo-badges">
              <span className="memo-info-tag">目的地: <strong>{destinationName}</strong></span>
              <span className="memo-info-tag">出口: <strong>{exitLabel}</strong></span>
            </div>
          </div>

          <div className="memo-grid">
            <div className="memo-col">
              <div className="memo-field-group">
                <span className="memo-field-title">集合場所・待ち合わせ時間</span>
                <div className="memo-write-line" />
              </div>
              <div className="memo-field-group">
                <span className="memo-field-title">緊急連絡先（電話番号・家族など）</span>
                <div className="memo-write-line" />
              </div>
              <div className="memo-field-group">
                <span className="memo-field-title">持ち物・チェック</span>
                <div className="memo-checklist">
                  <span className="memo-check-item">□ 切符・交通系IC</span>
                  <span className="memo-check-item">□ 携帯電話・財布</span>
                  <span className="memo-check-item">□ 保険証・診察券</span>
                </div>
              </div>
            </div>

            <div className="memo-col">
              <div className="memo-field-group memo-fill-area">
                <span className="memo-field-title">予定・立ち寄り先・おみやげ</span>
                <div className="memo-lined-box">
                  <div className="memo-ruled-line" />
                  <div className="memo-ruled-line" />
                  <div className="memo-ruled-line" />
                  <div className="memo-ruled-line" />
                  <div className="memo-ruled-line" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="alternate-exit-footer">
          <span>迷わないおでかけ紙 — オープンデータ（GTFS-Pathways & OpenStreetMap）より自動生成</span>
        </footer>
      </div>
    </article>
  )
}
