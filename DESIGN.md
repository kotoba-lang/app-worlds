# worlds.etzhayyim.com 設計 (etzhayyim-project-worlds)

## 目的 / 非目的

目的:
- CodePen のように「ブラウザで 3D シーンをコーディング」して即プレビューできる
- A-Frame ベースで WebXR/VR に対応した “World” を作成・共有・fork できる
- glTF (`.gltf`/`.glb`) をアップロードしてシーンで参照できる
- LLM がコード変更を提案し、差分として適用できる

非目的 (MVPではやらない):
- マルチユーザー同時編集 (CRDT)
- サーバー側でユーザー JS を実行する (危険・コスト高)
- Unreal/Unity 等のネイティブ相当の制作機能

## サイト構成 (2オリジン設計)

重要: **Editor と Preview をオリジン分離**して、ユーザーコードの権限を極小化する。

- `https://worlds.etzhayyim.com` (Editor)
  - 認証・保存・fork・LLM支援・アセット管理
  - セッションクッキーやトークンが存在しうる
- `https://cdn.worlds.etzhayyim.com` (Preview)
  - World を “公開HTML” としてホストするだけ (CDN配信)
  - 原則クッキーなし・最小ヘッダ・CSP強め
  - VR/WebXR の制約上、`iframe sandbox` だけで完結させず **別オリジンで安全に実行**
  - MVP: `https://cdn.worlds.etzhayyim.com/shell` を「受信した files を描画する preview shell」として提供し、Editor から `postMessage` でホットリロードする

## 主要UX (CodePen風)

画面レイアウト:
- 左: ファイル/アセットツリー
- 中: コード (3ペイン or タブ)
  - `scene.html` (A-Frame マークアップ)
  - `scene.js` (A-Frame component 登録や挙動)
  - `scene.css` (UI/レティクル等のスタイル)
  - 右: Preview (cdn.worlds.etzhayyim.com の iframe) + VR ボタン + Console
- 下: LLMチャット (「提案」→「差分」→「適用/破棄」)

操作:
- Auto-run (保存せずにプレビュー更新) と Save/Publish を分離
- Publish すると “固定バージョンURL” が発行され共有可能
- Fork は「最新Publish or 指定バージョン」を複製し自分のWorldとして保存

## ルーティング案

Editor (worlds.etzhayyim.com):
- `/` Explore (人気/新着/おすすめ)
- `/new` テンプレート選択 (A-Frame 기본 / VR / glTF / physics等)
- `/w/:slug` Worldの詳細 (説明・fork・versions)
- `/w/:slug/edit` Editor
- `/w/:slug/v/:version` バージョン詳細 (diff/preview/フォーク元表示)
- `/u/:handle` ユーザープロフィール (公開World一覧)

Preview (cdn.worlds.etzhayyim.com):
- `/:slug` 最新の公開版を表示
- `/:slug/v/:version` 特定バージョンを表示
- Private preview: `/:slug/v/:version?t=<signed_token>`

## エンティティ (DBモデルの叩き台)

`World`
- `id` (uuid)
- `slug` (unique)
- `title`
- `description`
- `owner_id` (Clerk user id)
- `visibility` (`private` | `unlisted` | `public`)
- `forked_from_world_id` (nullable)
- `forked_from_version_id` (nullable)
- `created_at`, `updated_at`
- `stats` (views/likes/forks)

`WorldVersion`
- `id` (uuid)
- `world_id`
- `parent_version_id` (nullable) 変更履歴ツリー
- `label` (e.g. `v12`, `demo`, `jam-2026-02`)
- `files` (at least: `scene.html`, `scene.js`, `scene.css`)
- `created_at`
- `published_at` (nullable)

`Asset`
- `id` (uuid)
- `world_id`
- `uploader_id`
- `path` (e.g. `models/robot.glb`)
- `mime`
- `bytes`
- `sha256`
- `storage_key` (object storage key)
- `created_at`

補助:
- `WorldLike`, `WorldViewEvent` (集計は後段で)
- `LLMAssistSession` (チャット履歴、適用したdiff)

## 実装方針 (プレビュー生成)

Editor は `WorldVersion.files` を編集するだけ。Preview はそれを “静的HTML” として配信する。

プレビューHTML生成の最小仕様:
- `scene.html` は `<!doctype html>...<a-scene>...</a-scene>...` を許容
- `scene.css` は `<style>` へ埋め込み
- `scene.js` は `<script type="module">` へ埋め込み
- 外部依存は “許可リスト式” で URL 追加 (例: A-Frame 本体、任意の component lib)

注意:
- WebXR/VR は “安全な実行環境” が最優先。Preview は Editor から `postMessage` で “reload” と “console relay” を受けるだけにする。

## glTF 対応

アップロード:
- `.glb` / `.gltf` + 依存テクスチャをアップロード可能
- 取り回しのため “フォルダ単位アップロード” をサポート (ブラウザのディレクトリ選択)

配信:
- MIME: `.glb -> model/gltf-binary`, `.gltf -> model/gltf+json`
- CORS: `w.worlds.etzhayyim.com` から取得できること
- 最適化(将来): `gltf-transform` で Draco/Meshopt/texture resize 等

Editor補助:
- Asset browser で “URLをコピー” / “A-Frame snippet を挿入”
  - 例: `<a-asset-item id="robot" src=".../models/robot.glb"></a-asset-item>`
  - 例: `<a-entity gltf-model="#robot"></a-entity>`

## VR/WebXR 対応

MVPのゴール:
- `a-scene` の `vr-mode-ui` を有効化し “Enter VR” で WebXR セッションを開始できる
- Quest等のHMDで `w.worlds.etzhayyim.com` のプレビューURLを直に開ける

運用上の要点:
- HTTPS 必須
- `Permissions-Policy` に `xr-spatial-tracking` を含める
- `allow` 属性 (iframeの場合) と、トップレベルでの動作を両方確認する

## Fork 設計

要件:
- 既存Worldを “コピーして自分のWorldとして編集” できる
- フォーク元の参照を保持し、クレジット/派生ツリーを辿れる

動作:
- Fork: `World` を新規作成し、対象 `WorldVersion` の files/asset references を複製
- `forked_from_world_id` と `forked_from_version_id` を設定
- 表示: Worldページで “Forked from …” と派生一覧を提供

## LLM でコーディング (提案→差分→適用)

UI要件:
- LLM は “直接保存” せず、必ず差分を表示してユーザーが適用する
- 対象ファイルは明示 (`scene.html` / `scene.js` / `scene.css`)
- エラー(コンソール)を入力として渡して修正提案できる

最低限の LLM tools (概念):
- `get_world(version)` 現在の files とアセット一覧
- `propose_patch(files, instructions)` unified diff を生成
- `apply_patch(diff)` 適用して新しい draft を作成
- `validate()` HTML構文/軽いA-Frame静的チェック (完全な実行検証はブラウザ側)

安全策:
- LLMに “外部スクリプト追加” を許す場合は許可リスト/警告を出す
- プレビュー実行は別オリジンで隔離

## API (最小)

`worlds-api` の責務:
- CRUD: World / Version
- Publish: version を固定化して Preview で配信可能にする
- Asset upload: 署名URL発行 (PUT) とメタ登録
- Private preview token: 短命署名トークン発行

エンドポイント例 (形は実装に合わせて調整):
- `POST /api/worlds` / `GET /api/worlds/:id`
- `POST /api/worlds/:id/versions` / `POST /api/versions/:id/publish`
- `POST /api/worlds/:id/fork`
- `POST /api/assets:sign-upload` / `POST /api/assets:register`
- `POST /api/preview:token`

## デプロイ/運用

静的配信:
- `worlds-ui` と `cdn.worlds.etzhayyim.com` は nginx/Cloud CDN で静的配信が基本

データ:
- Postgres (World/Version/Asset metadata)
- Object storage (assets, version artifacts)

ヘッダ (Preview優先):
- `Content-Security-Policy`: `default-src 'self'` をベースに、A-Frame CDNや assets host を許可
- `Permissions-Policy`: `xr-spatial-tracking=(self)`
- `Cross-Origin-*` は必要最小限 (将来的に COOP/COEP を検討)

## MVP スコープ (出荷単位)

1. World 作成: テンプレから `scene.html/js/css` を生成
2. Editor: 3ファイル編集 + 即プレビュー更新
3. Asset: `.glb` アップロード + snippet 挿入
4. Publish: 固定URLで表示
5. Fork: 公開Worldを複製
6. LLM: 変更提案→diff→適用 (最低限)

## 実装メモ (MVPのローカル開発)

- Clerk publishable key は `PUBLIC_CLERK_PUBLISHABLE_KEY` を想定
- ローカルでは preview shell を同一アプリ内の `/preview-shell` で代替し、`cdn.worlds.etzhayyim.com/shell` 相当の挙動を確認できる
