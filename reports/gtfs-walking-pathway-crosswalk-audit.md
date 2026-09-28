# GTFS Pathway ↔ walking link verified crosswalk audit

Generated: 2026-09-27T22:40:37.787Z

## 判定方法

Resolved floor; exact/strong nearest node with >=0.5m gap and one-to-one claim; exactly one direct walking link; same equipment mode; compatible forward/reverse direction. Partial stations excluded from production eligibility. floor対応は[前回監査](./gtfs-walking-floor-mapping-audit.md)の一意判定だけを使用。GTFS level_indexの数値とwalking floorの一致は要求しない。駅固有の例外なし。複数の失敗条件があるPathwayは floor → node → link → mode → direction の順で最初の理由に分類した。全件の証拠は[JSON](./gtfs-walking-pathway-crosswalk-audit.json)に保存。

## 12駅別

| 駅 | Pathways | verified | verified率 | 本番利用資格あり |
|---|---:|---:|---:|---:|
| 赤羽橋※ | 134 | 0 | 0.0% | 0 |
| 青山一丁目 | 273 | 259 | 94.9% | 259 |
| 麻布十番 | 224 | 205 | 91.5% | 205 |
| 大門 | 364 | 335 | 92.0% | 335 |
| 東新宿 | 107 | 103 | 96.3% | 103 |
| 国立競技場 | 314 | 298 | 94.9% | 298 |
| 六本木 | 280 | 257 | 91.8% | 257 |
| 新宿 | 236 | 106 | 44.9% | 106 |
| 新宿西口 | 238 | 216 | 90.8% | 216 |
| 都庁前 | 294 | 209 | 71.1% | 209 |
| 上野御徒町 | 257 | 232 | 90.3% | 232 |
| 代々木 | 143 | 134 | 93.7% | 134 |
| 合計 | 2864 | 2354 | 82.2% | 2354 |

※赤羽橋はwalking-network subsetのみ。局所的に条件を満たしても全量データでの一意性を確認できず、本番利用資格は0件。

## Failure reason

| 理由 | 件数 |
|---|---:|
| floor_unresolved | 378 |
| node_unmatched | 0 |
| node_ambiguous | 15 |
| no_walking_link | 1 |
| multiple_walking_links | 6 |
| mode_mismatch | 110 |
| direction_mismatch | 0 |

## 設備別

| GTFS mode | Pathways | verified | 率 |
|---|---:|---:|---:|
| 通常通路 (1) | 2103 | 1736 | 82.5% |
| 階段 (2) | 423 | 362 | 85.6% |
| 動く歩道 (3) | 1 | 1 | 100.0% |
| エスカレーター (4) | 187 | 150 | 80.2% |
| エレベーター (5) | 129 | 105 | 81.4% |
| 改札 (6) | 21 | 0 | 0.0% |

## 前回の2527/2637との関係

前回の2527/2637は、数値同一floorを仮定したnode候補に対し、比較可能なPathwayの直接link設備種別を照合した中間集計であり、両端の一意性・floor対応・linkの一意性・逆方向を含む方向整合を全て満たしたverified件数ではない。今回の分母は改札modeを含む全2864 Pathwaysであるため、割合の単純な増減比較はできない。

## 本番利用の結論

条件を満たした2354件は、駅固有IDに依存しないselective crosswalk候補として利用可能。ただし今回は監査結果であり、本番StationGuide・経路探索には接続していない。未verified edgeを推測で補完せず、将来接続時もwalking networkの経路情報を保持したままfallbackする必要がある。
