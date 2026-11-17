# web/（Codex 担当）

Next.js（App Router）で画面を作るフォルダです。ルールは `/AGENTS.md`、仕様は `/SPEC.md` を参照してください。

## 最初にやること

1. このフォルダに Next.js（TypeScript、App Router）を用意する。パッケージ名は `@cardkun/web`。
2. `dependencies` に `"@cardkun/shared": "workspace:*"` を追加する。
3. `next.config` に `transpilePackages: ["@cardkun/shared"]` を設定する。
4. `typecheck` と `test` の npm script を用意する（ルートの `pnpm typecheck` / `pnpm test` から呼ばれます）。

## 作る画面（SPEC.md の F1〜F4）

| 画面 | パス案 | 使う API |
|---|---|---|
| トップ・検索 | `/` | `GET /api/cards` |
| カード詳細 | `/cards/[id]` | `GET /api/cards/:id`、`GET /api/cards/:id/history` |
| 出品サポート | `/cards/[id]/sell` | `POST /api/listing-assist` |

API の型は `@cardkun/shared` から import できます。サーバーがない間は `mock`（例：`mock.mockSearch()`）を使ってください。

開発用サーバー：`pnpm dev:server` → `http://localhost:8787/api/...`
