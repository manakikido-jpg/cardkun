# cardkun

ポケモンカードの相場を横断検索し、カード販売に役立てる Web アプリ。

- 仕様：[SPEC.md](./SPEC.md)
- 開発体制：Claude Code（`server/`）と Codex（`web/`）が並行開発
  - Claude 向けルール：[CLAUDE.md](./CLAUDE.md)
  - Codex 向けルール：[AGENTS.md](./AGENTS.md)

## セットアップ

```bash
pnpm install
pnpm typecheck
pnpm test
```

API サーバー（開発用）：

```bash
pnpm --filter @cardkun/server seed   # 初回だけ：架空の相場データを入れる
pnpm --filter @cardkun/server dev
```

`http://localhost:8787/api/cards?q=リザードン` で確認できます。DB は PGlite（インストール不要）を使い、`server/.data/` に保存されます。本番では `DATABASE_URL` に PostgreSQL を指定します。
