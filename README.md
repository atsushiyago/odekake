# 迷わないおでかけ紙

**電車を降りてから、出口まで。**

## Overview

「迷わないおでかけ紙」は、駅構内オープンデータから、電車を降りたホームから目的出口までの案内を生成し、A4両面の紙としてプレビュー・印刷する Web アプリです。

複雑な駅構内グラフをそのまま見せるのではなく、利用者が「次に何をすればよいか」を追える短い StationGuide step に変換することを中心にしています。現在は都営大江戸線の12コースを収録しています。

## 利用者にとっての価値

- 地下駅で起こりやすい「ホームから出口まで分からない」を減らす
- 構内図を見ながらスマートフォンを操作する負担を減らす
- 紙なので、駅構内での通信やバッテリーを必要としない
- 高齢者を主な利用者として想定しつつ、駅で迷いやすい人全般に使える

## 現在の機能

- 12個の目的地コースから選択（駅名付きコースボタン）
- 到着ホーム → 改札 → 目的出口の StationGuide
- 公式根拠に基づく推奨号車案内（登録があるコースのみ）
- エレベーター・エスカレーター・階段・通路・改札の案内
- 公式 Floor 情報が確定した改札の「地下○階の改札を通る」表示
- 長い通路の距離・歩数の目安
- 階段を避ける候補を評価する高齢者向け route scoring
- 駅構内の A4 表面／裏面プレビューと印刷
- 駅出口から目的地までの屋外地図・徒歩案内（補助情報）
- 通常画面は利用者向け表示、`?debug=1` では開発・検証用の診断 UI を表示

収録コースは、東京タワー、国立新美術館、国立競技場、旧芝離宮恩賜庭園、パティオ十番、明治神宮外苑いちょう並木、明治神宮・代々木口、新宿文化センター、サザンタワー、思い出横丁、アメ横、東京都庁展望室です。

## 技術的な特徴

### GTFS-Pathways から StationGuide へ

`src/domain/indoorRouting.ts` が GTFS-Pathways を有向グラフへ正規化し、候補経路を探索します。候補の共通 suffix や fare gate の意味イベントを比較し、実際のエッジを根拠として step を生成します。

### semantic grouping と安全な圧縮

利用者の行動単位に近づけるため、次の情報を使います。

- Facility / Space / Floor の連続性
- stairs + 短い connector + stairs の decision-point compression
- 同一設備内の短い通路の吸収
- same-level のエレベーター接続の吸収
- 分岐、設備境界、改札、出口をまたがないことの確認
- 全候補で共通する level transition consensus
- 公式案内と GTFS 詳細経路を混ぜないための SAFE REJOIN

圧縮しても、元 Pathway、node、Facility、Space などの provenance は保持します。安全条件が不足する場合は、無理に短くせず basic な案内へ fallback します。

### 高齢者向け route scoring

候補経路を、階段利用、設備乗換、分岐・判断点、徒歩距離などで比較します。EV と ES の固定的な優先順位を置くのではなく、データ上説明できる範囲で負担の少ない候補を評価します。

### 人間向けの表示

通路距離は実 Pathway 距離を合計して表示し、10m 以上では 5m 単位の距離と、0.6m/歩・10歩単位切り上げの歩数目安を付けます。A4 の文字サイズを自動縮小せず、内容量に応じて表裏へ block 単位で pagination します。

## 使用データ

- **都営地下鉄の静的 GTFS / GTFS-Pathways**
  - [GTFS-Pathways 配布ファイル](https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS-Pathway.zip)
  - [都営静的 GTFS](https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip)
- **ほこナビDP／公共交通オープンデータチャレンジの駅構内データ**
  - Facility、Space、Floor、walking network の GeoJSON
  - [チャレンジ2026](https://challenge2026.odpt.org/)
  - [都営地下鉄のほこナビDPデータセット一覧](https://ckan.hokonavi.go.jp/dataset/?tags=%E9%83%BD%E5%96%B6%E5%9C%B0%E4%B8%8B%E9%89%84)
  - 例：[六本木駅](https://ckan.hokonavi.go.jp/dataset/mlit_station_oedo_roppongi)、[国立競技場駅](https://ckan.hokonavi.go.jp/dataset/station_oedo_kokuritsu-kyogijo)
- **東京都交通局の公式駅情報・構内図・バリアフリー資料**
  - 駅ごとの公式ページを到着ホーム、出口、Floor、号車案内の根拠として登録
  - [大江戸線バリアフリー設備一覧 PDF](https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf)
- **目的地公式アクセス情報**
  - 各コースの目的地公式ページを `src/data/coursePresets.ts` と徒歩 fixture に保持
- **屋外徒歩ルート**
  - 開発時に固定した GeoJSON を使用
  - ルート形状の取得元は [OpenStreetMap routing.openstreetmap.de](https://routing.openstreetmap.de/routed-foot/route/v1/driving)
  - 実行時に routing API へ依存しません。地図タイル表示は OpenStreetMap を使用します。

出典 URL、取得日、ライセンス、provenance はデータモデルまたは fixture に保持します。公式根拠を確認できない値は生成しません。

## 自動化の範囲と制約

- routing core は駅名や Pathway ID の特例ではなく、共通の GTFS graph・semantic 処理で動作します。
- GTFS-Pathways だけでも、basic な graph 構築、経路探索、改札検出、level transition、StationGuide 生成が可能です。
- Facility / Space / Floor と walking-network を登録すると、設備群の圧縮など advanced な semantic 処理が有効になります。
- 公式構内図由来の「○号車付近」は optional metadata です。機械可読な boarding area と直接対応しない場合もあります。
- 不明な設備、出口、左右、号車位置を推測せず、安全な抽象表現へ fallback します。
- したがって、新しい駅データを追加するだけで全ての公式案内が完全自動化されるわけではありません。出口の採用、公式 Floor、バリアフリー設備、目的地アクセスは、必要に応じて人が根拠を確認して metadata として登録します。

## 新駅 onboarding の検証

`src/domain/newStationOnboarding.test.ts` には、既存12駅とは異なる `test-generic-station` の合成 fixture があります。runtime に駅 ID の特例を追加せず、次を確認します。

1. GTFS-only で graph、経路、改札、level transition、距離・歩数付き basic guide を生成できる
2. StationMap registry を登録すると、階段 + 短い flat connector + 階段が1つの semantic actionへ安全に圧縮され、provenance が残る
3. metadata がない場合は高度な圧縮を行わず、guide 生成自体は fallback する
4. 可能な範囲で elderly route scoring が駅 ID whitelist なしに動作する

これは「データ追加だけで常に正しい案内が完成する」という証明ではなく、未知の駅でも engine が安全に basic 処理へ戻れることを確認するテストです。

## Demo / Debug

公開 URL や動画 URL はこの repository に登録していません。ローカルで `npm run dev` を実行して確認してください。

- 通常画面：コース選択と A4 プレビュー
- 開発診断画面：`http://localhost:5173/?debug=1`

## Development

```bash
npm install
npm run dev
```

テストと production build:

```bash
npm test -- --run
npm run build
```

個別の監査スクリプトは `package.json` の `audit:*` scripts と `scripts/` を参照してください。駅構内データの追加・再取得は [駅構内データ取り込み手順](docs/indoor-data-import-runbook.md) に従います。

## Repository layout

```text
src/domain/           共通の graph、route、semantic、presentation ロジック
src/data/fixtures/    GTFS、時刻、徒歩 route などの固定データ
src/data/stationMaps/ 駅構内 Facility / Space / Floor / walking network
src/data/catalogs/    駅・データセットのレジストリ
src/data/repositories/データ取得・検索との境界
src/ui/               コース選択、A4 表裏プレビュー、印刷 UI
scripts/              監査・抽出用スクリプト
docs/                 データ取り込み・出典監査メモ
```
