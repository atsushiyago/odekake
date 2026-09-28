# 5駅 公式号車・設備候補とGTFS route selection audit

調査日: 2026-09-28

公式PDFの号車・設備候補を制約として読み、GTFS-Pathwaysの全候補をsemantic usage（階段/ES/EV、設備変更、分岐、距離）で比較した。号車番号はGTFS-Pathwaysにないため、座標が近いだけではboarding areaへ割り当てず、5駅とも `UNRESOLVED MAPPING` とした。

| station | official candidates | GTFS candidate routes | best route (internal trial) | stairs | ES | EV | changes | decisions | distance | gate level | classification |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|---|
| 大門 | 5号車付近=EV→改札、1・4号車付近=ES→改札、6・8号車付近=階段→改札；改札→B2=ES（一部） | 15 | 421N0118→421N0015 | 2 | 4 | 0 | 1 | 12 | 193.8m | -3→-3 / 改札前に垂直移動あり | UNRESOLVED MAPPING |
| 麻布十番 | 4号車付近=EV、2・8号車付近=ES；改札→7=ES（一部） | 14 | 423N0120→423N0063 | 1 | 4 | 0 | 1 | 10 | 196.0m | -4→-4 / 改札前に垂直移動あり | UNRESOLVED MAPPING |
| 代々木 | 5号車付近=EV、1号車付近=ES（一部）、4・8号車付近=階段；改札→A2=ES（一部） | 13 | 427N0075→427N0084 | 3 | 1 | 1 | 3 | 9 | 159.6m | -1→-1 / 改札前に垂直移動あり | UNRESOLVED MAPPING |
| 東新宿 | 5号車付近=EV、2・7号車付近=ES；A2はEV/ESの2行 | 39 | 403N0031→403N0020 | 0 | 0 | 2 | 0 | 6 | 106.9m | -2→-2 / 改札前に垂直移動あり | UNRESOLVED MAPPING |
| 都庁前 | 4号車付近=EV、2・7号車付近=ES；改札→A4=EV（一部・始発〜22:00） | 14 | 429N0033→429N0093 | 1 | 3 | 0 | 1 | 14 | 216.8m | -2→-2 / 改札前に垂直移動あり | UNRESOLVED MAPPING |

## 駅別確認

### 大門

- 公式候補: 5号車付近=EV→改札、1・4号車付近=ES→改札、6・8号車付近=階段→改札；改札→B2=ES（一部）
- 目的改札: JR浜松町方面改札
- GTFS候補数: 15
- 設備アンカー候補（GTFS Facility/Group）: stairs:facility-group:F011:86e8b353173e4264b4600409efd3ba0e@Space:247e3945142e4fa493a18fff3ec1ac55 (421L0061, -5→-4.5) / elevator:facility-group:F012:2b73d0139d4c44dc826774d8a6b71ddb@Space:02128dce24ad42f69d2daac0b42abe41 (421L0024, -5→-5)
- 内部trial選択: 421N0118 → 421N0015
- semantic評価: 階段2・ES4・EV0・設備変更1・分岐12・193.8m
- 設備列: escalator:421L0056 / escalator:421L0072 / fare-gate:421L0161 / escalator:421L0168 / escalator:421L0310 / stairs:421L0286 / stairs:421L0285
- ホーム→垂直移動→改札: 改札前に垂直移動あり（fare gate level -3→-3）。垂直設備の存在は確認できるが、号車との対応は未証明
- 判定: **UNRESOLVED MAPPING**（公式号車位置とGTFS boarding areaを結ぶデータがないため、本番選択不可）
- 紙面preview: 本番表示なし。号車・設備を断定する文言は生成しない。

### 麻布十番

- 公式候補: 4号車付近=EV、2・8号車付近=ES；改札→7=ES（一部）
- 目的改札: 改札（名称記載なし）
- GTFS候補数: 14
- 設備アンカー候補（GTFS Facility/Group）: stairs:facility-group:F011:52acf4195ae14cb2aef939c25598565b@Space:38daf2bd71b14db793600b045a2ba47d (423L0226, -6→-5.5) / stairs:facility-group:F011:ad14c28581a54263b4ba280a02c6bc6a@Space:1cd58ceade3f4d7391906222cc40f54d (423L0222, -6→-5.5) / stairs:facility-group:F011:6640e77cb35241f8b1148d212541379d@Space:912e0b4b9e46453e9e011dd65ec2a005 (423L0230, -6→-5.5) / elevator:facility-group:F012:d4505f7b5a944430985ac0420d354385@Space:0263ead54da74b71bfe2495dbf192c62 (423L0194, -6→-6)
- 内部trial選択: 423N0120 → 423N0063
- semantic評価: 階段1・ES4・EV0・設備変更1・分岐10・196.0m
- 設備列: escalator:423L0229 / fare-gate:423L0143 / escalator:423L0082 / escalator:423L0053 / escalator:423L0058 / stairs:423L0065 / stairs:423L0067
- ホーム→垂直移動→改札: 改札前に垂直移動あり（fare gate level -4→-4）。垂直設備の存在は確認できるが、号車との対応は未証明
- 判定: **UNRESOLVED MAPPING**（公式号車位置とGTFS boarding areaを結ぶデータがないため、本番選択不可）
- 紙面preview: 本番表示なし。号車・設備を断定する文言は生成しない。

### 代々木

- 公式候補: 5号車付近=EV、1号車付近=ES（一部）、4・8号車付近=階段；改札→A2=ES（一部）
- 目的改札: 改札（名称記載なし）
- GTFS候補数: 13
- 設備アンカー候補（GTFS Facility/Group）: stairs:facility-group:F011:2511710b8cff4238ab4ea99cc9627c2f@Space:95df59e6f72840699a8d8c337a2b38bd (427L0090, -3→-2) / elevator:facility-group:F012:5d1f5e6da998477b95766fa1b4ac995f@Space:c9c8acca204c4a069f025133c979090d (427L0135, -3→-3) / stairs:facility-group:F011:ae87ce6b29a24767ab45ce163140545b@Space:952dbd7ff41a488397224bff06a0e413 (427L0108, -3→-2.5)
- 内部trial選択: 427N0075 → 427N0084
- semantic評価: 階段3・ES1・EV1・設備変更3・分岐9・159.6m
- 設備列: elevator:427L0135 / elevator:427L0089 / elevator:427L0059 / fare-gate:427L0066 / stairs:427L0007 / escalator:427L0012 / stairs:427L0016 / stairs:427L0042
- ホーム→垂直移動→改札: 改札前に垂直移動あり（fare gate level -1→-1）。垂直設備の存在は確認できるが、号車との対応は未証明
- 判定: **UNRESOLVED MAPPING**（公式号車位置とGTFS boarding areaを結ぶデータがないため、本番選択不可）
- 紙面preview: 本番表示なし。号車・設備を断定する文言は生成しない。

### 東新宿

- 公式候補: 5号車付近=EV、2・7号車付近=ES；A2はEV/ESの2行
- 目的改札: 改札（名称記載なし）
- GTFS候補数: 39
- 設備アンカー候補（GTFS Facility/Group）: stairs:facility-group:F011:e15fadeee1e44df0bfd20aab549a9e9b@Space:117b090fecb84ffbbd1d2ecb193dfdaa (403L0034, -3→-2.5) / elevator:facility-group:F012:b85002bc5c7441c4958af93eeed839c1@Space:5f61c083641d4b308b1f11d713aad3c0 (403L0006, -3→-3) / stairs:facility-group:F011:f52c357846494fac80dcb5e7fc6b3163@Space:0e43d9d8d05140999facecbe63f2be43 (403L0040, -3→-2.5) / escalator:facility-group:F013:05c09786d39d4c1ebfa86dc8dc6a38a9@Space:0d3b6ccbd5b242e8979f169788c75b64 (403L0037, -3→-2) / escalator:facility-group:F013:405281273b3e4b45a27d72799a22deff@Space:3fa9629a58b74352a2f70c98465d48a6 (403L0039, -3→-2)
- 内部trial選択: 403N0031 → 403N0020
- semantic評価: 階段0・ES0・EV2・設備変更0・分岐6・106.9m
- 設備列: elevator:403L0006 / elevator:403L0038 / elevator:403L0055 / fare-gate:403L0043 / elevator:403L0077 / elevator:403L0078 / elevator:403L0111
- ホーム→垂直移動→改札: 改札前に垂直移動あり（fare gate level -2→-2）。垂直設備の存在は確認できるが、号車との対応は未証明
- 判定: **UNRESOLVED MAPPING**（公式号車位置とGTFS boarding areaを結ぶデータがないため、本番選択不可）
- 紙面preview: 本番表示なし。号車・設備を断定する文言は生成しない。

### 都庁前

- 公式候補: 4号車付近=EV、2・7号車付近=ES；改札→A4=EV（一部・始発〜22:00）
- 目的改札: 改札（名称記載なし）
- GTFS候補数: 14
- 設備アンカー候補（GTFS Facility/Group）: stairs:facility-group:F011:c0b0cd4921744d0f932faf8d56271e15@Space:3ee3d9cb3b204ab38bf24d6d5e71ddf1 (429L0102, -3→-2.5) / elevator:facility-group:F012:2990ADA44FF946CAA4A187E76FD8033B@Space:07e1e2a33e5e44c1adb7268d8290bd01 (429L0071, -3→-3) / stairs:facility-group:F011:dd3f13ef054d45fdb9dea9cfc041cec1@Space:07e1e2a33e5e44c1adb7268d8290bd01 (429L0105, -3→-2.5)
- 内部trial選択: 429N0033 → 429N0093
- semantic評価: 階段1・ES3・EV0・設備変更1・分岐14・216.8m
- 設備列: escalator:429L0101 / fare-gate:429L0143 / escalator:429L0196 / escalator:429L0254 / stairs:429L0286 / stairs:429L0288
- ホーム→垂直移動→改札: 改札前に垂直移動あり（fare gate level -2→-2）。垂直設備の存在は確認できるが、号車との対応は未証明
- 判定: **UNRESOLVED MAPPING**（公式号車位置とGTFS boarding areaを結ぶデータがないため、本番選択不可）
- 紙面preview: 本番表示なし。号車・設備を断定する文言は生成しない。

## 結論

- RECOMMENDED: 0駅
- MULTIPLE OPTIONS: 0駅（公式候補は複数だが、号車→boarding area mapping未解決のため選択結果を確定扱いしない）
- UNRESOLVED MAPPING: 5駅
- DATA CONFLICT: 0駅

内部trialでは全5駅でGTFS route候補の比較自体は可能だった。しかし、号車位置と具体的boarding areaを公式に接続できないため、本番StationGuideへの高齢者route選択はまだ進めない。

## 都庁前 A4

A4側EVは始発〜22:00。時間外はこの設備を前提にした紙面を出さず、別候補または係員確認が必要。

