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

API サーバー（開発用、現在は仮データを返す）：

```bash
pnpm --filter @cardkun/server dev
```

`http://localhost:8787/api/health` で確認できます。
