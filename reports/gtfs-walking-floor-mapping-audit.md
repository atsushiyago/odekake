# GTFS level_index ↔ walking-network floor audit

Generated: 2026-09-27T22:34:58.315Z

## Method

All-floor spatial exact/strong + one-to-one nearest node + directly adjacent same-type/direction walking link; no numeric floor equality in seed generation. Unique: >=3 seeds, >=98% dominant, dominant-runner-up >=3, no walking-floor collision across GTFS levels. Partial stations remain provisional. 前回のexact/strongは数値同一floorで候補を絞っていたため、対応推定のseedとして再利用していない。全floor候補から座標が明確で、歩行linkとの直接接続・設備種別・向きまで一致するnode対だけを新たに抽出した。数値一致は判定条件にしていない。一意判定はこの監査用の保守的基準であり、production crosswalkの承認ではない。unresolved levelは再評価でunmatchedとする。

## Station × GTFS level × walking floor

| Station | GTFS level_index | walking floor: seed count | seeds | dominant ratio | 1位−2位 | 判定 |
|---|---:|---|---:|---:|---:|---|
| 赤羽橋※ | -2 | — | 0 | 0.0% | 0 | unresolved |
| 赤羽橋※ | -1.5 | — | 0 | 0.0% | 0 | unresolved |
| 赤羽橋※ | -1 | -1: 11 | 11 | 100.0% | 11 | 暫定 |
| 赤羽橋※ | -0.5 | -0.5: 5 | 5 | 100.0% | 5 | 暫定 |
| 赤羽橋※ | 0 | 0: 2 | 2 | 100.0% | 2 | unresolved |
| 青山一丁目 | -5 | -5: 41 | 41 | 100.0% | 41 | 一意 |
| 青山一丁目 | -4.5 | -4.5: 4 | 4 | 100.0% | 4 | 一意 |
| 青山一丁目 | -4 | -4: 35 | 35 | 100.0% | 35 | 一意 |
| 青山一丁目 | -3.5 | -3.5: 5 | 5 | 100.0% | 5 | 一意 |
| 青山一丁目 | -3 | -3: 16 | 16 | 100.0% | 16 | 一意 |
| 青山一丁目 | -2 | -2: 7 | 7 | 100.0% | 7 | 一意 |
| 青山一丁目 | -1 | -1: 67 | 67 | 100.0% | 67 | 一意 |
| 青山一丁目 | -0.5 | -0.5: 42 | 42 | 100.0% | 42 | 一意 |
| 青山一丁目 | 0 | 0: 9 | 9 | 100.0% | 9 | 一意 |
| 麻布十番 | -6 | -6: 37 | 37 | 100.0% | 37 | 一意 |
| 麻布十番 | -5.5 | -5.5: 8 | 8 | 100.0% | 8 | 一意 |
| 麻布十番 | -5 | -5: 6 | 6 | 100.0% | 6 | 一意 |
| 麻布十番 | -4.5 | -4.5: 2 | 2 | 100.0% | 2 | unresolved |
| 麻布十番 | -4 | -4: 20 | 20 | 100.0% | 20 | 一意 |
| 麻布十番 | -3.5 | -3.5: 2 | 2 | 100.0% | 2 | unresolved |
| 麻布十番 | -3 | -3: 8 | 8 | 100.0% | 8 | 一意 |
| 麻布十番 | -2.5 | -2.5: 12 | 12 | 100.0% | 12 | 一意 |
| 麻布十番 | -2 | -2: 9 | 9 | 100.0% | 9 | 一意 |
| 麻布十番 | -1.5 | -1.5: 2 | 2 | 100.0% | 2 | unresolved |
| 麻布十番 | -1 | -1: 35 | 35 | 100.0% | 35 | 一意 |
| 麻布十番 | -0.5 | -0.5: 26 | 26 | 100.0% | 26 | 一意 |
| 麻布十番 | 0 | 0: 10 | 10 | 100.0% | 10 | 一意 |
| 大門 | -5 | -5: 48 | 48 | 100.0% | 48 | 一意 |
| 大門 | -4.5 | -4.5: 4 | 4 | 100.0% | 4 | 一意 |
| 大門 | -4 | -4: 18 | 18 | 100.0% | 18 | 一意 |
| 大門 | -3.5 | -3.5: 2 | 2 | 100.0% | 2 | unresolved |
| 大門 | -3 | -3: 68 | 68 | 100.0% | 68 | 一意 |
| 大門 | -2.5 | -2.5: 6 | 6 | 100.0% | 6 | 一意 |
| 大門 | -2 | -2: 33 | 33 | 100.0% | 33 | 一意 |
| 大門 | -1.5 | -1.5: 2 | 2 | 100.0% | 2 | unresolved |
| 大門 | -1 | -1: 66 | 66 | 100.0% | 66 | 一意 |
| 大門 | -0.5 | -0.5: 34 | 34 | 100.0% | 34 | 一意 |
| 大門 | 0 | 0: 14 | 14 | 100.0% | 14 | 一意 |
| 東新宿 | -3 | -3: 28 | 28 | 100.0% | 28 | 一意 |
| 東新宿 | -2.5 | -2.5: 4 | 4 | 100.0% | 4 | 一意 |
| 東新宿 | -2 | -2: 23 | 23 | 100.0% | 23 | 一意 |
| 東新宿 | -1 | -1: 26 | 26 | 100.0% | 26 | 一意 |
| 東新宿 | 0 | 0: 4 | 4 | 100.0% | 4 | 一意 |
| 国立競技場 | -3 | -3: 53 | 53 | 100.0% | 53 | 一意 |
| 国立競技場 | -2.5 | -2.5: 6 | 6 | 100.0% | 6 | 一意 |
| 国立競技場 | -2 | -2: 34 | 34 | 100.0% | 34 | 一意 |
| 国立競技場 | -1.5 | -1.5: 4 | 4 | 100.0% | 4 | 一意 |
| 国立競技場 | -1 | -1: 69 | 69 | 100.0% | 69 | 一意 |
| 国立競技場 | -0.5 | -0.5: 78 | 78 | 100.0% | 78 | 一意 |
| 国立競技場 | 0 | 0: 12 | 12 | 100.0% | 12 | 一意 |
| 六本木 | -7 | -7: 17 | 17 | 100.0% | 17 | 一意 |
| 六本木 | -6.5 | -6.5: 2 | 2 | 100.0% | 2 | unresolved |
| 六本木 | -6 | -6: 4 | 4 | 100.0% | 4 | 一意 |
| 六本木 | -5.5 | -5.5: 7 | 7 | 100.0% | 7 | 一意 |
| 六本木 | -5 | -5: 20 | 20 | 100.0% | 20 | 一意 |
| 六本木 | -4.5 | -4.5: 2 | 2 | 100.0% | 2 | unresolved |
| 六本木 | -4 | -4: 31 | 31 | 100.0% | 31 | 一意 |
| 六本木 | -3 | -3: 9 | 9 | 100.0% | 9 | 一意 |
| 六本木 | -2 | -2: 14 | 14 | 100.0% | 14 | 一意 |
| 六本木 | -1.5 | -1.5: 4 | 4 | 100.0% | 4 | 一意 |
| 六本木 | -1 | -1: 46 | 46 | 100.0% | 46 | 一意 |
| 六本木 | -0.5 | -0.5: 60 | 60 | 100.0% | 60 | 一意 |
| 六本木 | 0 | 0: 5 | 5 | 100.0% | 5 | 一意 |
| 新宿 | -6 | -6: 28 | 28 | 100.0% | 28 | 一意 |
| 新宿 | -4.5 | -4.5: 16 | 16 | 100.0% | 16 | 一意 |
| 新宿 | -3 | -3: 39 | 39 | 100.0% | 39 | 一意 |
| 新宿 | -2.5 | -2: 13<br>-2.5: 2 | 15 | 86.7% | 11 | unresolved |
| 新宿 | -2 | -1: 36<br>-2: 23 | 59 | 61.0% | 13 | unresolved |
| 新宿 | -1 | -1: 19<br>-0.5: 10 | 29 | 65.5% | 9 | unresolved |
| 新宿 | 0 | 0: 5 | 5 | 100.0% | 5 | 一意 |
| 新宿西口 | -4 | -4: 22 | 22 | 100.0% | 22 | 一意 |
| 新宿西口 | -3.5 | -3.5: 6 | 6 | 100.0% | 6 | 一意 |
| 新宿西口 | -3 | -3: 48 | 48 | 100.0% | 48 | 一意 |
| 新宿西口 | -2 | -2: 11 | 11 | 100.0% | 11 | 一意 |
| 新宿西口 | -1.5 | -1.5: 24 | 24 | 100.0% | 24 | 一意 |
| 新宿西口 | -1 | -1: 35 | 35 | 100.0% | 35 | 一意 |
| 新宿西口 | -0.7 | -0.7: 4 | 4 | 100.0% | 4 | 一意 |
| 新宿西口 | -0.5 | -0.5: 30 | 30 | 100.0% | 30 | 一意 |
| 新宿西口 | 0 | 0: 1 | 1 | 100.0% | 1 | unresolved |
| 新宿西口 | 1 | 1: 2 | 2 | 100.0% | 2 | unresolved |
| 都庁前 | -3 | -3: 64 | 64 | 100.0% | 64 | 一意 |
| 都庁前 | -2.5 | -2.5: 12 | 12 | 100.0% | 12 | 一意 |
| 都庁前 | -2 | -2: 39<br>-3: 1 | 40 | 97.5% | 38 | unresolved |
| 都庁前 | -1.5 | -1.5: 22 | 22 | 100.0% | 22 | 一意 |
| 都庁前 | -1 | -1: 37 | 37 | 100.0% | 37 | 一意 |
| 都庁前 | -0.5 | -0.5: 44 | 44 | 100.0% | 44 | 一意 |
| 都庁前 | 0 | 0: 5 | 5 | 100.0% | 5 | 一意 |
| 上野御徒町 | -2 | -2: 32 | 32 | 100.0% | 32 | 一意 |
| 上野御徒町 | -1.5 | -1.5: 6 | 6 | 100.0% | 6 | 一意 |
| 上野御徒町 | -1 | -1: 85 | 85 | 100.0% | 85 | 一意 |
| 上野御徒町 | -0.5 | -0.5: 85 | 85 | 100.0% | 85 | 一意 |
| 上野御徒町 | 0 | 0: 11 | 11 | 100.0% | 11 | 一意 |
| 代々木 | -3 | -3: 34 | 34 | 100.0% | 34 | 一意 |
| 代々木 | -2.5 | -2.5: 4 | 4 | 100.0% | 4 | 一意 |
| 代々木 | -2 | -2: 13 | 13 | 100.0% | 13 | 一意 |
| 代々木 | -1.5 | -1.5: 2 | 2 | 100.0% | 2 | unresolved |
| 代々木 | -1 | -1: 22 | 22 | 100.0% | 22 | 一意 |
| 代々木 | -0.5 | -0.5: 38 | 38 | 100.0% | 38 | 一意 |
| 代々木 | 0 | 0: 1 | 1 | 100.0% | 1 | unresolved |

一意 79 floor、赤羽橋subset由来の暫定 2 floor、unresolved 18 floor。※赤羽橋のwalking dataは23 node / 22 linkの検証用subsetであり、全駅coverageや一意性の確定には使えない。

## Crosswalk再集計

| Station | confirmed seed | unique / provisional floors | unresolved levels | before（数値一致filter） | after（推定mapping） |
|---|---:|---:|---|---|---|
| 赤羽橋※ | 18 | 2 | -2, -1.5, 0 | exact 23 / strong 1 / ambiguous 11 / unmatched 89 | exact 18 / strong 1 / ambiguous 8 / unmatched 97 |
| 青山一丁目 | 226 | 9 | — | exact 248 / strong 0 / ambiguous 2 / unmatched 3 | exact 248 / strong 0 / ambiguous 2 / unmatched 3 |
| 麻布十番 | 177 | 10 | -4.5, -3.5, -1.5 | exact 200 / strong 0 / ambiguous 0 / unmatched 3 | exact 194 / strong 0 / ambiguous 0 / unmatched 9 |
| 大門 | 295 | 9 | -3.5, -1.5 | exact 325 / strong 0 / ambiguous 1 / unmatched 3 | exact 321 / strong 0 / ambiguous 1 / unmatched 7 |
| 東新宿 | 85 | 5 | — | exact 97 / strong 0 / ambiguous 0 / unmatched 3 | exact 97 / strong 0 / ambiguous 0 / unmatched 3 |
| 国立競技場 | 256 | 7 | — | exact 281 / strong 0 / ambiguous 1 / unmatched 3 | exact 281 / strong 0 / ambiguous 1 / unmatched 3 |
| 六本木 | 221 | 11 | -6.5, -4.5 | exact 249 / strong 0 / ambiguous 0 / unmatched 3 | exact 245 / strong 0 / ambiguous 0 / unmatched 7 |
| 新宿 | 191 | 4 | -2.5, -2, -1 | exact 147 / strong 1 / ambiguous 7 / unmatched 54 | exact 97 / strong 0 / ambiguous 0 / unmatched 112 |
| 新宿西口 | 183 | 8 | 0, 1 | exact 201 / strong 0 / ambiguous 8 / unmatched 3 | exact 196 / strong 0 / ambiguous 4 / unmatched 12 |
| 都庁前 | 224 | 6 | -2 | exact 252 / strong 1 / ambiguous 3 / unmatched 5 | exact 201 / strong 0 / ambiguous 2 / unmatched 58 |
| 上野御徒町 | 219 | 5 | — | exact 237 / strong 0 / ambiguous 0 / unmatched 3 | exact 237 / strong 0 / ambiguous 0 / unmatched 3 |
| 代々木 | 114 | 5 | -1.5, 0 | exact 127 / strong 0 / ambiguous 0 / unmatched 3 | exact 121 / strong 0 / ambiguous 0 / unmatched 9 |
| 合計 | 2209 | 79 / 2 | 18 floor | exact 2387 / strong 3 / ambiguous 33 / unmatched 175 | exact 2256 / strong 1 / ambiguous 18 / unmatched 323 |

### 変化の内訳

- unmatched→unmatched: 175
- exact→exact: 2256
- exact→unmatched: 131
- ambiguous→ambiguous: 18
- strong→strong: 1
- ambiguous→unmatched: 15
- strong→unmatched: 2

今回一意と判定された対応は全て数値も一致した。数値不一致で新たに救済されたnodeは0件。一方、根拠不足のlevelをunresolvedにしたため、以前のexact/strong/ambiguousからunmatchedへの変化がある。これは経路消失ではなく監査上の判定保留である。

### 複数walking floorに分かれたlevel

- 新宿 level -2.5: floor -2=13, floor -2.5=2 (86.7%、unresolved)
- 新宿 level -2: floor -1=36, floor -2=23 (61.0%、unresolved)
- 新宿 level -1: floor -1=19, floor -0.5=10 (65.5%、unresolved)
- 都庁前 level -2: floor -2=39, floor -3=1 (97.5%、unresolved)

完全なper-node遷移、seed証拠、floor組合せは[JSON](./gtfs-walking-floor-mapping-audit.json)に記録。これは診断のみで、本番StationGuide・route生成・metadataには接続していない。
