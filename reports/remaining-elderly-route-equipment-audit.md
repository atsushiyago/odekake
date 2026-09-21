# 残り6駅 高齢者向け設備監査

調査日: 2026-09-21  
主資料: [東京都交通局「各駅の主なバリアフリー設備設置一覧」](https://www.kotsu.metro.tokyo.jp/initiatives/accessibility/subway/kanren/pdf/barrierfree_guide_oedo.pdf)

## 画像確認の扱い

前回は旧URLの移動により画像確認できなかった。今回は新URLのPDFをブラウザで開き、該当ページ（新宿西口・東新宿=1ページ、大門・麻布十番=4ページ、代々木・都庁前=5ページ）を拡大表示し、各行の先頭アイコンを凡例と照合した。設備種別は、エレベーター（EV）、エスカレーター（ES）、階段として読み取った。`一部`および運転時間の注記も画像上で確認した。

| station | arrival platform | target exit | target gate | car position | equipment | note | GTFS consistency | classification | recommended wording |
|---|---|---|---|---|---|---|---|---|---|
| 大門 | 3番ホーム | B2 | JR浜松町方面改札 | 5号車付近=EV、1・4号車付近=ES、6・8号車付近=階段 | 改札→B2=ES（一部） | B2は「一部」。ホーム→改札は複数設備で、B2側はES。GTFS 421P3→B2と接続 | GTFS経路と整合 | MULTIPLE OPTIONS | 「B2は一部。号車は候補を固定しない」 |
| 麻布十番 | 2番ホーム | 7 | 改札（名称記載なし） | 4号車付近=EV、2・8号車付近=ES | 改札→7=ES（一部) | 7は「一部」。4号車はEV→改札後ES、2・8号車はES→改札後ES。時間注記は7行に直接なし | GTFS 423P2→7と接続 | MULTIPLE OPTIONS | 「7出口は一部。号車・設備は固定しない」 |
| 代々木 | 2番ホーム | A2 | 改札（名称記載なし） | 5号車付近=EV、1号車付近=ES（一部）、4・8号車付近=階段 | 改札→A2=ES（一部） | A2は「一部」。階段を避ける候補は5号車EVまたは1号車ESだが、出口側ESが共通 | GTFS 427P2→A2と接続 | MULTIPLE OPTIONS | 「A2は一部。階段回避候補は複数」 |
| 東新宿 | 2番ホーム | A2 | 改札（名称記載なし） | 5号車付近=EV、2・7号車付近=ES | 改札→A2=EVまたはES（A2の記載が2行） | A2にEV系・ES系の両行がある。単一設備・号車を選ぶ根拠なし | GTFS 403P2→A2候補と接続 | MULTIPLE OPTIONS | 「A2へはEV/ES候補あり。固定しない」 |
| 新宿西口 | 1番ホーム | D3 | D3接続改札の公式バリアフリー記載なし | 5号車付近=EV→改札、2号車付近=ES→JR新宿駅方面改札、7号車付近=階段→小滝橋通り方面改札 | D3行なし | 公式表の改札→地上はD2/D5のみで、D3への設備・改札対応は確認できない | GTFS 402P1→D3候補は存在 | INSUFFICIENT EVIDENCE | 「D3向け号車・設備は表示しない」 |
| 都庁前 | 4番ホーム | A4 | 改札（名称記載なし） | 4号車付近=EV、2・7号車付近=ES | 改札→A4=EV（一部） | A4は「一部」、始発〜22:00まで運転。4号車EVが目的出口側と直接対応するが、時間制限あり | GTFS 429P4→A4と整合 | MULTIPLE OPTIONS | 「A4は一部・始発〜22:00。時間外は別案内が必要」 |

## 上野御徒町 1番ホーム→A7

既存監査で11/11 boarding areaについて、ホーム階 `-2` から改札階 `-1` への同一semantic action（階段・上方向）が成立している。今回、`commonRouteSuffix` の前段からこの合意部分を復元するgeneric処理を追加した。

- 復元前: 12 semantic steps（共通suffix生成、ホーム側の合意垂直移動は表示列の先頭にない）
- 復元後: 11 semantic steps。先頭に `階段を上がる`（地下2階→地下1階）を置き、重複していた候補側の接続表現を共通列から置き換えた
- summary: 階段 4回→4回、改札 1回→1回（設備の利用回数は変えず、表示位置と意味単位を修正）
- provenance: 全候補のPathway ID、ノード、Space/Facility mapLocationを1 stepのevidenceへ連結
- candidate coverage: `matchingOrigins=11 / totalOrigins=11`
- 方向: `-2 → -1`（上がる）

異なる候補の半階レベル分割は、同じ設備種別・同じ上方向・同じ始終階の連続移動として正規化した。候補間で意味が一致しない場合は復元しない。今回の復元は上野御徒町のStationMap compression contextでのみオプトインし、他駅の表示は変更していない。

## 集計

- RECOMMENDED: 0駅（目的出口までの候補を一意に決める根拠が不足）
- MULTIPLE OPTIONS: 5駅（大門、麻布十番、代々木、東新宿、都庁前）
- INSUFFICIENT EVIDENCE: 1駅（新宿西口）
- DATA CONFLICT: 0駅

## 結論

新URLの画像確認により設備種別は確定できたが、複数の号車・設備候補が残る駅が多く、今回の目的出口へ向かう「一意の推奨号車」を確定できる駅はなかった。新宿西口はD3自体が公式表の改札↔地上欄にないため、引き続き判定不能とする。6駅の本番StationGuide・号車表示は変更していない。

## 前回監査からの変更

- PDF取得不能による暫定判定を解除し、画像・凡例に基づくEV/ES/階段の判定へ更新。
- 分類は `0 / 4 / 2` から `0 / 5 / 1` に変更（大門がINSUFFICIENTからMULTIPLEへ、新宿西口のみINSUFFICIENT）。
- 上野御徒町の実装・StationGuide、および6駅の本番表示コードは変更していない。
