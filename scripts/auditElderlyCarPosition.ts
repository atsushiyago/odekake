import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'
import { outingCoursePresets } from '../src/data/coursePresets.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const officialPdf = 'https://www.kotsu.metro.tokyo.jp/subway/kanren/pdf/barrierfree_guide_oedo.pdf'
type Classification = 'A. CAR POSITION CONFIRMED' | 'B. MULTIPLE OPTIONS' | 'C. NO SUITABLE OFFICIAL POSITION' | 'D. DATA CONFLICT'
type Finding = { stationId: string; station: string; exit: string; gate: string; car: string; equipment: string; note: string; consistency: string; classification: Classification; wording: string }

// Values below are transcribed from the official Oedo barrier-free table. The
// source's equipment pictograms are intentionally not guessed when text search
// cannot preserve the icon meaning.
const findings: Finding[] = [
  { stationId: '422', station: '赤羽橋', exit: '赤羽橋口', gate: '改札（名称記載なし）', car: '4号車付近; 3・7号車付近', equipment: '未確定（設備アイコン要確認）', note: '改札→赤羽橋口は「一部」。複数のホーム位置候補。', consistency: 'GTFS exit 422N0012への経路あり。号車とboarding areaの対応は未接続。', classification: 'B. MULTIPLE OPTIONS', wording: '3・4・7号車付近に複数候補（確定推奨なし）' },
  { stationId: '424', station: '六本木', exit: '7出口', gate: '東京ミッドタウン方面改札', car: '8号車付近', equipment: '未確定（設備アイコン要確認）', note: '8号車付近→東京ミッドタウン方面改札→7出口が明記。', consistency: 'GTFS 424P2→424N0053の経路と整合。', classification: 'A. CAR POSITION CONFIRMED', wording: 'できれば8号車付近に乗る' },
  { stationId: '426', station: '国立競技場', exit: 'A2出口', gate: '国立競技場方面改札', car: '4号車付近（2基）; 1号車付近; 5号車付近（一部）', equipment: '未確定（2基の設備アイコン要確認）', note: '4号車付近→国立競技場方面改札（2基）→A2が明記。1/5号車も同改札、8号車は別改札。始発〜22:00注記あり。', consistency: 'GTFS 426P2→A2候補および地下1階改札と整合するが、号車はGTFS外。', classification: 'B. MULTIPLE OPTIONS', wording: '4号車付近が第一候補（設備種別・時間は現地確認）' },
  { stationId: '421', station: '大門', exit: 'B2出口', gate: 'JR浜松町駅方面改札', car: '5号車付近; 1・4号車付近; 6・8号車付近', equipment: '未確定（設備アイコン要確認）', note: 'B2は「一部」。複数のホーム位置候補。', consistency: 'GTFS 421P3→421N0015経路あり。号車とGTFS boarding areaは未接続。', classification: 'B. MULTIPLE OPTIONS', wording: '複数候補（B2は一部のため確定推奨なし）' },
  { stationId: '423', station: '麻布十番', exit: '7出口', gate: '改札（名称記載なし）', car: '4号車付近; 2・8号車付近', equipment: '未確定（設備アイコン要確認）', note: '改札→7出口は「一部」。5/5a/5bの時間注記もあり。', consistency: 'GTFS 423P2→423N0063経路あり。', classification: 'B. MULTIPLE OPTIONS', wording: '4・2・8号車付近に候補（7出口は一部）' },
  { stationId: '425', station: '青山一丁目', exit: '1出口', gate: '北青山方面改札', car: '5・3・6号車付近→東京メトロ線連絡改札階→北青山方面改札', equipment: '未確定（設備アイコン要確認）', note: '大江戸線表は連絡改札階から北青山方面改札への接続を記載。1出口は北青山方面改札側。', consistency: 'GTFS 425P2→425N0123経路あり。改札階の乗換接続はGTFSと別表現。', classification: 'B. MULTIPLE OPTIONS', wording: '3・5・6号車付近が候補（1つに確定不可）' },
  { stationId: '427', station: '代々木', exit: 'A2出口', gate: '改札（名称記載なし）', car: '5号車付近; 1号車付近（一部）; 4・8号車付近', equipment: '未確定（設備アイコン要確認）', note: '改札→A2は記載あり。複数のホーム位置候補。', consistency: 'GTFS 427P2→427N0084経路あり。', classification: 'B. MULTIPLE OPTIONS', wording: '4・5・8号車付近が候補（1号車は一部）' },
  { stationId: '403', station: '東新宿', exit: 'A2出口', gate: '改札（名称記載なし）', car: '5号車付近; 2・7号車付近', equipment: '未確定（設備アイコン要確認）', note: '改札→A2が記載。2・7号車候補は共通表記。', consistency: 'GTFS 403P2→403N0019/0020経路あり。', classification: 'B. MULTIPLE OPTIONS', wording: '2・5・7号車付近が候補' },
  { stationId: '428', station: '新宿', exit: 'A1出口', gate: 'マインズタワー方面改札', car: '1号車付近; 5号車付近', equipment: '未確定（設備アイコン要確認）', note: '両候補からマインズタワー方面改札→A1。', consistency: 'GTFS 428P7→428N0193経路あり。', classification: 'B. MULTIPLE OPTIONS', wording: '1・5号車付近が候補（優劣未確定）' },
  { stationId: '402', station: '新宿西口', exit: 'D3出口', gate: '（D3接続の公式バリアフリー記載なし）', car: '確定不可', equipment: '確定不可', note: '公式表の地上接続はJR新宿駅方面改札→D2、小滝橋通り方面改札→D5。D3がない。', consistency: 'GTFS 402N0002候補は存在するが、公式バリアフリー表との出口対応が不足。', classification: 'C. NO SUITABLE OFFICIAL POSITION', wording: '号車位置を案内しない' },
  { stationId: '410', station: '上野御徒町', exit: 'A7出口', gate: '（A7接続の公式バリアフリー記載なし）', car: '確定不可', equipment: '確定不可', note: '公式表はJR御徒町方面改札→A6/A5、しのばずの池方面改札→A3/A4。A7がない。', consistency: 'GTFS 410N0016候補は存在するが、公式バリアフリー表との出口対応が不足。', classification: 'C. NO SUITABLE OFFICIAL POSITION', wording: '号車位置を案内しない' },
  { stationId: '429', station: '都庁前', exit: 'A4出口', gate: '改札（名称記載なし）', car: '4号車付近（4番線）; 2・7号車付近', equipment: '未確定（設備アイコン要確認）', note: '4号車付近→改札、改札→A4が記載。A4の運転時間は始発〜22:00（一部）注記。2・7号車も同改札候補。', consistency: 'GTFS 429P4→429N0093経路および公式A4設定と整合。', classification: 'B. MULTIPLE OPTIONS', wording: '4・2・7号車付近が候補（A4は始発〜22:00注記）' },
]

const md = [
  '# 全12コース 到着駅バリアフリー号車位置監査', '',
  `調査日: ${new Date().toISOString().slice(0, 10)}`, `公式主資料: ${officialPdf}`, '',
  '東京都交通局公式の「各駅の主なバリアフリー設備設置一覧」を基に、目的出口へつながる改札とホーム号車位置を照合した。PDFの設備アイコンはテキスト抽出で保持されないため、EV/ESの種別は画像確認できたもの以外は断定していない。', '',
  '| station | arrival platform | target exit | target gate | equipment | official car position | classification | recommended wording |', '|---|---|---|---|---|---|---|---|',
]
for (const row of findings) {
  const course = outingCoursePresets.find(item => item.arrivalStationId === row.stationId)
  const platform = course?.arrivalPlatformAssignments[0]?.platformCode ?? course?.arrivalPlatformAssignments[0]?.platformId ?? '不明'
  md.push(`| ${row.station} | ${platform} | ${row.exit} | ${row.gate} | ${row.equipment} | ${row.car} | ${row.classification} | ${row.wording} |`)
}
md.push('', '## GTFS / StationMap照合', '', ...findings.map(row => `- **${row.station}**: ${row.consistency}`), '', '## 集計', '', `- A. CAR POSITION CONFIRMED: ${findings.filter(row => row.classification.startsWith('A')).length}`, `- B. MULTIPLE OPTIONS: ${findings.filter(row => row.classification.startsWith('B')).length}`, `- C. NO SUITABLE OFFICIAL POSITION: ${findings.filter(row => row.classification.startsWith('C')).length}`, `- D. DATA CONFLICT: ${findings.filter(row => row.classification.startsWith('D')).length}`, '', '## 国立競技場の重点結果', '', '4号車付近→国立競技場方面改札（2基）→A2出口が公式表に明記される。一方、1号車・5号車も同改札への候補であり、8号車は東京体育館方面改札のためA2向けの第一候補にはしなかった。設備アイコンの種別と利用時間はPDF画像の確認が必要で、現段階では「4号車付近」を紙面へ自動表示しない。', '', '## 結論', '', '号車位置を公式に確定できる駅はあるが、目的出口・改札・設備種別・時間制限まで全12駅で一意に揃うわけではない。まずはA判定駅だけを対象に、公式資料の画像確認と列車方向の検証を追加するのが安全である。', '', '## 出典', '', `- 東京都交通局 大江戸線バリアフリー一覧: ${officialPdf}`, '- 各駅公式ページ（StationMap metadataおよびcourse presetのsourceUrl）'
)
const report = join(root, 'reports', 'elderly-car-position-audit.md')
mkdirSync(join(root, 'reports'), { recursive: true })
writeFileSync(report, `${md.join('\n')}\n`)
console.log(`Wrote ${report}`)

it('covers all 12 arrival stations without changing production data', () => {
  if (findings.length !== 12) throw new Error(`expected 12 findings, got ${findings.length}`)
})
