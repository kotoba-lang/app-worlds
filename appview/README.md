# etzhayyim-project-worlds App migration

このディレクトリは `legacy-runtime` 実装を残したまま、App 版を段階移行するための配置先です。

## 対象 App services

- `worlds-api-p7k3m2d9`

## App 実装方針

- 各 service は `projects/*/wasm/*-component` として順次実装。
- 既存 App runtime は互換運用のため維持。
- HTTP/cron/job エンドポイントから優先して移植。

## 実装済みコンポーネント

- `worlds-mcp-component`
  - `POST /xrpc`
  - `GET /health`, `GET /healthz`, `GET /version`
  - `GET /...` で worlds static UI を配信
  - `GET /cdn/...` で cdn static UI を配信
