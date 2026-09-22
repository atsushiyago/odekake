# Vertical movement semantic consensus audit

生成日: 2026-09-22T08:21:38.802Z

対象はcommonRouteSuffixの前段で垂直移動がStationGuideから落ちる可能性がある8コースです。candidate routeをedge IDではなく、設備種別・方向・level遷移・意味上の連続利用回数で比較しました。今回は本番生成ロジックを変更していません。

## 国立競技場 / 国立競技場

- arrival platform: 426P2 (番号不明)
- platform floor: candidate origin levels=-3
- fare gate floor: -1
- candidate数: 36
- common suffix: 0 edges
- classification: **B. CHOICE REQUIRED**
- semantic consensus: なし
- expected restored action: 単一案内を復元しない
- gate floor display: level値としては可能。ただし公式Floor名称との一致確認が必要

| candidate | boarding area | prefix vertical actions | pathway detail |
|---:|---|---|---|
| 1 | 426N0000 | 階段上がる(-3→-2)×1 / 階段移動する(-2→-2)×1 / 階段上がる(-2→-1)×1 / EV上がる(-1→0)×3 | 426L0115 stairs -3→-2 5.7m<br>426L0117 stairs -2→-2 5.5m<br>426L0120 stairs -2→-1 4.2m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 2 | 426N0019 | 階段上がる(-3→-2)×1 / 階段移動する(-2→-2)×1 / 階段上がる(-2→-1)×1 / EV上がる(-1→0)×3 | 426L0115 stairs -3→-2 5.7m<br>426L0117 stairs -2→-2 5.5m<br>426L0120 stairs -2→-1 4.2m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 3 | 426N0024 | EV上がる(-3→-1)×3 / EV上がる(-1→0)×3 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 4 | 426N0034 | EV上がる(-3→-1)×3 / EV上がる(-1→0)×3 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 5 | 426N0042 | EV上がる(-3→-1)×3 / EV上がる(-1→0)×3 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 6 | 426N0051 | EV上がる(-3→-1)×3 / EV上がる(-1→0)×3 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 7 | 426N0078 | EV上がる(-3→-1)×3 / EV上がる(-1→0)×3 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 8 | 426N0079 | EV上がる(-3→-1)×3 / EV上がる(-1→0)×3 | 426L0058 elevator -3→-3 2.5m<br>426L0122 elevator -3→-1 0.9m<br>426L0139 elevator -1→-1 2.1m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 9 | 426N0090 | EV上がる(-3→-1)×3 / EV上がる(-1→0)×3 | 426L0058 elevator -3→-3 2.5m<br>426L0122 elevator -3→-1 0.9m<br>426L0139 elevator -1→-1 2.1m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 10 | 426N0100 | EV上がる(-3→-1)×3 / EV上がる(-1→0)×3 | 426L0058 elevator -3→-3 2.5m<br>426L0122 elevator -3→-1 0.9m<br>426L0139 elevator -1→-1 2.1m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 11 | 426N0101 | EV上がる(-3→-1)×3 / EV上がる(-1→0)×3 | 426L0058 elevator -3→-3 2.5m<br>426L0122 elevator -3→-1 0.9m<br>426L0139 elevator -1→-1 2.1m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 12 | 426N0131 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / ES上がる(-2→-1)×1 / EV上がる(-1→0)×3 | 426L0064 stairs -3→-2.5 6.7m<br>426L0066 stairs -2.5→-2 3.9m<br>426L0114 escalator -2→-1 14.0m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 13 | 426N0145 | EV上がる(-3→-1)×3 / EV上がる(-1→0)×3 | 426L0058 elevator -3→-3 2.5m<br>426L0122 elevator -3→-1 0.9m<br>426L0139 elevator -1→-1 2.1m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 14 | 426N0148 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / ES上がる(-2→-1)×1 / EV上がる(-1→0)×3 | 426L0064 stairs -3→-2.5 6.7m<br>426L0066 stairs -2.5→-2 3.9m<br>426L0114 escalator -2→-1 14.0m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 15 | 426N0149 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / ES上がる(-2→-1)×1 / EV上がる(-1→0)×3 | 426L0064 stairs -3→-2.5 6.7m<br>426L0066 stairs -2.5→-2 3.9m<br>426L0114 escalator -2→-1 14.0m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 16 | 426N0285 | EV上がる(-3→-1)×3 / EV上がる(-1→0)×3 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 17 | 426N0286 | EV上がる(-3→-1)×3 / EV上がる(-1→0)×3 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 18 | 426N0288 | EV上がる(-3→-1)×3 / EV上がる(-1→0)×3 | 426L0058 elevator -3→-3 2.5m<br>426L0122 elevator -3→-1 0.9m<br>426L0139 elevator -1→-1 2.1m<br>426L0165 elevator -1→-1 1.6m<br>426L0220 elevator -1→0 0.3m<br>426L0290 elevator 0→0 1.7m |
| 19 | 426N0000 | 階段上がる(-3→-2)×1 / 階段移動する(-2→-2)×1 / 階段上がる(-2→-1)×1 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0115 stairs -3→-2 5.7m<br>426L0117 stairs -2→-2 5.5m<br>426L0120 stairs -2→-1 4.2m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 20 | 426N0019 | 階段上がる(-3→-2)×1 / 階段移動する(-2→-2)×1 / 階段上がる(-2→-1)×1 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0115 stairs -3→-2 5.7m<br>426L0117 stairs -2→-2 5.5m<br>426L0120 stairs -2→-1 4.2m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 21 | 426N0024 | EV上がる(-3→-1)×3 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 22 | 426N0034 | EV上がる(-3→-1)×3 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 23 | 426N0042 | EV上がる(-3→-1)×3 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 24 | 426N0051 | EV上がる(-3→-1)×3 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 25 | 426N0078 | EV上がる(-3→-1)×3 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 26 | 426N0079 | EV上がる(-3→-1)×3 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0058 elevator -3→-3 2.5m<br>426L0122 elevator -3→-1 0.9m<br>426L0139 elevator -1→-1 2.1m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 27 | 426N0090 | EV上がる(-3→-1)×3 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0058 elevator -3→-3 2.5m<br>426L0122 elevator -3→-1 0.9m<br>426L0139 elevator -1→-1 2.1m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 28 | 426N0100 | EV上がる(-3→-1)×3 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0058 elevator -3→-3 2.5m<br>426L0122 elevator -3→-1 0.9m<br>426L0139 elevator -1→-1 2.1m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 29 | 426N0101 | EV上がる(-3→-1)×3 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0058 elevator -3→-3 2.5m<br>426L0122 elevator -3→-1 0.9m<br>426L0139 elevator -1→-1 2.1m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 30 | 426N0131 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / ES上がる(-2→-1)×1 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0064 stairs -3→-2.5 6.7m<br>426L0066 stairs -2.5→-2 3.9m<br>426L0114 escalator -2→-1 14.0m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 31 | 426N0145 | EV上がる(-3→-1)×3 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0058 elevator -3→-3 2.5m<br>426L0122 elevator -3→-1 0.9m<br>426L0139 elevator -1→-1 2.1m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 32 | 426N0148 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / ES上がる(-2→-1)×1 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0064 stairs -3→-2.5 6.7m<br>426L0066 stairs -2.5→-2 3.9m<br>426L0114 escalator -2→-1 14.0m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 33 | 426N0149 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / ES上がる(-2→-1)×1 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0064 stairs -3→-2.5 6.7m<br>426L0066 stairs -2.5→-2 3.9m<br>426L0114 escalator -2→-1 14.0m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 34 | 426N0285 | EV上がる(-3→-1)×3 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 35 | 426N0286 | EV上がる(-3→-1)×3 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0052 elevator -3→-3 2.2m<br>426L0121 elevator -3→-1 0.8m<br>426L0140 elevator -1→-1 2.1m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |
| 36 | 426N0288 | EV上がる(-3→-1)×3 / ES上がる(-1→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / 階段移動する(-0.5→-0.5)×1 / ES上がる(-0.5→0)×1 | 426L0058 elevator -3→-3 2.5m<br>426L0122 elevator -3→-1 0.9m<br>426L0139 elevator -1→-1 2.1m<br>426L0211 escalator -1→-0.5 13.5m<br>426L0309 stairs -0.5→-0.5 4.9m<br>426L0311 stairs -0.5→-0.5 7.8m<br>426L0326 stairs -0.5→-0.5 4.6m<br>426L0328 stairs -0.5→-0.5 4.9m<br>426L0219 escalator -0.5→0 15.9m |

- 判定根拠: candidate間で設備種別、方向、level遷移、または回数が一致しない。

### 復元候補の注意

Facility IDが同じでもcandidate間の進入位置が異なる場合があるため、単一candidateの設備を代表値として採用しない。

## 大門 / 旧芝離宮恩賜庭園

- arrival platform: 421P3 (番号不明)
- platform floor: candidate origin levels=-5
- fare gate floor: -3
- candidate数: 15
- common suffix: 18 edges
- classification: **B. CHOICE REQUIRED**
- semantic consensus: なし
- expected restored action: 単一案内を復元しない
- gate floor display: level値としては可能。ただし公式Floor名称との一致確認が必要

| candidate | boarding area | prefix vertical actions | pathway detail |
|---:|---|---|---|
| 1 | 421N0045 | 階段上がる(-5→-4.5)×1 / 階段上がる(-4.5→-4)×1 / 階段上がる(-4→-3)×1 | 421L0061 stairs -5→-4.5 4.0m<br>421L0054 stairs -4.5→-4 3.7m<br>421L0073 stairs -4→-3 9.9m |
| 2 | 421N0052 | 階段上がる(-5→-4.5)×1 / 階段上がる(-4.5→-4)×1 / 階段上がる(-4→-3)×1 | 421L0061 stairs -5→-4.5 4.0m<br>421L0054 stairs -4.5→-4 3.7m<br>421L0073 stairs -4→-3 9.9m |
| 3 | 421N0053 | 階段上がる(-5→-4.5)×1 / 階段上がる(-4.5→-4)×1 / 階段上がる(-4→-3)×1 | 421L0061 stairs -5→-4.5 4.0m<br>421L0054 stairs -4.5→-4 3.7m<br>421L0073 stairs -4→-3 9.9m |
| 4 | 421N0070 | EV上がる(-5→-3)×3 | 421L0024 elevator -5→-5 1.9m<br>421L0058 elevator -5→-3 0.6m<br>421L0091 elevator -3→-3 2.2m |
| 5 | 421N0076 | EV上がる(-5→-3)×3 | 421L0024 elevator -5→-5 1.9m<br>421L0058 elevator -5→-3 0.6m<br>421L0091 elevator -3→-3 2.2m |
| 6 | 421N0117 | EV上がる(-5→-3)×3 | 421L0024 elevator -5→-5 1.9m<br>421L0058 elevator -5→-3 0.6m<br>421L0091 elevator -3→-3 2.2m |
| 7 | 421N0118 | EV上がる(-5→-3)×3 | 421L0024 elevator -5→-5 1.9m<br>421L0058 elevator -5→-3 0.6m<br>421L0091 elevator -3→-3 2.2m |
| 8 | 421N0123 | EV上がる(-5→-3)×3 | 421L0024 elevator -5→-5 1.9m<br>421L0058 elevator -5→-3 0.6m<br>421L0091 elevator -3→-3 2.2m |
| 9 | 421N0124 | EV上がる(-5→-3)×3 | 421L0024 elevator -5→-5 1.9m<br>421L0058 elevator -5→-3 0.6m<br>421L0091 elevator -3→-3 2.2m |
| 10 | 421N0158 | EV上がる(-5→-3)×3 | 421L0024 elevator -5→-5 1.9m<br>421L0058 elevator -5→-3 0.6m<br>421L0091 elevator -3→-3 2.2m |
| 11 | 421N0164 | EV上がる(-5→-3)×3 | 421L0024 elevator -5→-5 1.9m<br>421L0058 elevator -5→-3 0.6m<br>421L0091 elevator -3→-3 2.2m |
| 12 | 421N0165 | EV上がる(-5→-3)×3 | 421L0024 elevator -5→-5 1.9m<br>421L0058 elevator -5→-3 0.6m<br>421L0091 elevator -3→-3 2.2m |
| 13 | 421N0166 | EV上がる(-5→-3)×3 | 421L0024 elevator -5→-5 1.9m<br>421L0058 elevator -5→-3 0.6m<br>421L0091 elevator -3→-3 2.2m |
| 14 | 421N0171 | EV上がる(-5→-3)×3 | 421L0024 elevator -5→-5 1.9m<br>421L0058 elevator -5→-3 0.6m<br>421L0091 elevator -3→-3 2.2m |
| 15 | 421N0208 | EV上がる(-5→-3)×3 | 421L0024 elevator -5→-5 1.9m<br>421L0058 elevator -5→-3 0.6m<br>421L0091 elevator -3→-3 2.2m |

- 判定根拠: candidate間で設備種別、方向、level遷移、または回数が一致しない。

### 復元候補の注意

Facility IDが同じでもcandidate間の進入位置が異なる場合があるため、単一candidateの設備を代表値として採用しない。

## 麻布十番 / パティオ十番

- arrival platform: 423P2 (番号不明)
- platform floor: candidate origin levels=-6
- fare gate floor: -4
- candidate数: 14
- common suffix: 24 edges
- classification: **B. CHOICE REQUIRED**
- semantic consensus: なし
- expected restored action: 単一案内を復元しない
- gate floor display: level値としては可能。ただし公式Floor名称との一致確認が必要

| candidate | boarding area | prefix vertical actions | pathway detail |
|---:|---|---|---|
| 1 | 423N0010 | 階段上がる(-6→-5.5)×1 / 階段上がる(-5.5→-5)×1 / ES上がる(-5→-4)×1 | 423L0226 stairs -6→-5.5 3.8m<br>423L0228 stairs -5.5→-5 4.5m<br>423L0177 escalator -5→-4 12.6m |
| 2 | 423N0020 | 階段上がる(-6→-5.5)×1 / 階段上がる(-5.5→-5)×1 / ES上がる(-5→-4)×1 | 423L0226 stairs -6→-5.5 3.8m<br>423L0228 stairs -5.5→-5 4.5m<br>423L0177 escalator -5→-4 12.6m |
| 3 | 423N0044 | 階段上がる(-6→-5.5)×1 / 階段上がる(-5.5→-5)×1 / ES上がる(-5→-4)×1 | 423L0222 stairs -6→-5.5 3.8m<br>423L0224 stairs -5.5→-5 3.8m<br>423L0177 escalator -5→-4 12.6m |
| 4 | 423N0045 | 階段上がる(-6→-5.5)×1 / 階段上がる(-5.5→-5)×1 / ES上がる(-5→-4)×1 | 423L0222 stairs -6→-5.5 3.8m<br>423L0224 stairs -5.5→-5 3.8m<br>423L0177 escalator -5→-4 12.6m |
| 5 | 423N0049 | 階段上がる(-6→-5.5)×1 / 階段上がる(-5.5→-5)×1 / ES上がる(-5→-4)×1 | 423L0222 stairs -6→-5.5 3.8m<br>423L0224 stairs -5.5→-5 3.8m<br>423L0177 escalator -5→-4 12.6m |
| 6 | 423N0107 | 階段上がる(-6→-5.5)×1 / 階段移動する(-5.5→-5.5)×1 / 階段上がる(-5.5→-4)×1 | 423L0230 stairs -6→-5.5 4.5m<br>423L0232 stairs -5.5→-5.5 5.4m<br>423L0234 stairs -5.5→-4 4.9m |
| 7 | 423N0120 | 階段上がる(-6→-5.5)×1 / 階段移動する(-5.5→-5.5)×1 / 階段上がる(-5.5→-4)×1 | 423L0230 stairs -6→-5.5 4.5m<br>423L0232 stairs -5.5→-5.5 5.4m<br>423L0234 stairs -5.5→-4 4.9m |
| 8 | 423N0132 | EV上がる(-6→-4)×3 | 423L0194 elevator -6→-6 2.4m<br>423L0173 elevator -6→-4 0.5m<br>423L0133 elevator -4→-4 2.4m |
| 9 | 423N0148 | EV上がる(-6→-4)×3 | 423L0194 elevator -6→-6 2.4m<br>423L0173 elevator -6→-4 0.5m<br>423L0133 elevator -4→-4 2.4m |
| 10 | 423N0150 | EV上がる(-6→-4)×3 | 423L0194 elevator -6→-6 2.4m<br>423L0173 elevator -6→-4 0.5m<br>423L0133 elevator -4→-4 2.4m |
| 11 | 423N0154 | EV上がる(-6→-4)×3 | 423L0194 elevator -6→-6 2.4m<br>423L0173 elevator -6→-4 0.5m<br>423L0133 elevator -4→-4 2.4m |
| 12 | 423N0156 | EV上がる(-6→-4)×3 | 423L0194 elevator -6→-6 2.4m<br>423L0173 elevator -6→-4 0.5m<br>423L0133 elevator -4→-4 2.4m |
| 13 | 423N0170 | 階段上がる(-6→-5.5)×1 / 階段上がる(-5.5→-5)×1 / ES上がる(-5→-4)×1 | 423L0226 stairs -6→-5.5 3.8m<br>423L0228 stairs -5.5→-5 4.5m<br>423L0177 escalator -5→-4 12.6m |
| 14 | 423N0171 | 階段上がる(-6→-5.5)×1 / 階段上がる(-5.5→-5)×1 / ES上がる(-5→-4)×1 | 423L0226 stairs -6→-5.5 3.8m<br>423L0228 stairs -5.5→-5 4.5m<br>423L0177 escalator -5→-4 12.6m |

- 判定根拠: candidate間で設備種別、方向、level遷移、または回数が一致しない。

### 復元候補の注意

Facility IDが同じでもcandidate間の進入位置が異なる場合があるため、単一candidateの設備を代表値として採用しない。

## 代々木 / 明治神宮・代々木口

- arrival platform: 427P2 (番号不明)
- platform floor: candidate origin levels=-3
- fare gate floor: -1
- candidate数: 13
- common suffix: 22 edges
- classification: **B. CHOICE REQUIRED**
- semantic consensus: なし
- expected restored action: 単一案内を復元しない
- gate floor display: level値としては可能。ただし公式Floor名称との一致確認が必要

| candidate | boarding area | prefix vertical actions | pathway detail |
|---:|---|---|---|
| 1 | 427N0001 | 階段上がる(-3→-2)×1 / 階段移動する(-2→-2)×1 / 階段移動する(-2→-2)×1 / 階段上がる(-2→-1)×1 | 427L0090 stairs -3→-2 3.5m<br>427L0092 stairs -2→-2 3.9m<br>427L0094 stairs -2→-2 4.2m<br>427L0096 stairs -2→-1 4.0m |
| 2 | 427N0044 | 階段上がる(-3→-2)×1 / 階段移動する(-2→-2)×1 / 階段移動する(-2→-2)×1 / 階段上がる(-2→-1)×1 | 427L0090 stairs -3→-2 3.5m<br>427L0092 stairs -2→-2 3.9m<br>427L0094 stairs -2→-2 4.2m<br>427L0096 stairs -2→-1 4.0m |
| 3 | 427N0055 | EV上がる(-3→-1)×3 | 427L0135 elevator -3→-3 1.4m<br>427L0089 elevator -3→-1 0.2m<br>427L0059 elevator -1→-1 1.3m |
| 4 | 427N0062 | EV上がる(-3→-1)×3 | 427L0135 elevator -3→-3 1.4m<br>427L0089 elevator -3→-1 0.2m<br>427L0059 elevator -1→-1 1.3m |
| 5 | 427N0068 | EV上がる(-3→-1)×3 | 427L0135 elevator -3→-3 1.4m<br>427L0089 elevator -3→-1 0.2m<br>427L0059 elevator -1→-1 1.3m |
| 6 | 427N0075 | EV上がる(-3→-1)×3 | 427L0135 elevator -3→-3 1.4m<br>427L0089 elevator -3→-1 0.2m<br>427L0059 elevator -1→-1 1.3m |
| 7 | 427N0079 | EV上がる(-3→-1)×3 | 427L0135 elevator -3→-3 1.4m<br>427L0089 elevator -3→-1 0.2m<br>427L0059 elevator -1→-1 1.3m |
| 8 | 427N0113 | EV上がる(-3→-1)×3 | 427L0135 elevator -3→-3 1.4m<br>427L0089 elevator -3→-1 0.2m<br>427L0059 elevator -1→-1 1.3m |
| 9 | 427N0115 | EV上がる(-3→-1)×3 | 427L0135 elevator -3→-3 1.4m<br>427L0089 elevator -3→-1 0.2m<br>427L0059 elevator -1→-1 1.3m |
| 10 | 427N0122 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 427L0108 stairs -3→-2.5 4.1m<br>427L0110 stairs -2.5→-2 3.9m<br>427L0085 stairs -2→-1.5 3.5m<br>427L0087 stairs -1.5→-1 3.5m |
| 11 | 427N0123 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 427L0108 stairs -3→-2.5 4.1m<br>427L0110 stairs -2.5→-2 3.9m<br>427L0085 stairs -2→-1.5 3.5m<br>427L0087 stairs -1.5→-1 3.5m |
| 12 | 427N0128 | EV上がる(-3→-1)×3 | 427L0135 elevator -3→-3 1.4m<br>427L0089 elevator -3→-1 0.2m<br>427L0059 elevator -1→-1 1.3m |
| 13 | 427N0131 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 427L0108 stairs -3→-2.5 4.1m<br>427L0110 stairs -2.5→-2 3.9m<br>427L0085 stairs -2→-1.5 3.5m<br>427L0087 stairs -1.5→-1 3.5m |

- 判定根拠: candidate間で設備種別、方向、level遷移、または回数が一致しない。

### 復元候補の注意

Facility IDが同じでもcandidate間の進入位置が異なる場合があるため、単一candidateの設備を代表値として採用しない。

## 東新宿 / 新宿文化センター

- arrival platform: 403P2 (番号不明)
- platform floor: candidate origin levels=-3
- fare gate floor: -2
- candidate数: 22
- common suffix: 0 edges
- classification: **B. CHOICE REQUIRED**
- semantic consensus: なし
- expected restored action: 単一案内を復元しない
- gate floor display: level値としては可能。ただし公式Floor名称との一致確認が必要

| candidate | boarding area | prefix vertical actions | pathway detail |
|---:|---|---|---|
| 1 | 403N0000 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / 階段上がる(-2→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段上がる(-1→0)×1 | 403L0034 stairs -3→-2.5 5.2m<br>403L0036 stairs -2.5→-2 1.6m<br>403L0089 stairs -2→-1 4.4m<br>403L0091 stairs -1→-1 4.4m<br>403L0094 stairs -1→-1 5.0m<br>403L0079 stairs -1→-1 4.0m<br>403L0081 stairs -1→-1 4.1m<br>403L0084 stairs -1→0 3.0m |
| 2 | 403N0025 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / 階段上がる(-2→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段上がる(-1→0)×1 | 403L0034 stairs -3→-2.5 5.2m<br>403L0036 stairs -2.5→-2 1.6m<br>403L0089 stairs -2→-1 4.4m<br>403L0091 stairs -1→-1 4.4m<br>403L0094 stairs -1→-1 5.0m<br>403L0079 stairs -1→-1 4.0m<br>403L0081 stairs -1→-1 4.1m<br>403L0084 stairs -1→0 3.0m |
| 3 | 403N0028 | EV上がる(-3→-2)×3 / 階段上がる(-2→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段上がる(-1→0)×1 | 403L0006 elevator -3→-3 1.4m<br>403L0038 elevator -3→-2 0.2m<br>403L0055 elevator -2→-2 1.3m<br>403L0089 stairs -2→-1 4.4m<br>403L0091 stairs -1→-1 4.4m<br>403L0094 stairs -1→-1 5.0m<br>403L0079 stairs -1→-1 4.0m<br>403L0081 stairs -1→-1 4.1m<br>403L0084 stairs -1→0 3.0m |
| 4 | 403N0030 | EV上がる(-3→-2)×3 / 階段上がる(-2→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段上がる(-1→0)×1 | 403L0006 elevator -3→-3 1.4m<br>403L0038 elevator -3→-2 0.2m<br>403L0055 elevator -2→-2 1.3m<br>403L0089 stairs -2→-1 4.4m<br>403L0091 stairs -1→-1 4.4m<br>403L0094 stairs -1→-1 5.0m<br>403L0079 stairs -1→-1 4.0m<br>403L0081 stairs -1→-1 4.1m<br>403L0084 stairs -1→0 3.0m |
| 5 | 403N0031 | EV上がる(-3→-2)×3 / 階段上がる(-2→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段上がる(-1→0)×1 | 403L0006 elevator -3→-3 1.4m<br>403L0038 elevator -3→-2 0.2m<br>403L0055 elevator -2→-2 1.3m<br>403L0089 stairs -2→-1 4.4m<br>403L0091 stairs -1→-1 4.4m<br>403L0094 stairs -1→-1 5.0m<br>403L0079 stairs -1→-1 4.0m<br>403L0081 stairs -1→-1 4.1m<br>403L0084 stairs -1→0 3.0m |
| 6 | 403N0045 | EV上がる(-3→-2)×3 / 階段上がる(-2→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段上がる(-1→0)×1 | 403L0006 elevator -3→-3 1.4m<br>403L0038 elevator -3→-2 0.2m<br>403L0055 elevator -2→-2 1.3m<br>403L0089 stairs -2→-1 4.4m<br>403L0091 stairs -1→-1 4.4m<br>403L0094 stairs -1→-1 5.0m<br>403L0079 stairs -1→-1 4.0m<br>403L0081 stairs -1→-1 4.1m<br>403L0084 stairs -1→0 3.0m |
| 7 | 403N0046 | EV上がる(-3→-2)×3 / 階段上がる(-2→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段上がる(-1→0)×1 | 403L0006 elevator -3→-3 1.4m<br>403L0038 elevator -3→-2 0.2m<br>403L0055 elevator -2→-2 1.3m<br>403L0089 stairs -2→-1 4.4m<br>403L0091 stairs -1→-1 4.4m<br>403L0094 stairs -1→-1 5.0m<br>403L0079 stairs -1→-1 4.0m<br>403L0081 stairs -1→-1 4.1m<br>403L0084 stairs -1→0 3.0m |
| 8 | 403N0082 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / 階段上がる(-2→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段上がる(-1→0)×1 | 403L0040 stairs -3→-2.5 5.3m<br>403L0042 stairs -2.5→-2 1.6m<br>403L0089 stairs -2→-1 4.4m<br>403L0091 stairs -1→-1 4.4m<br>403L0094 stairs -1→-1 5.0m<br>403L0079 stairs -1→-1 4.0m<br>403L0081 stairs -1→-1 4.1m<br>403L0084 stairs -1→0 3.0m |
| 9 | 403N0084 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / 階段上がる(-2→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段上がる(-1→0)×1 | 403L0040 stairs -3→-2.5 5.3m<br>403L0042 stairs -2.5→-2 1.6m<br>403L0089 stairs -2→-1 4.4m<br>403L0091 stairs -1→-1 4.4m<br>403L0094 stairs -1→-1 5.0m<br>403L0079 stairs -1→-1 4.0m<br>403L0081 stairs -1→-1 4.1m<br>403L0084 stairs -1→0 3.0m |
| 10 | 403N0090 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / 階段上がる(-2→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段上がる(-1→0)×1 | 403L0040 stairs -3→-2.5 5.3m<br>403L0042 stairs -2.5→-2 1.6m<br>403L0089 stairs -2→-1 4.4m<br>403L0091 stairs -1→-1 4.4m<br>403L0094 stairs -1→-1 5.0m<br>403L0079 stairs -1→-1 4.0m<br>403L0081 stairs -1→-1 4.1m<br>403L0084 stairs -1→0 3.0m |
| 11 | 403N0091 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / 階段上がる(-2→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段移動する(-1→-1)×1 / 階段上がる(-1→0)×1 | 403L0040 stairs -3→-2.5 5.3m<br>403L0042 stairs -2.5→-2 1.6m<br>403L0089 stairs -2→-1 4.4m<br>403L0091 stairs -1→-1 4.4m<br>403L0094 stairs -1→-1 5.0m<br>403L0079 stairs -1→-1 4.0m<br>403L0081 stairs -1→-1 4.1m<br>403L0084 stairs -1→0 3.0m |
| 12 | 403N0000 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / EV上がる(-2→0)×3 | 403L0034 stairs -3→-2.5 5.2m<br>403L0036 stairs -2.5→-2 1.6m<br>403L0077 elevator -2→-2 0.9m<br>403L0078 elevator -2→0 0.3m<br>403L0111 elevator 0→0 0.8m |
| 13 | 403N0025 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / EV上がる(-2→0)×3 | 403L0034 stairs -3→-2.5 5.2m<br>403L0036 stairs -2.5→-2 1.6m<br>403L0077 elevator -2→-2 0.9m<br>403L0078 elevator -2→0 0.3m<br>403L0111 elevator 0→0 0.8m |
| 14 | 403N0028 | EV上がる(-3→-2)×3 / EV上がる(-2→0)×3 | 403L0006 elevator -3→-3 1.4m<br>403L0038 elevator -3→-2 0.2m<br>403L0055 elevator -2→-2 1.3m<br>403L0077 elevator -2→-2 0.9m<br>403L0078 elevator -2→0 0.3m<br>403L0111 elevator 0→0 0.8m |
| 15 | 403N0030 | EV上がる(-3→-2)×3 / EV上がる(-2→0)×3 | 403L0006 elevator -3→-3 1.4m<br>403L0038 elevator -3→-2 0.2m<br>403L0055 elevator -2→-2 1.3m<br>403L0077 elevator -2→-2 0.9m<br>403L0078 elevator -2→0 0.3m<br>403L0111 elevator 0→0 0.8m |
| 16 | 403N0031 | EV上がる(-3→-2)×3 / EV上がる(-2→0)×3 | 403L0006 elevator -3→-3 1.4m<br>403L0038 elevator -3→-2 0.2m<br>403L0055 elevator -2→-2 1.3m<br>403L0077 elevator -2→-2 0.9m<br>403L0078 elevator -2→0 0.3m<br>403L0111 elevator 0→0 0.8m |
| 17 | 403N0045 | EV上がる(-3→-2)×3 / EV上がる(-2→0)×3 | 403L0006 elevator -3→-3 1.4m<br>403L0038 elevator -3→-2 0.2m<br>403L0055 elevator -2→-2 1.3m<br>403L0077 elevator -2→-2 0.9m<br>403L0078 elevator -2→0 0.3m<br>403L0111 elevator 0→0 0.8m |
| 18 | 403N0046 | EV上がる(-3→-2)×3 / EV上がる(-2→0)×3 | 403L0006 elevator -3→-3 1.4m<br>403L0038 elevator -3→-2 0.2m<br>403L0055 elevator -2→-2 1.3m<br>403L0077 elevator -2→-2 0.9m<br>403L0078 elevator -2→0 0.3m<br>403L0111 elevator 0→0 0.8m |
| 19 | 403N0082 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / EV上がる(-2→0)×3 | 403L0040 stairs -3→-2.5 5.3m<br>403L0042 stairs -2.5→-2 1.6m<br>403L0077 elevator -2→-2 0.9m<br>403L0078 elevator -2→0 0.3m<br>403L0111 elevator 0→0 0.8m |
| 20 | 403N0084 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / EV上がる(-2→0)×3 | 403L0040 stairs -3→-2.5 5.3m<br>403L0042 stairs -2.5→-2 1.6m<br>403L0077 elevator -2→-2 0.9m<br>403L0078 elevator -2→0 0.3m<br>403L0111 elevator 0→0 0.8m |
| 21 | 403N0090 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / EV上がる(-2→0)×3 | 403L0040 stairs -3→-2.5 5.3m<br>403L0042 stairs -2.5→-2 1.6m<br>403L0077 elevator -2→-2 0.9m<br>403L0078 elevator -2→0 0.3m<br>403L0111 elevator 0→0 0.8m |
| 22 | 403N0091 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 / EV上がる(-2→0)×3 | 403L0040 stairs -3→-2.5 5.3m<br>403L0042 stairs -2.5→-2 1.6m<br>403L0077 elevator -2→-2 0.9m<br>403L0078 elevator -2→0 0.3m<br>403L0111 elevator 0→0 0.8m |

- 判定根拠: candidate間で設備種別、方向、level遷移、または回数が一致しない。

### 復元候補の注意

Facility IDが同じでもcandidate間の進入位置が異なる場合があるため、単一candidateの設備を代表値として採用しない。

## 新宿西口 / 思い出横丁

- arrival platform: 402P1 (番号不明)
- platform floor: candidate origin levels=-4
- fare gate floor: -3
- candidate数: 6
- common suffix: 13 edges
- classification: **B. CHOICE REQUIRED**
- semantic consensus: なし
- expected restored action: 単一案内を復元しない
- gate floor display: level値としては可能。ただし公式Floor名称との一致確認が必要

| candidate | boarding area | prefix vertical actions | pathway detail |
|---:|---|---|---|
| 1 | 402N0151 | 階段上がる(-4→-3.5)×1 / 階段上がる(-3.5→-3)×1 / ES上がる(-3→-1)×1 | 402L0196 stairs -4→-3.5 3.8m<br>402L0204 stairs -3.5→-3 3.7m<br>402L0117 escalator -3→-1 19.7m |
| 2 | 402N0154 | ES上がる(-4→-3)×1 / 階段移動する(-3→-3)×1 / 階段上がる(-3→-2)×1 / 階段移動する(-2→-2)×1 / 階段移動する(-2→-2)×1 / 階段上がる(-2→-1)×1 | 402L0201 escalator -4→-3 11.3m<br>402L0147 stairs -3→-3 2.0m<br>402L0128 stairs -3→-2 4.6m<br>402L0250 stairs -2→-2 3.9m<br>402L0119 stairs -2→-2 5.0m<br>402L0124 stairs -2→-1 4.7m |
| 3 | 402N0200 | 階段上がる(-4→-3.5)×1 / 階段上がる(-3.5→-3)×1 / ES上がる(-3→-1)×1 | 402L0196 stairs -4→-3.5 3.8m<br>402L0204 stairs -3.5→-3 3.7m<br>402L0117 escalator -3→-1 19.7m |
| 4 | 402N0203 | EV上がる(-4→-3)×3 / 階段移動する(-3→-3)×1 / 階段上がる(-3→-2)×1 / 階段移動する(-2→-2)×1 / 階段移動する(-2→-2)×1 / 階段上がる(-2→-1)×1 | 402L0236 elevator -4→-4 1.0m<br>402L0202 elevator -4→-3 0.1m<br>402L0187 elevator -3→-3 1.0m<br>402L0147 stairs -3→-3 2.0m<br>402L0128 stairs -3→-2 4.6m<br>402L0250 stairs -2→-2 3.9m<br>402L0119 stairs -2→-2 5.0m<br>402L0124 stairs -2→-1 4.7m |
| 5 | 402N0204 | ES上がる(-4→-3)×1 / 階段移動する(-3→-3)×1 / 階段上がる(-3→-2)×1 / 階段移動する(-2→-2)×1 / 階段移動する(-2→-2)×1 / 階段上がる(-2→-1)×1 | 402L0201 escalator -4→-3 11.3m<br>402L0147 stairs -3→-3 2.0m<br>402L0128 stairs -3→-2 4.6m<br>402L0250 stairs -2→-2 3.9m<br>402L0119 stairs -2→-2 5.0m<br>402L0124 stairs -2→-1 4.7m |
| 6 | 402N0205 | EV上がる(-4→-3)×3 / 階段移動する(-3→-3)×1 / 階段上がる(-3→-2)×1 / 階段移動する(-2→-2)×1 / 階段移動する(-2→-2)×1 / 階段上がる(-2→-1)×1 | 402L0236 elevator -4→-4 1.0m<br>402L0202 elevator -4→-3 0.1m<br>402L0187 elevator -3→-3 1.0m<br>402L0147 stairs -3→-3 2.0m<br>402L0128 stairs -3→-2 4.6m<br>402L0250 stairs -2→-2 3.9m<br>402L0119 stairs -2→-2 5.0m<br>402L0124 stairs -2→-1 4.7m |

- 判定根拠: candidate間で設備種別、方向、level遷移、または回数が一致しない。

### 復元候補の注意

Facility IDが同じでもcandidate間の進入位置が異なる場合があるため、単一candidateの設備を代表値として採用しない。

## 上野御徒町 / アメ横

- arrival platform: 410P1 (番号不明)
- platform floor: candidate origin levels=-2
- fare gate floor: -1
- candidate数: 11
- common suffix: 17 edges
- classification: **A. SEMANTIC CONSENSUS**
- semantic consensus: あり
- expected restored action: 階段を上がる / 階段を上がる
- gate floor display: level値としては可能。ただし公式Floor名称との一致確認が必要

| candidate | boarding area | prefix vertical actions | pathway detail |
|---:|---|---|---|
| 1 | 410N0046 | 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 410L0048 stairs -2→-1.5 3.8m<br>410L0050 stairs -1.5→-1 3.5m |
| 2 | 410N0047 | 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 410L0048 stairs -2→-1.5 3.8m<br>410L0050 stairs -1.5→-1 3.5m |
| 3 | 410N0054 | 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 410L0048 stairs -2→-1.5 3.8m<br>410L0050 stairs -1.5→-1 3.5m |
| 4 | 410N0055 | 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 410L0048 stairs -2→-1.5 3.8m<br>410L0050 stairs -1.5→-1 3.5m |
| 5 | 410N0071 | 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 410L0048 stairs -2→-1.5 3.8m<br>410L0050 stairs -1.5→-1 3.5m |
| 6 | 410N0098 | 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 410L0043 stairs -2→-1.5 3.8m<br>410L0045 stairs -1.5→-1 3.6m |
| 7 | 410N0114 | 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 410L0043 stairs -2→-1.5 3.8m<br>410L0045 stairs -1.5→-1 3.6m |
| 8 | 410N0131 | 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 410L0043 stairs -2→-1.5 3.8m<br>410L0045 stairs -1.5→-1 3.6m |
| 9 | 410N0132 | 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 410L0043 stairs -2→-1.5 3.8m<br>410L0045 stairs -1.5→-1 3.6m |
| 10 | 410N0214 | 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 410L0048 stairs -2→-1.5 3.8m<br>410L0050 stairs -1.5→-1 3.5m |
| 11 | 410N0215 | 階段上がる(-2→-1.5)×1 / 階段上がる(-1.5→-1)×1 | 410L0048 stairs -2→-1.5 3.8m<br>410L0050 stairs -1.5→-1 3.5m |

- 判定根拠: 全candidateで設備種別・方向・level遷移・連続利用回数が一致。

### 復元候補の注意

Facility IDが同じでもcandidate間の進入位置が異なる場合があるため、単一candidateの設備を代表値として採用しない。

## 都庁前 / 東京都庁展望室

- arrival platform: 429P4 (番号不明)
- platform floor: candidate origin levels=-3
- fare gate floor: -2
- candidate数: 13
- common suffix: 24 edges
- classification: **B. CHOICE REQUIRED**
- semantic consensus: なし
- expected restored action: 単一案内を復元しない
- gate floor display: level値としては可能。ただし公式Floor名称との一致確認が必要

| candidate | boarding area | prefix vertical actions | pathway detail |
|---:|---|---|---|
| 1 | 429N0016 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 | 429L0102 stairs -3→-2.5 3.6m<br>429L0104 stairs -2.5→-2 3.6m |
| 2 | 429N0017 | EV上がる(-3→-2)×3 | 429L0071 elevator -3→-3 1.4m<br>429L0096 elevator -3→-2 0.2m<br>429L0127 elevator -2→-2 1.4m |
| 3 | 429N0031 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 | 429L0102 stairs -3→-2.5 3.6m<br>429L0104 stairs -2.5→-2 3.6m |
| 4 | 429N0033 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 | 429L0102 stairs -3→-2.5 3.6m<br>429L0104 stairs -2.5→-2 3.6m |
| 5 | 429N0075 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 | 429L0102 stairs -3→-2.5 3.6m<br>429L0104 stairs -2.5→-2 3.6m |
| 6 | 429N0138 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 | 429L0105 stairs -3→-2.5 3.5m<br>429L0107 stairs -2.5→-2 3.2m |
| 7 | 429N0158 | 階段上がる(-3→-2.5)×1 / 階段上がる(-2.5→-2)×1 | 429L0105 stairs -3→-2.5 3.5m<br>429L0107 stairs -2.5→-2 3.2m |
| 8 | 429N0183 | EV上がる(-3→-2)×3 | 429L0071 elevator -3→-3 1.4m<br>429L0096 elevator -3→-2 0.2m<br>429L0127 elevator -2→-2 1.4m |
| 9 | 429N0189 | EV上がる(-3→-2)×3 | 429L0071 elevator -3→-3 1.4m<br>429L0096 elevator -3→-2 0.2m<br>429L0127 elevator -2→-2 1.4m |
| 10 | 429N0212 | EV上がる(-3→-2)×3 | 429L0071 elevator -3→-3 1.4m<br>429L0096 elevator -3→-2 0.2m<br>429L0127 elevator -2→-2 1.4m |
| 11 | 429N0213 | EV上がる(-3→-2)×3 | 429L0071 elevator -3→-3 1.4m<br>429L0096 elevator -3→-2 0.2m<br>429L0127 elevator -2→-2 1.4m |
| 12 | 429N0235 | EV上がる(-3→-2)×3 | 429L0071 elevator -3→-3 1.4m<br>429L0096 elevator -3→-2 0.2m<br>429L0127 elevator -2→-2 1.4m |
| 13 | 429N0262 | EV上がる(-3→-2)×3 | 429L0071 elevator -3→-3 1.4m<br>429L0096 elevator -3→-2 0.2m<br>429L0127 elevator -2→-2 1.4m |

- 判定根拠: candidate間で設備種別、方向、level遷移、または回数が一致しない。

### 復元候補の注意

Facility IDが同じでもcandidate間の進入位置が異なる場合があるため、単一candidateの設備を代表値として採用しない。

## 集計

- SEMANTIC CONSENSUS: 1
- CHOICE REQUIRED: 7
- UNCERTAIN / TOPOLOGY ISSUE: 0

## 結論

- candidate間で意味が一致する場合は、commonRouteSuffixの前段からsemantic actionを復元するgeneric設計が可能。
- CHOICE REQUIREDでは「EV/ESのどちらか」など単一設備を断定しない。
- UNCERTAINでは垂直移動を補完しない。
- 改札階はcandidateで一意なlevel値が取れる場合のみ内部値として扱えるが、「地下○階」表示にはFloor GeoJSONまたは公式図との照合が別途必要。
- 本番StationGuide生成ロジックは今回変更していない。
