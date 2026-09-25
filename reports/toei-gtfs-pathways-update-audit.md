# Toei GTFS-Pathways Update Audit

## Summary

旧 `Toei-Train-GTFS-Pathway-old` と新 `Toei-Train-GTFS-Pathway` を、`feed_info.txt` の版番号、`stops.txt`、`pathways.txt` のIDおよび各endpointを使って比較した。版番号はそれぞれ `20260917` と `20260924` で、期間は新旧とも2026-03-14開始、新版は2027-03-12まで。ディレクトリ名とも一致し、旧新の識別は明確。

差分は stops 6件削除・2件変更、pathways 6件削除・1件変更。追加はない。変更駅は赤羽橋、六本木、都庁前、上野御徒町の4駅。12コースの同一preset/同一アプリroute処理で比較すると、赤羽橋の候補・選択route・guideが変わる。六本木は候補数が減るがselected routeとguideは不変。都庁前の対象4番ホーム→A4と上野御徒町の対象1番ホーム→A7はselected route/guideに変化なし。

これは新版データを現行アプリ処理に入力した監査結果であり、アプリの本番fixtureはまだ `20260917`。コード・fixtureは変更していない。新データでは赤羽橋の旧不整合候補が候補集合からなくなり、残った全候補でfare gate通過が成立する。一方、赤羽橋では高齢者route scoringの選択がより長い別候補に変わるため、データ更新時にroute/紙面差分を確認する必要がある。

## Detected GTFS versions/files

| 判定 | ディレクトリ | `feed_info.feed_version` | `feed_start_date` – `feed_end_date` | stops / pathways |
|---|---|---:|---|---:|
| 旧版 | `Toei-Train-GTFS-Pathway-old` | `20260917` | 2026-03-14 – 2026-12-31 | 2,741 / 2,870 |
| 新版 | `Toei-Train-GTFS-Pathway` | `20260924` | 2026-03-14 – 2027-03-12 | 2,735 / 2,864 |

比較対象は両ディレクトリの `stops.txt`、`pathways.txt`、`feed_info.txt`、`levels.txt`。GTFSレコード数にはヘッダーを含めていない。新版で追加されたstop/pathwayはなく、削除stopの参照先や変更行のendpointも各版の実データで照合した。

`pathways.txt` の両版に存在する列は `pathway_id, from_stop_id, to_stop_id, pathway_mode, is_bidirectional, length` の6列。したがって `traversal_time`、`stair_count`、`signposted_as`、`reversed_signposted_as` はこのfeedに列自体がなく比較対象外。存在するpathway列では上記の1件の `pathway_mode` 変更以外に差分はない。`stops.txt` では `stop_name`、`location_type`、`parent_station`、`level_id` 等を全列比較し、新旧の変更は下記8レコードに限られる。

現行アプリの駅別GTFS fixtureは `feedVersion: 20260917` を記録している。新版はまだアプリへ取り込まれていない。

## Changed stations

| Station | stops changes | pathways changes | routing impact |
|---|---:|---:|---|
| 赤羽橋 | 1削除 | 1削除 | P2→赤羽橋口で候補が12→11。旧11/12 gate通過・1候補gateなし/強制時loopから、新11/11 gate通過・loopなしへ。selected routeとguideも変化。|
| 六本木 | 4削除 | 4削除 | P2→7出口の候補が6→4。4候補ともgate通過。selected route・設備数・距離・guideは不変。|
| 都庁前 | 1削除・2変更 | 1削除 | 変更はP2側。現在のコースP4→A4は13候補、gate 13/13、selected route・guideとも不変。|
| 上野御徒町 | 変更なし | 1変更 | `410L0055` がwalkway(mode 1)からfare gate(mode 6)へ変更。現行A7コース候補は引き続き別gate `410L0100` を通り、selected route・guideに変化なし。駅内の他経路のgate semanticsには影響しうる。|

具体的な差分:

- 赤羽橋: `422N0080` (P2配下、location_type 4) と、それへ接続する `422L0046` (walkway、双方向、2.8m) を削除。
- 六本木: P2配下 `424N0037` / `424N0094` (level -5)、P1配下 `424N0051` / `424N0091` (level -7) を削除。接続walkway `424L0252` (10.1m)、`424L0248` (7.6m)、`424L0271` (21.6m)、`424L0279` (11.5m) を削除。削除経路はboarding-area connectorで、他のstop属性変更はない。
- 都庁前: P2配下の `429N0176` (type 4、level -3) と、接続walkway `429L0153` (`429N0173`→`429N0176`、双方向、5.2m) を削除。`429N0009` と `429N0069` は座標・名称を維持したまま、type 4→3、parent `429P2`→`429`、GTFS `level_id -3`→`-2` に変更。
- 上野御徒町: `410L0055` は `410N0139`↔`410N0138`、双方向、2.1mのまま、`pathway_mode 1→6`。`from/to_stop_id`、距離、双方向性は不変。

## Akabanebashi

対象は現在のpresetどおり `422P2` → `422N0012` (赤羽橋口)。fare-gate監査はplatform配下のboarding-area候補ごとのshortest routeと、gateを強制した場合のroute成立性を確認した。

### Old topology

- 12候補すべてexitへ到達。11/12 shortest routeがfare gate `422L0070` を含み、1/12はgateなし。gateを強制したその候補はloopとなる。
- gateなしだったboarding areaは `422N0080`。旧selected elderly routeもこのnodeを起点とし、routeは `422L0046 → 422L0055 → 422L0052 → 422L0053 → 422L0044 → 422L0115 → 422L0116 → 422L0107 → 422L0108 → 422L0113 → 422L0114 → 422L0131 → 422L0136`。このselected route列には `422L0070` がなく、本文にもfare-gate stepが生成されなかった。
- selected scoring: 105.3m、stairs 1 / ES 2 / EV 0、equipment changes 2、decision points 6。

### New topology

- `422N0080` とその短いconnector `422L0046` が削除され、候補は11。11/11 shortest routeがfare gate `422L0070` を通り、gateなし候補・強制gate loopはいずれも0。
- platform levelからgate側levelへのconsensusは、全11候補でGTFS level `-2 → -1`、上方向。これはGTFS level index上の関係であり、物理的な地下階名を意味しない。
- 新selected routeは別boarding area `422N0104` 起点で、`422L0027 → 422L0028 → 422L0003 → 422L0039 → 422L0047 → 422L0066 → 422L0067 → 422L0068 → 422L0069 → 422L0070 → 422L0071 → 422L0052 → 422L0053 → 422L0044 → 422L0115 → 422L0116 → 422L0107 → 422L0108 → 422L0113 → 422L0114 → 422L0131 → 422L0136`。`422L0070` がselected routeに含まれ、guideに改札stepが現れる。
- 新selected scoring: 142.6m、stairs 1 / ES 3 / EV 0、equipment changes 2、decision points 10。

### Effect

既知の「candidateによってfare gateを通らない」問題は、新版のこのpreset候補集合では解消。旧異常候補そのものが削除され、残存候補すべてが同じgateを通る。紙面では旧routeの「改札stepなし」から、新routeの「改札を通る」へ変化する。現在のStationMap Floor metadataを使うアプリ処理では「地下1階の改札を通る」と表示されたが、このFloor名はGTFS levelから推定したものではない。

ただしroute scoring結果も変わり、距離は37.3m、ES使用は1回、decision pointsは4増える。これはエンジン不具合の証拠ではなく、入力候補の削除に伴う選択変化。新fixtureを採用する際に紙面をレビューすべき点である。

## Tochomae

対象courseは `429P4` → `429N0093` (A4)。ここではstation全体のP2 topology修正と、アプリが現在使うP4コースへの影響を分けて確認した。

### Old topology

- P2配下に `429N0176` (type 4、GTFS level -3) があり、`429L0153` walkway (5.2m) で `429N0173` と接続。
- `429N0009` / `429N0069` はP2配下のtype 4 node、GTFS level -3。
- P4→A4は13/13候補到達、13/13 gate通過。gate edgeは `429L0143`。level-index consensusは`-3 → -2`上方向。

### New topology

- P2配下 `429N0176` と接続walkway `429L0153` が削除。
- `429N0009` / `429N0069` は同じ座標・ID・名称のまま、generic walkway node (type 3)、駅直下parent `429`、GTFS level -2へ変更。
- 現行P4→A4は引き続き13/13候補到達、13/13 gate通過し、gate edge `429L0143`、level-index consensus、selected route (`429N0033`起点、216.8m、stairs 1 / ES 3 / EV 0)、StationGuideは新旧一致。

### Effect

新版はP2側のnode分類・level・boarding-area接続を修正しているが、現在の都庁前コースはP4発のため route・gate・表示に影響なし。P2発コースを将来追加・監査する場合には、修正後データでcandidate topologyとFloor対応を再確認する。GTFS `level_id` の変化だけから地下階表示を導いてはならない。

## Other affected stations

### 六本木

P2→7出口のcandidateは6→4、到達4/4、gate通過4/4。削除された2候補はP2側connectorに対応し、現在のselected origin `424N0259`、距離160.7m、stairs 0 / ES 1 / EV 1は維持。Guide表示も同一。P1候補の削除も含め、駅全体では4 boarding-area nodeと4 connectorが整理されている。

### 上野御徒町

`410L0055` はpathway mode 1 walkwayからmode 6 fare gateへ変わった。これは単なる属性でなく、graph上のfare-gate semantic、gate grouping/audit、候補route上のgate回数に影響しうる変更。現行A7コースの候補11/11は旧新版ともgate `410L0100` を通過し、`410L0055` はそれらのshortest route・selected routeに含まれない。selected routeは232.1m、stairs 2 / ES 1 / EV 0のまま、guideも同じ。駅内の他出口・別経路で `410L0055` を使うrouteは、fixture更新時にgate表示の回帰対象とする。

## Regression check for the 12 supported stations

同一の12 course preset、到着platform・preferred exit、既存StationMap registry、route selection / guide生成関数を使って旧版・新版を比較した。candidate数は、preferred exitが複数あるpresetでは「boarding area × exit候補」のroute pair数。到達boarding area数は重複exitを除いた数。gate率はroute pair単位でshortest routeがfare gate edgeを含む数。

| コース / 駅 | platform → exit | candidates old→new | reachable areas old→new | shortest routes with gate old→new | selected route / guide |
|---|---|---:|---:|---:|---|
| 東京タワー / 赤羽橋 | P2→赤羽橋口 | 12→11 | 12→11 | 11/12→11/11 | 変更。selected BA・経路・guideが変化 |
| 国立新美術館 / 六本木 | P2→7出口 | 6→4 | 6→4 | 6/6→4/4 | route・guide不変 |
| 国立競技場 | P2→A2候補 | 36→36 | 18→18 | 36/36→36/36 | 不変 |
| 旧芝離宮恩賜庭園 / 大門 | P3→B2 | 15→15 | 15→15 | 15/15→15/15 | 不変 |
| パティオ十番 / 麻布十番 | P2→7 | 14→14 | 14→14 | 14/14→14/14 | 不変 |
| いちょう並木 / 青山一丁目 | P2→1 | 15→15 | 15→15 | 15/15→15/15 | 不変 |
| 明治神宮・代々木口 / 代々木 | P2→A2 | 13→13 | 13→13 | 13/13→13/13 | 不変 |
| 新宿文化センター / 東新宿 | P2→A2候補 | 22→22 | 11→11 | 22/22→22/22 | 不変 |
| サザンタワー / 新宿 | P7→A1 | 5→5 | 5→5 | 5/5→5/5 | 不変 |
| 思い出横丁 / 新宿西口 | P1→D3 | 6→6 | 6→6 | 6/6→6/6 | 不変 |
| アメ横 / 上野御徒町 | P1→A7 | 11→11 | 11→11 | 11/11→11/11 | route・guide不変。mode変更edgeは対象route外 |
| 東京都庁展望室 / 都庁前 | P4→A4 | 13→13 | 13→13 | 13/13→13/13 | 不変 |

新版でも12/12でroute生成・exit到達可能。selected routeが変わったのは赤羽橋のみ。Guide instruction列が変わったのも赤羽橋のみ。国立競技場・東新宿の36/22は複数preferred-exit候補分を含み、boarding area数とは一致しない。

## Existing app assumptions affected by the update

- **Fare gate semantic grouping / safety:** 赤羽橋は新版で全11候補がgate `422L0070` を通る。上野御徒町では `410L0055` が新たにmode 6となるため、このedgeを通る別routeにfare-gate semantic eventが生じる可能性がある。現行A7 routeへの差分はない。
- **Common suffix / candidate merge:** 赤羽橋は候補数が変わり、旧異常BAを含む共通部分から新版の11候補を前提とした比較へ変化する。candidate set依存のcommon suffixは再計算が必要。六本木も候補数減少によりsuffixの入力集合は変わるが、selected guideの出力差はなかった。
- **Level transition consensus:** 赤羽橋では旧版は全candidate一致せずconsensusなし、新版は11/11でGTFS index `-2→-1` 上方向のconsensus。都庁前P4は旧新版とも `-3→-2` 上方向で一致。これらの数値を公式階数と同一視しない。
- **Elderly route scoring:** 赤羽橋だけ選択が変化 (105.3m / stairs1, ES2 → 142.6m / stairs1, ES3)。他11コースはselected origin・距離・stairs/ES/EV数が同じ。
- **SAFE REJOIN / official guidance:** 公式の号車・設備metadataやSAFE REJOIN定義は比較対象のGTFSと別ソースで、今回変更していない。赤羽橋の候補gate保証改善はGTFS上の結果であり、公式metadataとの新たなID対応を意味しない。
- **StationGuide presentation:** 赤羽橋のみ改札semantic stepがroute出力に追加され、Floor付き文言は現行StationMap Floor metadata解決による。GTFS `level_index`から地下階を推定していない。他11駅では今回の対象course出力差なし。
- **StationMap / Floor:** StationMap registryは新旧GTFSとは独立して固定し、GTFS node/edgeとの現行generic matchingで比較した。都庁前では2 nodeのGTFS levelが変わるため、次のfixture更新時に地図・Floor対応の整合を要確認。ただしFloor名をGTFS levelから上書きしない。

## Recommended next actions

1. 新版 `20260924` からアプリfixtureを再抽出する場合、更新元・feed version・抽出手順を記録し、現行fixtureとの差分をレビューする。
2. 赤羽橋はgate safety改善を確認できた一方、elderly scoringのselected routeが長くなりguideも変わる。紙面を確認したうえで新版採用を決める。
3. 六本木はboarding-area candidate数減少のみで出力不変。候補整理が意図どおりかデータ更新時に確認する。
4. 上野御徒町では `410L0055` のmode 6化を全駅fare-gate auditへ含め、現行A7以外のrouteにもgate groupingが正しく適用されるか確認する。
5. 都庁前P2変更は現行P4コースの回帰だけでは評価できない。P2を使う検証時に新node classification/levelとStationMapとの整合を再確認する。
6. 今回は本番コードもfixtureも変更していない。現状の差分からは駅固有コード修正の必要性は確認されず、まず新版fixtureへのデータ更新とその後の紙面回帰確認が必要。新版を取り込んでも汎用ロジックが差分どおり動くかを確認し、必要な場合のみ別途コード修正する。

検証: `npm test -- --run` は 28 test files / 119 tests passed。`npm run build` 成功。
