export interface AlternateExitPaperProps {
  stationName: string
  exitLabel: string
  destinationName: string
}

export function AlternateExitPaper({
  stationName,
  exitLabel,
  destinationName,
}: AlternateExitPaperProps) {
  return (
    <article className="paper walking-back-paper back-page alternate-exit-paper">
      <div className="alternate-exit-content">
        <div className="alternate-exit-header">
          <span className="alternate-exit-badge">出口自由選択</span>
          <h1>
            {stationName}駅 {exitLabel}から
            <br />
            地上へ出たあと
          </h1>
        </div>

        <div className="alternate-exit-notice">
          <div className="notice-icon">ℹ</div>
          <div className="notice-body">
            <strong>この出口からの個別徒歩地図は未登録です</strong>
            <p>
              「{destinationName}」への標準コースとは異なる出口が選択されました。地上に出た後は、駅前広場の案内板や周辺地図で目的地の方角をご確認ください。
            </p>
          </div>
        </div>

        <section className="alternate-exit-memo" aria-label="おでかけメモ">
          <h2>
            <span>✎</span> 本日のおでかけメモ
          </h2>
          <div className="memo-summary-row">
            <div className="memo-summary-item">
              <span className="memo-label">目的地</span>
              <strong className="memo-value">{destinationName}</strong>
            </div>
            <div className="memo-summary-item">
              <span className="memo-label">利用出口</span>
              <strong className="memo-value">{exitLabel}</strong>
            </div>
          </div>

          <div className="memo-fields">
            <div className="memo-field-group">
              <span className="memo-field-title">集合場所・待ち合わせ時間</span>
              <div className="memo-write-line" />
            </div>
            <div className="memo-field-group">
              <span className="memo-field-title">緊急連絡先・電話番号</span>
              <div className="memo-write-line" />
            </div>
            <div className="memo-field-group memo-fill-area">
              <span className="memo-field-title">メモ・予定・おみやげ</span>
              <div className="memo-lined-box">
                <div className="memo-ruled-line" />
                <div className="memo-ruled-line" />
                <div className="memo-ruled-line" />
                <div className="memo-ruled-line" />
                <div className="memo-ruled-line" />
                <div className="memo-ruled-line" />
              </div>
            </div>
          </div>
        </section>

        <footer className="alternate-exit-footer">
          <span>迷わないおでかけ紙 — 駅構内オープンデータ（GTFS-Pathways）より自動生成</span>
        </footer>
      </div>
    </article>
  )
}
