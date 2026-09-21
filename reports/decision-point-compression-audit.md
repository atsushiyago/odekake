# Decision-point compression audit

対象は登録済み12コースの到着駅→出口に向かうGTFS-Pathways経路です。表示用圧縮前の経路から、設備→3m以下のwalkway→同種設備を抽出しました。`branch` は中間ノードの有向次数が3以上、`angle` は中間walkway前後のローカル座標による折れ角です。walking-networkはGTFS node IDとの公式対応表がないため、Roppongi以外は「直接照合不能」とし、推測で補完していません。

分類は次の基準です。

- **SAFE TO MERGE**: 分岐なし、短い平場、方向継続、同一設備または公式geometryで一続きと確認できる。
- **KEEP SEPARATE**: 分岐・明確な方向転換・別設備選択がある。
- **UNCERTAIN**: GTFS/Space/Facilityだけでは利用者の判断不要と断定できない。

|station|course|equipment|pathway sequence|short flat|Facility IDs|Space IDs|branch|angle|classification|reason|expected reduction|
|---|---|---|---|---:|---|---|---|---:|---|---|---:|
|赤羽橋|東京タワー|stairs|422L0110 → 422L0111 → 422L0112|1.4m|e944… / – / e944…|eefc… / eefc… / eefc…|No|3.5°|SAFE TO MERGE|同一Facility・同一Space・同方向|1|
|六本木|国立新美術館|stairs|424L0008 → 424L0009 → 424L0010|1.5m|b443… / – / b443…|360… / 3cca… / 3cca…|No|0.3°|SAFE TO MERGE|同一階段設備、直線的|1|
|六本木|国立新美術館|stairs|424L0010 → 424L0011 → 424L0012|1.5m|b443… / – / 767…|3cca… / 360… / 360…|No|0.2°|SAFE TO MERGE|Facilityは異なるが、同一方向・同一経路空間。walking-networkも1.6mリンクで整合|1|
|六本木|国立新美術館|stairs|424L0012 → 424L0013 → 424L0014|3.0m|767… / – / 767…|360… / 360… / 360…|No|1.0°|SAFE TO MERGE|同一Facility・同一Space|1|
|大門|旧芝離宮恩賜庭園|stairs|421L0311 → 421L0312 → 421L0309|1.5m|6aad… / – / 6aad…|49e… / 6fc… / 6fc…|No|1.5°|SAFE TO MERGE|同一Facility・上方向継続|1|
|大門|旧芝離宮恩賜庭園|stairs|421L0309 → 421L0316 → 421L0286|3.0m|6aad… / – / c2b…|6fc… / 6a09… / 6a09…|Yes|16.3°|KEEP SEPARATE|分岐あり、設備境界もある|0|
|大門|旧芝離宮恩賜庭園|stairs|421L0286 → 421L0287 → 421L0285|1.8m|c2b… / – / c2b…|6a09… / 913… / 913…|No|70.2°|KEEP SEPARATE|大きな方向転換|0|
|麻布十番|パティオ十番|stairs|423L0050 → 423L0051 → 423L0052|1.6m|819… / – / 819…|b977… / b977… / b977…|No|2.0°|SAFE TO MERGE|同一Facility・同一Space|1|
|麻布十番|パティオ十番|stairs|423L0061 → 423L0062 → 423L0063|1.7m|7ced… / – / 7ced…|a739… / a739… / a739…|No|1.1°|SAFE TO MERGE|同一Facility・同一Space|1|
|麻布十番|パティオ十番|stairs|423L0065 → 423L0066 → 423L0067|2.1m|5eab… / – / 5eab…|3ffc… / 3ffc… / 3ffc…|No|2.4°|SAFE TO MERGE|同一Facility・同一Space|1|
|青山一丁目|いちょう並木|stairs|425L0232 → 425L0231 → 425L0230|2.5m|dfc… / – / dfc…|– / – / –|No|0.9°|SAFE TO MERGE|同一Facility・分岐なし|1|
|青山一丁目|いちょう並木|stairs|425L0279 → 425L0278 → 425L0233|1.6m|dfc… / – / dfc…|– / – / –|No|40.8°|SAFE TO MERGE|公式構内図で同一階段設備の踊り場と確認でき、同一Facility・無分岐。拡張角度条件を適用|1|
|青山一丁目|いちょう並木|stairs|425L0233 → 425L0234 → 425L0235|1.2m|dfc… / – / –|– / – / –|No|2.0°|UNCERTAIN|後段Facility/Space対応が欠け、別設備でないと断定不可|0|
|代々木|明治神宮・代々木口|stairs|427L0009 → 427L0010 → 427L0011|2.5m|48fa… / – / 48fa…|b812… / b812… / b812…|No|0.8°|SAFE TO MERGE|同一Facility・同一Space|1|
|代々木|明治神宮・代々木口|stairs|427L0016 → 427L0043 → 427L0042|2.5m|94be… / – / 48fa…|940… / – / b812…|No|13.4°|UNCERTAIN|Facility/Spaceが切り替わり、別設備選択の有無を判断できない|0|
|東新宿|新宿文化センター|stairs|403L0089 → 403L0090 → 403L0091|1.5m|47d… / – / 47d…|366… / – / 9fc…|No|2.3°|UNCERTAIN|同一FacilityだがSpaceが切り替わる|0|
|東新宿|新宿文化センター|stairs|403L0091 → 403L0093 → 403L0094|0.9m|47d… / – / 202…|9fc… / 9fc… / 9fc…|No|3.1°|SAFE TO MERGE|同一Space・直線的|1|
|東新宿|新宿文化センター|stairs|403L0079 → 403L0080 → 403L0081|1.5m|fca… / – / 47d…|e9c… / – / –|No|1.8°|UNCERTAIN|Facility/Spaceの対応が連続していない|0|
|東新宿|新宿文化センター|stairs|403L0081 → 403L0082 → 403L0084|1.5m|47d… / – / 47d…|– / – / –|No|1.4°|SAFE TO MERGE|同一Facility・同方向|1|
|新宿|サザンタワー|escalator|428L0253 → 428L0254 → 428L0004|1.5m|2ff… / – / fde…|51e… / 51e… / 51e…|No|4.1°|KEEP SEPARATE|エスカレーターFacilityが異なる|0|
|新宿|サザンタワー|escalator|428L0255 → 428L0258 → 428L0013|1.5m|5cf… / – / 7eb…|52c… / 792… / 792…|No|1.3°|KEEP SEPARATE|異なるエスカレーター設備・Space|0|
|新宿|サザンタワー|escalator|428L0014 → 428L0259 → 428L0256|1.4m|743… / – / 743…|37c… / 37c… / 52c…|No|4.5°|SAFE TO MERGE|同一Facility・分岐なし|1|
|新宿西口|思い出横丁|stairs|402L0147 → 402L0134 → 402L0128|4.9m|039… / – / f005…|542… / 8d3… / 4a1…|Yes|1.6°|KEEP SEPARATE|5m候補だが分岐・設備境界あり|0|
|新宿西口|思い出横丁|stairs|402L0128 → 402L0127 → 402L0250|1.4m|f005… / – / f005…|4a1… / – / –|No|2.2°|SAFE TO MERGE|同一Facility・分岐なし|1|
|新宿西口|思い出横丁|stairs|402L0250 → 402L0251 → 402L0119|1.9m|f005… / – / fb8…|– / – / –|No|1.3°|UNCERTAIN|Facility/Space境界の根拠不足|0|
|新宿西口|思い出横丁|stairs|402L0119 → 402L0123 → 402L0124|1.6m|fb8… / – / fb8…|– / – / 2ea…|No|0.0°|SAFE TO MERGE|同一Facility・直線的|1|
|新宿西口|思い出横丁|stairs|402L0014 → 402L0017 → 402L0018|1.3m|afe… / – / afe…|fe4… / fe4… / fe4…|No|2.6°|SAFE TO MERGE|同一Facility・同一Space|1|
|新宿西口|思い出横丁|stairs|402L0018 → 402L0019 → 402L0022|1.5m|afe… / – / afe…|fe4… / ba4… / ba4…|No|70.7°|KEEP SEPARATE|方向転換が大きい|0|
|新宿西口|思い出横丁|stairs|402L0022 → 402L0021 → 402L0020|0.6m|afe… / – / afe…|ba4… / ba4… / ba4…|No|6.3°|SAFE TO MERGE|同一Facility・同一Space|1|
|上野御徒町|アメ横|stairs|410L0048 → 410L0049 → 410L0050|1.6m|5a3… / – / ff3…|7a2… / 7a2… / 7a2…|No|1.0°|SAFE TO MERGE|同一Space・分岐なし|1|
|上野御徒町|アメ横|stairs|410L0159 → 410L0160 → 410L0161|1.6m|677… / – / 677…|38e… / e1a… / e1a…|No|3.3°|SAFE TO MERGE|同一Facility・短い平場|1|
|上野御徒町|アメ横|stairs|410L0164 → 410L0165 → 410L0166|3.0m|066… / – / 893…|6b8… / 6b8… / 6b8…|No|90.4°|KEEP SEPARATE|ほぼ直角の方向転換・設備境界|0|
|都庁前|東京都庁展望室|stairs|429L0102 → 429L0103 → 429L0104|1.5m|c0b… / – / 753…|3ee… / 5e3… / 5e3…|No|3.7°|UNCERTAIN|Facility/Space境界の根拠不足|0|
|都庁前|東京都庁展望室|stairs|429L0279 → 429L0280 → 429L0281|1.5m|b8d… / – / b8d…|200… / bb8… / bb8…|No|3.0°|SAFE TO MERGE|同一Facility・分岐なし|1|
|都庁前|東京都庁展望室|stairs|429L0286 → 429L0287 → 429L0288|1.5m|DA7… / – / DA7…|– / – / –|No|2.0°|UNCERTAIN|Space対応が欠ける|0|

## 集計

- 候補総数：35
- SAFE TO MERGE：21
- KEEP SEPARATE：6
- UNCERTAIN：8
- 5m候補：1件（新宿西口 402L0147〜0128、分岐ありのため不採用）

SAFE候補は赤羽橋、大門、麻布十番、青山一丁目、代々木、東新宿、新宿、新宿西口、上野御徒町、都庁前にあります。六本木以外にも、同一Facilityまたは同一Spaceで直線・無分岐の階段／設備列が複数確認できました。青山一丁目の1出口階段列は、公式構内図の連続設備根拠を加えた拡張条件でSAFEと判定しました。

## 結論

候補抽出と安全条件の評価はgeneric rule化できます。ただし、Facility/Space対応が欠ける候補はUNCERTAINとして統合せず、walking-networkとの公式ID対応が追加で確認できた場合にのみ有効化すべきです。今回は青山一丁目の公式構内図で確認できた同一階段設備だけ、駅データ側の証拠フラグを通じてgeneric圧縮を有効化しました。


## 補足：完全な provenance ID

本文表では長さの都合でFacility/Space IDを省略表示した。監査・再現用に、同じ35候補の完全なIDを以下に記録する。`—` は元データに対応値がないことを示す。

| # | 駅 | pathway_id列 | Facility ID（前 / 中間 / 後） | Space ID（前 / 中間 / 後） |
|---:|---|---|---|---|
| 1 | 赤羽橋 | 422L0110 → 422L0111 → 422L0112 | e944b5af29514aaa827aa2dd2110ac74 / — / e944b5af29514aaa827aa2dd2110ac74 | eefc38e0ff94467499ca9b227666c14d / eefc38e0ff94467499ca9b227666c14d / eefc38e0ff94467499ca9b227666c14d |
| 2 | 六本木 | 424L0008 → 424L0009 → 424L0010 | b4437b460618416bb94817ebb0b73f89 / — / b4437b460618416bb94817ebb0b73f89 | 360041df63194e1a82dc8bf7a670525e / 3cca315ef93f46be9db6f4401570fb0b / 3cca315ef93f46be9db6f4401570fb0b |
| 3 | 六本木 | 424L0010 → 424L0011 → 424L0012 | b4437b460618416bb94817ebb0b73f89 / — / 7673225d78cc491fa43128cb93e65313 | 3cca315ef93f46be9db6f4401570fb0b / 360041df63194e1a82dc8bf7a670525e / 360041df63194e1a82dc8bf7a670525e |
| 4 | 六本木 | 424L0012 → 424L0013 → 424L0014 | 7673225d78cc491fa43128cb93e65313 / — / 7673225d78cc491fa43128cb93e65313 | 360041df63194e1a82dc8bf7a670525e / 360041df63194e1a82dc8bf7a670525e / 360041df63194e1a82dc8bf7a670525e |
| 5 | 大門 | 421L0311 → 421L0312 → 421L0309 | 6aad1ca3d2a94faaa7f6e85b104fabaf / — / 6aad1ca3d2a94faaa7f6e85b104fabaf | 49e8879f9a29430b947760fd55e3b6f3 / 6fc4b5460b4f4037a4a2192636c96271 / 6fc4b5460b4f4037a4a2192636c96271 |
| 6 | 大門 | 421L0309 → 421L0316 → 421L0286 | 6aad1ca3d2a94faaa7f6e85b104fabaf / — / c2b8b6523f2c4c79bab0d4354a3f940f | 6fc4b5460b4f4037a4a2192636c96271 / 6a09f7ec3603424dadcde49e1c42064f / 6a09f7ec3603424dadcde49e1c42064f |
| 7 | 大門 | 421L0286 → 421L0287 → 421L0285 | c2b8b6523f2c4c79bab0d4354a3f940f / — / c2b8b6523f2c4c79bab0d4354a3f940f | 6a09f7ec3603424dadcde49e1c42064f / 913d9554dc8041d48c3ab396c131f6be / 913d9554dc8041d48c3ab396c131f6be |
| 8 | 麻布十番 | 423L0050 → 423L0051 → 423L0052 | 819eca70344440dca064381328509422 / — / 819eca70344440dca064381328509422 | b977d2397c3d4ea394c7f66da97431d0 / b977d2397c3d4ea394c7f66da97431d0 / b977d2397c3d4ea394c7f66da97431d0 |
| 9 | 麻布十番 | 423L0061 → 423L0062 → 423L0063 | 7ceda38ff57f4a22930eba1f6ad912e7 / — / 7ceda38ff57f4a22930eba1f6ad912e7 | a7391be7967b47aca14f78a19dd0d5b4 / a7391be7967b47aca14f78a19dd0d5b4 / a7391be7967b47aca14f78a19dd0d5b4 |
| 10 | 麻布十番 | 423L0065 → 423L0066 → 423L0067 | 5eab4d5e7ab64fcdb97319b527e86f85 / — / 5eab4d5e7ab64fcdb97319b527e86f85 | 3ffc7630a2894dfdb9932186e3291549 / 3ffc7630a2894dfdb9932186e3291549 / 3ffc7630a2894dfdb9932186e3291549 |
| 11 | 青山一丁目 | 425L0232 → 425L0231 → 425L0230 | dfc742c557dc4bd6bfb8a1a5e439b8ef / — / dfc742c557dc4bd6bfb8a1a5e439b8ef | — / — / — |
| 12 | 青山一丁目 | 425L0279 → 425L0278 → 425L0233 | dfc742c557dc4bd6bfb8a1a5e439b8ef / — / dfc742c557dc4bd6bfb8a1a5e439b8ef | — / — / — |
| 13 | 青山一丁目 | 425L0233 → 425L0234 → 425L0235 | dfc742c557dc4bd6bfb8a1a5e439b8ef / — / — | — / — / — |
| 14 | 代々木 | 427L0009 → 427L0010 → 427L0011 | 48fa8d5caec14838ad8989c710808f4c / — / 48fa8d5caec14838ad8989c710808f4c | b812fc9370a349de8c77d6c34c4b07ef / b812fc9370a349de8c77d6c34c4b07ef / b812fc9370a349de8c77d6c34c4b07ef |
| 15 | 代々木 | 427L0016 → 427L0043 → 427L0042 | 94bec91d66d64471829d115a39c35be4 / — / 48fa8d5caec14838ad8989c710808f4c | 94024b880c0e43e687b26a28bbc385f9 / — / b812fc9370a349de8c77d6c34c4b07ef |
| 16 | 東新宿 | 403L0089 → 403L0090 → 403L0091 | 47d2582e5e3d4790b30855dd1ed277f9 / — / 47d2582e5e3d4790b30855dd1ed277f9 | 3662169a709d4dcfbb96be322b24108b / — / 9fc4865e43824637a2bbdb9f2bb3c75f |
| 17 | 東新宿 | 403L0091 → 403L0093 → 403L0094 | 47d2582e5e3d4790b30855dd1ed277f9 / — / 20267c8eaebb48b4ad6550cf3876386f | 9fc4865e43824637a2bbdb9f2bb3c75f / 9fc4865e43824637a2bbdb9f2bb3c75f / 9fc4865e43824637a2bbdb9f2bb3c75f |
| 18 | 東新宿 | 403L0079 → 403L0080 → 403L0081 | fca68bcb69ce474d8d6c8fe2c74fc4e6 / — / 47d2582e5e3d4790b30855dd1ed277f9 | e9cd4607cc2247bdb0219b9a50e61f29 / — / — |
| 19 | 東新宿 | 403L0081 → 403L0082 → 403L0084 | 47d2582e5e3d4790b30855dd1ed277f9 / — / 47d2582e5e3d4790b30855dd1ed277f9 | — / — / — |
| 20 | 新宿 | 428L0253 → 428L0254 → 428L0004 | 2ff7e6e990d34a8b9ded25d95e078dbe / — / fde10274392f408dbb1f323e5249885f | 51ec544c653548e5b9dcbe24a824cd2e / 51ec544c653548e5b9dcbe24a824cd2e / 51ec544c653548e5b9dcbe24a824cd2e |
| 21 | 新宿 | 428L0255 → 428L0258 → 428L0013 | 5cf99a8770634633a411fa3cb3aa9338 / — / 7eb34d7f168642499a77a74aeb8f27a3 | 52ceb3deea68487986ce9f82efb9d7b6 / 7923cd2bcc5b49789330aa0e990efea4 / 7923cd2bcc5b49789330aa0e990efea4 |
| 22 | 新宿 | 428L0014 → 428L0259 → 428L0256 | 7431653e643c4fbb8eb49983b7b8796b / — / 7431653e643c4fbb8eb49983b7b8796b | 37cf644721094adcab1be2475894e583 / 37cf644721094adcab1be2475894e583 / 52ceb3deea68487986ce9f82efb9d7b6 |
| 23 | 新宿西口 | 402L0147 → 402L0134 → 402L0128 | 039ffc171d7e4f588b0270400d816228 / — / f0053f423983485eb37c029ea9e05619 | 542049b8825c4bb2971642f319821110 / 8d31aeaad831447a857887f20ad17c83 / 4a18fe74f6b14df7bb58d878b71f751f |
| 24 | 新宿西口 | 402L0128 → 402L0127 → 402L0250 | f0053f423983485eb37c029ea9e05619 / — / f0053f423983485eb37c029ea9e05619 | 4a18fe74f6b14df7bb58d878b71f751f / — / — |
| 25 | 新宿西口 | 402L0250 → 402L0251 → 402L0119 | f0053f423983485eb37c029ea9e05619 / — / fb8acf3095f748e497a5d2a619fcf91e | — / — / — |
| 26 | 新宿西口 | 402L0119 → 402L0123 → 402L0124 | fb8acf3095f748e497a5d2a619fcf91e / — / fb8acf3095f748e497a5d2a619fcf91e | — / — / 2ea93c8e37fa4369a360843527ecc466 |
| 27 | 新宿西口 | 402L0014 → 402L0017 → 402L0018 | afe0eb6dff6c42b0a0cdf39abd19e87e / — / afe0eb6dff6c42b0a0cdf39abd19e87e | fe478946ffdf4c3bbf6dc7f09ff8f0e7 / fe478946ffdf4c3bbf6dc7f09ff8f0e7 / fe478946ffdf4c3bbf6dc7f09ff8f0e7 |
| 28 | 新宿西口 | 402L0018 → 402L0019 → 402L0022 | afe0eb6dff6c42b0a0cdf39abd19e87e / — / afe0eb6dff6c42b0a0cdf39abd19e87e | fe478946ffdf4c3bbf6dc7f09ff8f0e7 / ba430a7eb18343da93570dcd7dacbace / ba430a7eb18343da93570dcd7dacbace |
| 29 | 新宿西口 | 402L0022 → 402L0021 → 402L0020 | afe0eb6dff6c42b0a0cdf39abd19e87e / — / afe0eb6dff6c42b0a0cdf39abd19e87e | ba430a7eb18343da93570dcd7dacbace / ba430a7eb18343da93570dcd7dacbace / ba430a7eb18343da93570dcd7dacbace |
| 30 | 上野御徒町 | 410L0048 → 410L0049 → 410L0050 | 5a3d0653022f49deb1d67987bcf4be6e / — / ff332396875b43f883374f58d8308416 | 7a22e53d23a44358ba2b6f4682ce904e / 7a22e53d23a44358ba2b6f4682ce904e / 7a22e53d23a44358ba2b6f4682ce904e |
| 31 | 上野御徒町 | 410L0159 → 410L0160 → 410L0161 | 6778c24b756e4274b3e9c5f365ad58ab / — / 6778c24b756e4274b3e9c5f365ad58ab | 38e10b0e7ead4abe960ceddcfdf8eb9f / e1a9afa1728c43039b0d6940d1402a12 / e1a9afa1728c43039b0d6940d1402a12 |
| 32 | 上野御徒町 | 410L0164 → 410L0165 → 410L0166 | 0669fea36e35494997538d1c8a98ef81 / — / 893e8f6c83ba49fb8f77181003e4af27 | 6b89c91ac27446b1ba2fab966d0b87cd / 6b89c91ac27446b1ba2fab966d0b87cd / 6b89c91ac27446b1ba2fab966d0b87cd |
| 33 | 都庁前 | 429L0102 → 429L0103 → 429L0104 | c0b0cd4921744d0f932faf8d56271e15 / — / 75301457de8e42c298244c9d1e94bd67 | 3ee3d9cb3b204ab38bf24d6d5e71ddf1 / 5e34f4bf36db416cacc72f7baa8075d8 / 5e34f4bf36db416cacc72f7baa8075d8 |
| 34 | 都庁前 | 429L0279 → 429L0280 → 429L0281 | b8d8ed8c9e62442db850125f35bf2ac1 / — / b8d8ed8c9e62442db850125f35bf2ac1 | 200ed4e44e3d47b89aa43077a217d3cd / bb8daebcf97e46b89a27593829ea26fd / bb8daebcf97e46b89a27593829ea26fd |
| 35 | 都庁前 | 429L0286 → 429L0287 → 429L0288 | DA7A242EEE954CA1A125FD642DD9F7EB / — / DA7A242EEE954CA1A125FD642DD9F7EB | — / — / — |
