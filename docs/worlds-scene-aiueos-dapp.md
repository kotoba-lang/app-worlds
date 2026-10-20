# app-worlds（3D シーン）— itonami（dapp）上の分散型設計

状態: 第 1 スライス実装（2026-10-20）。正本はこの文書。
追跡: Linear JUN-128（親 JUN-116）。

## 位置づけ

app-worlds は 3D 世界 —— シーン（scene）・アセット（asset）・ポータル
（portal）。シーンは draft から生まれ、published / archived に進む。

## このスライス: シーン・アセット判定コア

| 層 | 実体 | 状態 |
|---|---|---|
| 判定コア guest | `aiueos/worlds_scene.cljk` — scene-status-ok（**draft / published / archived の閉じた 3**、新規は draft から）/ asset-type-ok（**model / texture / audio / material / script / other の 6**）/ status-update-judgment（invalidStatus / sceneNotFound）/ asset-admission（必須 + type 検証） | **実装済み・実測** |
| 記述子 | `aiueos/worlds-scene.edn` | **実装済み** |
| parity | `kotoba/test/worlds/scene_parity_test.cljk` — 正本（registry.ts / types.ts）の閉じた集合・既定 status・拒否名と一致 | **実装済み・実測** |

実測: `amu test aiueos/worlds_scene.cljk` → **15/15**（jvm-kir / js / wasm）。
parity → 2 tests / 15 assertions / 0 failures。

## 正本の正確な規則（guest はこれに追従）

- **SceneStatus** = draft / published / archived。**createScene は draft 既定**
  （status: "draft"）。sceneId は冪等（alreadyExists）。
- **AssetType** = model / texture / audio / material / script / other。
  addAsset は assetId + sceneId + name 必須 + type 検証。
- status 更新は sceneId + status の検証（invalidStatus）→ シーンの存在
  （sceneNotFound）の順で拒否。

## 未実装境界

- ポータル（portal）の判定（シーン間リンク）。
- アセットの content-addressed 格納と表示。
- mon（DNA）化、aiueos session 載せ（fleet 共通）。
