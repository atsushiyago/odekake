# 国立競技場 2番ホーム→A2 canonical route audit

生成日: 2026-09-25T05:19:58.048Z

今回は本番StationGuideを変更せず、全boarding areaの候補経路から、ホーム側の垂直設備を共通のcanonical anchorとして選べるかを調査した。

- candidate route数: **36**（A2の重複exit nodeを含む）
- platform floor: 地下3階（presetの公式駅情報根拠とGTFS level -3）
- fare gate: 426L0141、level -1（候補経路で共通）
- A2出口: 426N0139 / 426N0241

## Candidate routeの差分

| 件数 | ホーム側の最初の垂直行動 | Facility | level遷移 |
|---:|---|---|---|
| 4 | stairs | 3b08754c4a4648e29abbb93e5f5a5549 | -3→-2 |
| 14 | elevator | 4d0879a44e6241a09f7c2319aa2f39ac | -3→-3 |
| 12 | elevator | f85ac848190d44eb8f4b374481f6fd56 | -3→-3 |
| 6 | stairs | 08d0804eea0442fbbbcab426af83432d | -3→-2.5 |

### Unique semantic route prefixes

| 件数 | semantic prefix | raw pathway列（facility/space付き） |
|---:|---|---|
| 4 | stairs:-3>-2 / stairs:-2>-2 / stairs:-2>-1 | 426L0115 stairs -3→-2 5.7m (facility=3b08754c4a4648e29abbb93e5f5a5549, space=47d78d807926403e9212e7643a03c717)<br>426L0117 stairs -2→-2 5.5m (facility=8372169dc1a64021a7c58e5cf6507460, space=—)<br>426L0120 stairs -2→-1 4.2m (facility=8372169dc1a64021a7c58e5cf6507460, space=6eb1e4bd479245498816073a531cd1c6) |
| 26 | elevator:-3>-3 / elevator:-3>-1 / elevator:-1>-1 | 426L0052 elevator -3→-3 2.2m (facility=4d0879a44e6241a09f7c2319aa2f39ac, space=63c58bf9fab94f2bac3de19a9b2220bd)<br>426L0121 elevator -3→-1 0.8m (facility=f5ad670e78a041c894f68dea4e4bf8e5, space=255612aee9a4401ab04b1b84f2051146)<br>426L0140 elevator -1→-1 2.1m (facility=f5ad670e78a041c894f68dea4e4bf8e5, space=255612aee9a4401ab04b1b84f2051146) |
| 6 | stairs:-3>-2.5 / stairs:-2.5>-2 / escalator:-2>-1 | 426L0064 stairs -3→-2.5 6.7m (facility=08d0804eea0442fbbbcab426af83432d, space=3faf889d054544bf8524ebd8e793461f)<br>426L0066 stairs -2.5→-2 3.9m (facility=08d0804eea0442fbbbcab426af83432d, space=3faf889d054544bf8524ebd8e793461f)<br>426L0114 escalator -2→-1 14.0m (facility=05360cc9687d445c9a4599f72800e9ac, space=84d88537a54748e4830db7081733c49e) |

### 共通する改札以降のraw列（代表）

- 426L0141 fare-gate -1→-1 2.5m (facility=—, space=11366dbfbb5d46f2b7a3813894b4b44c)<br>426L0142 walk -1→-1 3.2m (facility=—, space=11366dbfbb5d46f2b7a3813894b4b44c)<br>426L0147 walk -1→-1 8.2m (facility=—, space=11366dbfbb5d46f2b7a3813894b4b44c)<br>426L0157 walk -1→-1 1.3m (facility=—, space=11366dbfbb5d46f2b7a3813894b4b44c)<br>426L0166 walk -1→-1 2.0m (facility=—, space=11366dbfbb5d46f2b7a3813894b4b44c)<br>426L0158 walk -1→-1 22.6m (facility=—, space=11366dbfbb5d46f2b7a3813894b4b44c)<br>426L0159 walk -1→-1 3.0m (facility=—, space=11366dbfbb5d46f2b7a3813894b4b44c)<br>426L0160 walk -1→-1 11.2m (facility=—, space=11366dbfbb5d46f2b7a3813894b4b44c)<br>426L0161 walk -1→-1 2.0m (facility=—, space=11366dbfbb5d46f2b7a3813894b4b44c)<br>426L0165 elevator -1→-1 1.6m (facility=3eb71905b7a64f10ad07c8ad74c57ded, space=11366dbfbb5d46f2b7a3813894b4b44c)<br>426L0220 elevator -1→0 0.3m (facility=aae9b7e6f4784e72b1459abebf4b1095, space=72778cffc92a487f983b45441db39dd4)<br>426L0290 elevator 0→0 1.7m (facility=aae9b7e6f4784e72b1459abebf4b1095, space=—)<br>426L0295 walk 0→0 0.9m (facility=—, space=—)<br>426L0332 walk 0→0 1.0m (facility=—, space=—)

candidateごとの全pathway列は、上記のホーム側可変prefixにこの代表tail（426L0141以降）を連結したもの。exit node重複以外の候補差分は、各prefixのoriginとraw pathway IDで追跡できる。


## Canonical anchor判定

ホーム側の最初の垂直設備は **4種類**（階段・エレベーター複数基・エスカレーター）に分かれ、各候補の到達設備が一致しない。最大グループでも 14/36 候補に限られる。

**結論: C. canonical routeは安全に1本へ決定不能。**

- 426P2の全boarding areaが同じホーム側設備へ向かうことを、GTFSグラフから確認できない。
- EV/ES/階段を距離や固定優先順位で選ぶと、他のboarding areaの利用者へ設備を断定することになる。
- 共通して確認できるのは改札（426L0141、level -1）以降の経路であり、ホーム→改札の垂直移動を代表するanchorではない。
- 公式構内図はホーム階（地下3階）と出口方向の整合を確認できるが、全boarding areaから特定設備へ誘導できる根拠までは提供しない。

## before / after

- before: 現行のcommonRouteSuffix版（ホーム側の候補差分を表示せず、共通部分を案内）。
- after: **変更なし**。canonical route表示および「ホームのエスカレーターへ進む」等の最初の一手は追加しない。

## Generic化への示唆

- genericなcanonical選択器は、候補間で設備・level遷移・到達可能性が一致し、かつ公式地図でanchorの共通性を確認できる場合だけ有効化する。
- 一致しない場合はcommonRouteSuffixを維持し、単一設備を推測しない。
