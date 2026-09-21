# 6駅 ホーム→改札階 level transition consensus audit

調査日: 2026-09-21

設備種類は比較せず、各boarding-area候補の最初のfare gateまでに成立するlevel transitionだけを比較した。公式号車位置やFacilityへのmappingは行わない。

| station | candidate count | platform level | gate level | upward coverage | equipment kinds (参考) | consensus | proposed wording |
|---|---:|---|---|---:|---|---|---|
| 大門 | 15 | -5 | -3 | 15/15 | stairs, elevator | LEVEL CONSENSUS | ホームから改札階へ上がる |
| 麻布十番 | 14 | -6 | -4 | 14/14 | stairs, escalator, elevator | LEVEL CONSENSUS | ホームから改札階へ上がる |
| 代々木 | 13 | -3 | -1 | 13/13 | stairs, elevator | LEVEL CONSENSUS | ホームから改札階へ上がる |
| 東新宿 | 22 | -3 | -2 | 22/22 | stairs, elevator | LEVEL CONSENSUS | ホームから改札階へ上がる |
| 新宿西口 | 6 | -4 | -3 | 6/6 | stairs, escalator, elevator | LEVEL CONSENSUS | ホームから改札階へ上がる |
| 都庁前 | 13 | -3 | -2 | 13/13 | stairs, elevator | LEVEL CONSENSUS | ホームから改札階へ上がる |

## 大門

- platform: 421P3
- candidates: 15
- platform levels: -5
- gate levels: -3
- candidate signatures: -5>-3:up / -5>-3:up / -5>-3:up / -5>-3:up / -5>-3:up / -5>-3:up / -5>-3:up / -5>-3:up / -5>-3:up / -5>-3:up / -5>-3:up / -5>-3:up / -5>-3:up / -5>-3:up / -5>-3:up
- vertical semantic usage count: 3, 1
- equipment kinds (reference only): stairs, elevator
- upward transitions: 15/15
- classification: **LEVEL CONSENSUS**
- proposed wording: ホームから改札階へ上がる
- production StationGuide: 未変更

## 麻布十番

- platform: 423P2
- candidates: 14
- platform levels: -6
- gate levels: -4
- candidate signatures: -6>-4:up / -6>-4:up / -6>-4:up / -6>-4:up / -6>-4:up / -6>-4:up / -6>-4:up / -6>-4:up / -6>-4:up / -6>-4:up / -6>-4:up / -6>-4:up / -6>-4:up / -6>-4:up
- vertical semantic usage count: 3, 2, 1
- equipment kinds (reference only): stairs, escalator, elevator
- upward transitions: 14/14
- classification: **LEVEL CONSENSUS**
- proposed wording: ホームから改札階へ上がる
- production StationGuide: 未変更

## 代々木

- platform: 427P2
- candidates: 13
- platform levels: -3
- gate levels: -1
- candidate signatures: -3>-1:up / -3>-1:up / -3>-1:up / -3>-1:up / -3>-1:up / -3>-1:up / -3>-1:up / -3>-1:up / -3>-1:up / -3>-1:up / -3>-1:up / -3>-1:up / -3>-1:up
- vertical semantic usage count: 2, 1, 4
- equipment kinds (reference only): stairs, elevator
- upward transitions: 13/13
- classification: **LEVEL CONSENSUS**
- proposed wording: ホームから改札階へ上がる
- production StationGuide: 未変更

## 東新宿

- platform: 403P2
- candidates: 22
- platform levels: -3
- gate levels: -2
- candidate signatures: -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up
- vertical semantic usage count: 2, 1
- equipment kinds (reference only): stairs, elevator
- upward transitions: 22/22
- classification: **LEVEL CONSENSUS**
- proposed wording: ホームから改札階へ上がる
- production StationGuide: 未変更

## 新宿西口

- platform: 402P1
- candidates: 6
- platform levels: -4
- gate levels: -3
- candidate signatures: -4>-3:up / -4>-3:up / -4>-3:up / -4>-3:up / -4>-3:up / -4>-3:up
- vertical semantic usage count: 2, 1
- equipment kinds (reference only): stairs, escalator, elevator
- upward transitions: 6/6
- classification: **LEVEL CONSENSUS**
- proposed wording: ホームから改札階へ上がる
- production StationGuide: 未変更

## 都庁前

- platform: 429P4
- candidates: 13
- platform levels: -3
- gate levels: -2
- candidate signatures: -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up / -3>-2:up
- vertical semantic usage count: 2, 1
- equipment kinds (reference only): stairs, elevator
- upward transitions: 13/13
- classification: **LEVEL CONSENSUS**
- proposed wording: ホームから改札階へ上がる
- production StationGuide: 未変更

## 結論

- LEVEL CONSENSUS: 大門、麻布十番、代々木、東新宿、新宿西口、都庁前
- NO CONSENSUS: なし
- DATA CONFLICT: なし

LEVEL CONSENSUSの場合も、設備名は本文に出さず、「ホームから改札階へ上がる」だけをgenericに表示候補とする。Floorの正式名称が未照合なら「地下○階」は生成しない。
