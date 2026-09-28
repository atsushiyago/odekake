# GTFS–walking-network node crosswalk audit

Generated: 2026-09-27T22:26:13.512Z

## Scope and method

All 12 supported station GTFS fixtures were compared with same-station walking nodes. Coordinates were compared with a haversine distance in meters; only numerically equal GTFS level_index and walking floor were considered. This floor equality is a **provisional filter**, not proof that the two source systems share an official Floor. exact/strong below are spatial classifications, **not accepted crosswalks**. Thresholds: exact ≤0.5m with ≥0.5m gap to second; strong ≤1.5m with ≥0.5m gap; ambiguous otherwise within 5m; unmatched beyond 5m or no same-floor node. The complete per-stop candidate diagnostics are in [JSON](./gtfs-walking-node-crosswalk-audit.json).

## All stations

| Station | GTFS stops | Walking nodes | exact | strong | ambiguous | unmatched | nearest vertical conflicts | median / p90 nearest m |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 赤羽橋※ | 124 | 23 | 23 | 1 | 11 | 89 | 34 | 6.689 / 14.763 |
| 青山一丁目 | 253 | 271 | 248 | 0 | 2 | 3 | 0 | 0.041 / 0.057 |
| 麻布十番 | 203 | 211 | 200 | 0 | 0 | 3 | 0 | 0.039 / 0.056 |
| 大門 | 329 | 340 | 325 | 0 | 1 | 3 | 0 | 0.042 / 0.059 |
| 東新宿 | 100 | 110 | 97 | 0 | 0 | 3 | 0 | 0.041 / 0.057 |
| 国立競技場 | 285 | 301 | 281 | 0 | 1 | 3 | 0 | 0.041 / 0.058 |
| 六本木 | 252 | 267 | 249 | 0 | 0 | 3 | 0 | 0.039 / 0.057 |
| 新宿 | 209 | 233 | 147 | 1 | 7 | 54 | 12 | 0.047 / 49.057 |
| 新宿西口 | 212 | 225 | 201 | 0 | 8 | 3 | 0 | 0.041 / 0.056 |
| 都庁前 | 261 | 269 | 252 | 1 | 3 | 5 | 0 | 0.04 / 0.058 |
| 上野御徒町 | 240 | 247 | 237 | 0 | 0 | 3 | 0 | 0.04 / 0.056 |
| 代々木 | 130 | 138 | 127 | 0 | 0 | 3 | 0 | 0.038 / 0.056 |

※ 赤羽橋は23 node／22 linkの検証用subsetのみ。全量coverageの判断には使えない。全量GeoJSONは残り11駅で確認。

## Overall

GTFS stops 2598; exact 2387, strong 3, ambiguous 33, unmatched 175. Full walking data: 11/12 stations.

| Nearest distance | Nodes |
|---|---:|
| 0–0.5m | 2401 |
| 0.5–1.5m | 3 |
| 1.5–2m | 0 |
| 2–5m | 19 |
| >5m | 101 |
| floor missing/no same-floor node | 74 |

全量データの11駅だけでは 2364/2474 nodeがspatial exact。赤羽橋の部分データを含めたcoverage率としては解釈しない。

## Node types and equipment

| GTFS context | Nodes | exact | strong | ambiguous | unmatched | vertical topology compatible | close vertical conflict |
|---|---:|---:|---:|---:|---:|---:|---:|
| elevator | 171 | 163 | 0 | 2 | 6 | 165 | 0 |
| escalator | 374 | 341 | 1 | 9 | 23 | 356 | 0 |
| stairs | 840 | 791 | 1 | 9 | 39 | 794 | 0 |
| fareGate | 40 | 32 | 0 | 1 | 7 | 0 | 0 |
| platformOrBoarding | 325 | 275 | 0 | 2 | 48 | 0 | 0 |
| exit | 67 | 65 | 0 | 2 | 0 | 14 | 0 |

設備行は同一nodeを複数行に含み得る。fare gateにはwalking route_typeの直接対応がなく、platform/boarding areaとexitも座標以外の対応証拠が必要。

## Adjacent-link topology check

GTFSのfare gate/exit gateを除く2843 Pathwayを対象に、両端nodeのspatial classがexact/strongの場合だけ、walking linkの両端・設備種別・移動方向を順番に照合した。これはnode候補の補助検証であり、採用済みcrosswalkではない。

| Station | Comparable Pathways | Both endpoints clear | Same walking link | Same equipment type | Source direction compatible | Bidirectional compatible |
|---|---:|---:|---:|---:|---:|---:|
| 赤羽橋※ | 133 | 23 | 22 | 20 | 20 | 20 |
| 青山一丁目 | 271 | 268 | 267 | 259 | 259 | 259 |
| 麻布十番 | 223 | 223 | 223 | 214 | 214 | 214 |
| 大門 | 363 | 362 | 362 | 347 | 347 | 347 |
| 東新宿 | 106 | 106 | 106 | 103 | 103 | 103 |
| 国立競技場 | 312 | 310 | 310 | 298 | 298 | 298 |
| 六本木 | 278 | 278 | 278 | 263 | 263 | 263 |
| 新宿 | 231 | 162 | 162 | 157 | 157 | 157 |
| 新宿西口 | 236 | 223 | 223 | 219 | 219 | 219 |
| 都庁前 | 293 | 285 | 281 | 275 | 275 | 275 |
| 上野御徒町 | 255 | 255 | 255 | 232 | 232 | 232 |
| 代々木 | 142 | 142 | 142 | 140 | 140 | 140 |
| 全体 | 2843 | 2637 | 2631 | 2527 | 2527 | 2527 |

### Link topology or equipment differences

Both endpoints are spatially clear in these 110 GTFS Pathways, but the direct walking link or its type/direction differs. This is source-data disagreement, not permission to infer a replacement link. All cases appear in JSON. Representative groups:

- 上野御徒町 410L0076: GTFS mode 1, walking route_type 7 (different-equipment-type; 12件の同型差分)
- 上野御徒町 410L0220: GTFS mode 1, walking route_type 99 (different-equipment-type; 11件の同型差分)
- 国立競技場 426L0287: GTFS mode 1, walking route_type 99 (different-equipment-type; 10件の同型差分)
- 大門 421L0360: GTFS mode 1, walking route_type 99 (different-equipment-type; 9件の同型差分)
- 六本木 424L0028: GTFS mode 1, walking route_type 7 (different-equipment-type; 8件の同型差分)
- 青山一丁目 425L0281: GTFS mode 1, walking route_type 99 (different-equipment-type; 7件の同型差分)
- 六本木 424L0001: GTFS mode 1, walking route_type 99 (different-equipment-type; 7件の同型差分)
- 大門 421L0118: GTFS mode 1, walking route_type 7 (different-equipment-type; 6件の同型差分)
- 麻布十番 423L0009: GTFS mode 1, walking route_type 7 (different-equipment-type; 5件の同型差分)
- 新宿 428L0110: GTFS mode 1, walking route_type 7 (different-equipment-type; 5件の同型差分)
- 麻布十番 423L0094: GTFS mode 1, walking route_type 99 (different-equipment-type; 4件の同型差分)
- 新宿西口 402L0011: GTFS mode 1, walking route_type 7 (different-equipment-type; 4件の同型差分)
- 都庁前 429L0021: GTFS mode 1, walking route_type direct linkなし (no-direct-walking-link; 4件の同型差分)
- 都庁前 429L0298: GTFS mode 1, walking route_type 99 (different-equipment-type; 4件の同型差分)
- 東新宿 403L0112: GTFS mode 1, walking route_type 99 (different-equipment-type; 3件の同型差分)

## Representative exceptions

### Multiple close candidates

- 青山一丁目 425N0169（GTFS 5、walking 4、0.035m、2m内4件）; nearest 9c1a9b899fd44e01bae5b69261f9efc1, second 3124c9549bd3405f8958dda81a098a38, gap 0.462m
- 青山一丁目 425N0170（GTFS 5、walking 4、0.046m、2m内4件）; nearest 3124c9549bd3405f8958dda81a098a38, second 9c1a9b899fd44e01bae5b69261f9efc1, gap 0.469m
- 大門 421N0084（GTFS 1、walking 1、0.058m、2m内2件）; nearest 6c1e3b0dd65649a199cec255f8b97bf5, second 6e6bb850731843c68ef8dcce55a6bb0b, gap 0.499m
- 国立競技場 426N0077（GTFS 1、walking 1、0.04m、2m内2件）; nearest 3937cec9f64446afb315c9507332723f, second 6bcf0e7520c84197aabaa1499e10b2f5, gap 0.307m
- 新宿西口 402N0026（GTFS 1、walking 7、0.032m、2m内5件）; nearest af35db0bfdcf4608a2ba7cafb8a749e8, second 84695d83b84d4aa9b7e85070606fc828, gap 0.145m
- 新宿西口 402N0027（GTFS 1、walking 1/7、0.039m、2m内5件）; nearest 84695d83b84d4aa9b7e85070606fc828, second af35db0bfdcf4608a2ba7cafb8a749e8, gap 0.143m
- 新宿西口 402N0038（GTFS 1/2、walking 1/6、0.043m、2m内2件）; nearest cfcd38745e744bada31e74ca9ab1866b, second bf67d9bc63054748ab6c4b3491d9fd8d, gap 0.474m
- 新宿西口 402N0039（GTFS 1/2、walking 1/6、0.049m、2m内3件）; nearest bf67d9bc63054748ab6c4b3491d9fd8d, second cfcd38745e744bada31e74ca9ab1866b, gap 0.476m
- 新宿西口 402N0066（GTFS 1/2、walking 1/6、0.028m、2m内5件）; nearest 9a17f9e33e614451bb9bf5baddc3a8a1, second dc1a1cad89c24edfb6793f03f5b9f1f7, gap 0.459m
- 新宿西口 402N0131（GTFS 1、walking 1、0.068m、2m内4件）; nearest 6184c64654354d089efba9c2d8f32bc5, second 431dfcc6fecb4d47aa0fbfbc7085a1aa, gap 0.365m
- 新宿西口 402N0132（GTFS 1、walking 1、0.051m、2m内4件）; nearest 431dfcc6fecb4d47aa0fbfbc7085a1aa, second 6184c64654354d089efba9c2d8f32bc5, gap 0.449m
- 新宿西口 402N0207（GTFS 1、walking 1/7、0.041m、2m内5件）; nearest dc1a1cad89c24edfb6793f03f5b9f1f7, second 9a17f9e33e614451bb9bf5baddc3a8a1, gap 0.397m

### Different vertical equipment at the nearest node

No close nearest-node vertical conflicts observed; this does not prove correspondence.

### Fare gate vicinity

- 青山一丁目 425N0107（GTFS 1/6、walking 1、0.02m、2m内1件）; walking route_type has no explicit fare-gate counterpart
- 青山一丁目 425N0110（GTFS 1/6、walking 1、0.042m、2m内2件）; walking route_type has no explicit fare-gate counterpart
- 青山一丁目 425N0201（GTFS 1/6、walking 1、0.032m、2m内2件）; walking route_type has no explicit fare-gate counterpart
- 青山一丁目 425N0202（GTFS 1/6、walking 1、0.05m、2m内1件）; walking route_type has no explicit fare-gate counterpart
- 麻布十番 423N0001（GTFS 1/6、walking 1、0.059m、2m内1件）; walking route_type has no explicit fare-gate counterpart
- 麻布十番 423N0003（GTFS 1/6、walking 1、0.022m、2m内1件）; walking route_type has no explicit fare-gate counterpart

## Conclusion

The 11 full-data stations show strong evidence that many nodes share the same published geometry: 2364 spatially exact candidates, with no close nearest-node vertical equipment conflicts. 2527 direct adjacent links also agree on equipment type. This makes a **selective** crosswalk promising. A blanket production crosswalk is **not yet safe**: the numeric floor equality is unverified across sources, 33 nodes are spatially ambiguous, Shinjuku contains 54 unmatched GTFS stops, 110 comparable Pathways differ after clear endpoint matching, and Akabanebashi has only a partial walking network. Fare gates, boarding areas and exits lack a direct semantic counterpart in walking-network route_type. The JSON retains nearest/second distances, gaps, 2m/5m candidate counts, GTFS and walking connection modes, in_out, shared nearest-node claimants and adjacent-link evidence for every GTFS stop. Future acceptance should require source-backed floor alignment, equipment/topology checks and explicit handling of ambiguous nodes. Production StationGuide was not connected to this audit.
