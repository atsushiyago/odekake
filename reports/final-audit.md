# Final Audit

監査日: 2026-09-21  
対象: 公共交通オープンデータチャレンジ2026向け「迷わないおでかけ紙」12コース

## Overall

- 12/12コース: 列車検索、公式ホーム割当、到着駅StationGuide、固定徒歩routeを生成可能
- 12/12駅: GTFS-Pathways fixture読込・共通グラフ生成成功
- 12/12駅: validation上、ホーム→出口StationGuide生成成功
- `npm test`: 15 files / 70 tests passed
- `npm run build`: 成功
- `npm run audit:fare-gates`: 実行済み（12駅、platform→exit 146グループ）
- Critical: 0件
- High: 0件
- Medium: 3件（既知のfare-gate topology差異）
- Low: 1件（赤羽橋StationMap metadataの形式差）

## Course Matrix

| コース | trip / 発着 | ホーム | 出口 | semantic steps | summary | 徒歩route | 時間表示 | audit |
|---|---|---|---|---:|---|---:|---|---|
| 大門→赤羽橋→東京タワー | 400613B0 / 07:03→07:05 | 4→2 | 赤羽橋口 | 9 | 階段2回・ES1回 | 579.3m | 公式5分 | 要確認（11/12） |
| 大門→六本木→国立新美術館 | 400613B0 / 07:03→07:09 | 4→2 | 7出口 | 10 | 階段2回・EV1回・改札あり | 914.4m | 公式4分 | OK |
| 六本木→国立競技場→国立競技場 | 400611B0 / 07:01→07:05 | 2→2 | A2出口 | 6 | EV1回・改札あり | 314.2m | 公式1分 | OK |
| 赤羽橋→大門→旧芝離宮恩賜庭園 | 410629A0 / 07:04→07:07 | 1→3 | B2出口 | 9 | 階段3回・改札あり | 215.8m | 公式3分 | OK |
| 大門→麻布十番→パティオ十番 | 400613B0 / 07:03→07:07 | 4→2 | 7出口 | 12 | 階段3回・ES1回・改札あり | 225.6m | 公式7分 | OK |
| 六本木→青山一丁目→明治神宮外苑 | 400611B0 / 07:01→07:03 | 2→2 | 1出口 | 15 | 階段2回・ES1回・EV2回・改札あり | 304.0m | 公式5分 | OK |
| 国立競技場→代々木→明治神宮・代々木口 | 400636B0 / 07:01→07:04 | 2→2 | A2出口 | 11 | 階段3回・改札あり | 71.8m | 公式2分 | OK |
| 新宿西口→東新宿→新宿文化センター | 400644B0 / 07:01→07:03 | 2→2 | A2出口 | 6 | EV1回・改札あり | 393.9m | 公式7分 | OK |
| 代々木→新宿→サザンタワー | 400636B0 / 07:04→07:05 | 2→7 | A1出口 | 15 | ES5回・EV1回・改札あり | 209.2m | 公式1分 | OK |
| 東新宿→新宿西口→思い出横丁 | 410524A0 / 07:02→07:05 | 1→1 | D3出口 | 7 | 階段1回・改札あり | 47.1m | 公式2分 | 要確認（6/6・gate構成2種） |
| 新宿西口→上野御徒町→アメ横 | 400644B0 / 07:01→07:18 | 2→1 | A7出口 | 10 | 階段3回・改札あり | 284.9m | routing約4分 | OK（11/11） |
| 新宿→都庁前→東京都庁展望室 | 420609B0 / 07:03→07:05 | 7→4 | A4出口 | 10 | ES1回・階段2回・改札あり | 82.3m | routing約2分 | OK（13/13） |

`official` は目的地公式アクセスに明記された時間、`routing` は固定OSM routing結果からの目安です。公式時間がないアメ横・都庁前では「公式」と表示していません。

## Findings

### Medium: 赤羽橋のfare gate topology

- 対象: 赤羽橋 P2 → 赤羽橋口
- 12 boarding area中11経路だけが `422L0070` を通過
- `422N0080` は最短経路にfare gateを含まず、強制経路はloop
- StationGuide本文のGTFSイベントは保持するが、summaryでは未確定gateを「改札あり」と数えていない
- 修正: なし（ODPT確認中の安全側仕様を維持）

### Medium: 新宿西口 D3のgate構成差

- 6/6経路がfare gateを通過
- 経路ごとに異なるgate edgeを使うため、個別edgeの共通判定だけではsummaryから漏れる問題があった
- genericな候補全体のprovenance集計を修正済み
- StationGuideの改札ステップは保持し、summaryは`改札あり`として1回に集約

### Medium: 都庁前・上野御徒町の未採用候補

- 都庁前 P2では17/18 anomalyとloopが残るが、採用したP4→A4は13/13でOK
- 上野御徒町 A2/A5はmixed topologyだが、採用したP1→A7は11/11でOK
- 都営GTFS-Pathways外の東京メトロ構内経路は補完していない
- 修正: なし（採用候補を安全なものに限定）

### Low: 赤羽橋のStationMap metadata

- Facility / Space / Floor fixtureは存在し圧縮に利用している
- ただし他駅のCKAN metadata構造と異なり、`akabanebashi.ts`にはdataset URL/CRS/acquisition dateの定数がない
- 紙面・経路探索には影響しないため、今回はコード変更せず提出後の整理事項とした

## StationMap Provenance

全駅でGTFS-Pathwaysを経路探索の正本、StationMapを表示用圧縮の補助として使用しています。公式駅データのCRSは原則EPSG:6668です。

| 駅 | StationMap source | walking-network | CRS / 取得日 |
|---|---|---|---|
| 赤羽橋 | プロジェクト内Facility/Space/Floor fixture | fixtureあり | metadata定数未整理 / 2026-09-21取得済み |
| 大門 | `station_oedo_daimon` | CKAN resource | EPSG:6668 / 2026-09-21 |
| 六本木 | `mlit_station_oedo_roppongi` | CKAN resource | EPSG:6668 / 2026-09-21 |
| 国立競技場 | `station_oedo_kokuritsu-kyogijo` | CKAN resource | EPSG:6668 / 2026-09-21 |
| 麻布十番 | `mlit_station_oedo_azabu-juban` | CKAN resource | EPSG:6668 / 2026-09-21 |
| 青山一丁目 | `oedo_aoyama-itchome` | CKAN resource | EPSG:6668 / 2026-09-21 |
| 代々木 | `mlit_station_oedo_yoyogi` | CKAN resource | EPSG:6668 / 2026-09-21 |
| 東新宿 | `mlit_station_oedo_higashi-shinjuku` | CKAN resource | EPSG:6668 / 2026-09-21 |
| 新宿 | `station_oedo_shinjuku` | CKAN resource | EPSG:6668 / 2026-09-21 |
| 新宿西口 | `station_oedo_shinjukunishiguchi` | CKAN resource | EPSG:6668 / 2026-09-21 |
| 上野御徒町 | `mlit_station_oedo_ueno-okachimachi` | CKAN resource + node/link GeoJSON | EPSG:6668 / 2026-09-21 |
| 都庁前 | `station_oedo_tochomae` | CKAN resource + node/link GeoJSON | EPSG:6668 / 2026-09-21 |

## Outdoor Route Provenance

12本すべて固定GeoJSONのLineStringを使用し、runtime routing APIには依存していません。経路線はOpenStreetMap routing endpointで開発時に取得し、目的地公式アクセスURLを各fixtureのmetadataに保持しています。地図には`© OpenStreetMap contributors`を残しています。

都庁展望室だけは、徒歩地図の終点を第一本庁舎入口付近とし、建物内の展望室専用エレベーター案内を徒歩routeとは分離しています。

## Known Data Limitations

- 六本木など、他事業者構内へ続く出口は東京メトロGTFS-Pathways未取得のため接続していない
- 東京メトロ側のPathwaysを座標近接で補完していない
- 赤羽橋 `422N0080` のfare gate anomalyは未解決
- 都庁前 P2、上野御徒町 A2/A5などのmixed topologyは既知のまま保持
- 列車検索はstatic GTFSの平日・07:00以降・直通fixtureに限定し、祝日・乗換検索は未対応
- 正確な列車降車位置はGTFS-Pathwaysから確定していない

## Freeze Result

監査中にCritical/Highの誤案内は見つかりませんでした。実施したコード修正はありません。既存のD3 fare-gate集計修正と、今回追加済みの2コースを含め、既存12コースの生成・表示・印刷構造を維持しています。

## Browser Check

- コース選択ボタングリッドから「アメ横」「東京都庁展望室」を切り替え、表面の列車・ホーム・出口・StationGuideと裏面の固定徒歩地図を実表示で確認しました。
- 画面上で `12/12駅 読込成功`、`12/12駅 ホーム→出口StationGuide生成成功` を確認しました。
- 全12コースの値（列車、ホーム、出口、StationGuide、徒歩route）は同一の自動監査matrixと突合しています。全12コースを個別に手動クリックして印刷ダイアログまで確認する作業は未実施です。
