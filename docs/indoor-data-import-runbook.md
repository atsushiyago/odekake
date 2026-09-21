# 大江戸線12駅・駅構内データ取り込み手順

対象は公共交通オープンデータチャレンジ2026が2026-09-17に公開した大江戸線12駅のデータである。駅構内案内は安全に関わるため、この手順を満たさないデータを紙向け案内に使わない。

## 1. 取得前の確認

1. [チャレンジ2026公式ページ](https://challenge2026.odpt.org/) で対象駅・公開日を確認する。
2. [GTFS-Pathwaysリソース](https://ckan.odpt.org/dataset/train-toei/resource/b1019650-4cf5-4f2f-b2c6-87156825e365) と[ほこナビの都営地下鉄タグ](https://ckan.hokonavi.go.jp/dataset/?tags=%E9%83%BD%E5%96%B6%E5%9C%B0%E4%B8%8B%E9%89%84)で、配布URL、更新日、ライセンスを確認する。
3. 取得日時、ダウンロード元URL、ライセンス、更新日、SHA-256を記録する。抽出スクリプトは出力JSONの `artifact.sha256` にZIPのSHA-256を自動記録する。旧カタログの記録と混同しない。

## 2. GTFS-Pathwaysの自動取り込み範囲

`stops.txt`、`levels.txt`、`pathways.txt`を読み、各駅の `location_type=1` のstation IDを起点にする。

開発時は `scripts/extract-toei-gtfs-pathways.mjs` にローカル保存したZIP、station ID、取得元URL、ライセンス、feed version、出力先を渡す。出力JSONをレビューしてからfixtureまたはサーバー側の取り込みデータに採用する。スクリプトはネットワークアクセスしない。

スクリプトは、渡されたstation IDが `location_type=1` の駅レコードであり、同じレコードの駅名が指定値と一致することを確認する。不一致なら出力せず停止する。

- `parent_station` の子孫だけを対象駅へ含める。
- `pathway_mode`、`is_bidirectional`、`length`、緯度経度、`level_id`を保持する。
- `src/data/adapters/gtfsPathwaysAdapter.ts` で共通形式へ変換する。
- 実行後に、欠損ノード参照、到達不能なホーム起点、未知の経路種別を監査する。

駅名検索や座標近接で他駅のノードを混ぜない。

## 3. 歩行空間ネットワークの自動取り込み範囲

公開CSVのnode/linkを保持し、距離、階、`route_type`、`direction`を `walkingNetwork.ts` で正規化する。

- `direction=99` は方向不明なので探索に含めない。
- `route_type` から階段・ES・EV等を読むが、車椅子対応を推定しない。
- GTFS stopとの接続は、公式または人が確認したID対応表がある場合だけ行う。

## 4. 構内地図の扱い

構内地図GeoJSONは施設・階・空間の表示・確認用であり、単独では歩行経路グラフにしない。

- データセットが明示する仕様書の版を記録する。
- カテゴリコードの意味はその版の仕様書で確認する。
- 地図POIとGTFS/歩行ネットワークIDは、座標近接で結合しない。

## 5. 紙向け案内の人手レビュー

単一の紙向け経路を出すには、`VerifiedIndoorRouteAnchor` を登録する。

- 到着ホーム、正確なboarding area、出口を指定する。
- 確認者、実在する確認日、HTTPSの公式根拠URLを記録する。
- `resolveVerifiedIndoorRoute` の監査に通ることを確認する。
- 案内板名、右左、改札固有名、車椅子適合性は、別の公式根拠または現地確認がある場合だけ加える。

これらが揃わない駅は、出口までの推測案内を印刷せず、安全な代替案内だけを出す。
