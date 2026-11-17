# AGENTS.md（Codex 向けルール）

このリポジトリは **Codex と Claude Code が並行して開発**しています。作業を始める前に必ず `SPEC.md` を読んでください。

## あなた（Codex）の担当

- **`web/`（画面・Next.js）**
- 担当外の `server/` は触らないでください（Claude の担当です）。

## 共通の約束事

- `shared/` は両者の共通の約束事（型・API仕様・仮データ）です。
  - 変更が必要なら最小限にし、PR の説明に「shared 変更あり」と影響範囲を書いてください。
  - 既存の型やフィールドを削除・改名しないでください（追加は可）。
- API がまだできていない間は `@cardkun/shared` の `mock` を使って画面を作ってください。
- 型は `@cardkun/shared` から import し、`web/` 内で同じ型を再定義しないでください。

## 画面の実装方針（速度重視）

- Next.js App Router を使い、サーバーコンポーネントを基本にします。
- `"use client"` はグラフ・フォームなど、操作が必要な部品だけに付けてください。
- カード詳細ページは ISR（`revalidate`）でキャッシュしてください。
- 画像は `next/image` を使ってください。
- 外部の価格サイトに画面から直接アクセスしないでください。データは必ず `server/` の API（または mock）から取ります。
- `next.config` に `transpilePackages: ["@cardkun/shared"]` を設定してください。

## Git

- ブランチは `codex/<作業内容>` にしてください。
- `main` へは PR でマージします。
- プッシュ前に `pnpm typecheck` と `pnpm test` を通してください。
