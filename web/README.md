# @cardkun/web

カード検索・相場詳細・出品サポートの Next.js App Router アプリです。Node.js 22 以上と、ルートで指定された pnpm 10.28.0 を使用します。

```sh
# リポジトリのルートで実行
corepack pnpm install
corepack pnpm typecheck
corepack pnpm test
corepack pnpm --filter @cardkun/web dev
```

- `/`：名前（日本語・英語）、弾コード、レアリティの検索。販売最安・買取最高・フリマ成約中央値・海外中央値と7日間の変化率。
- `/cards/sv2a-201`：全 priceType の集計、取得元別最新価格、30日・90日・1年の中央値グラフ。
- `/cards/sv2a-201/sell`：状態 A〜D による提案価格・価格の幅・説明文とコピー。

`API_BASE_URL` を設定しなければ shared の架空データを使います。実 API を使うには `web/.env.local` に以下を設定して開発サーバーを再起動してください。ブラウザに公開する環境変数ではありません。

```dotenv
API_BASE_URL=http://localhost:8787
```

値は `/api` を含めない API サーバーのオリジンです。画面は `web/lib/api.ts` 経由でのみ取得し、shared の Zod スキーマで検証します。API が失敗したとき mock へ自動で戻すことはありません。

## キャッシュと描画

サーバーコンポーネントを基本にし、グラフの期間切替・状態選択・コピーのみクライアントコンポーネントにしています。検索は GET フォームです。カード詳細は初回アクセス時に生成され、300秒で ISR 更新します。グラフの3期間はサーバーで取得し、切替時の追加通信をなくしています。出品サポートの POST はキャッシュしません。

shared は `.js` 拡張子の ESM import を使いながら TypeScript ソースを公開するため、web 側の Webpack `extensionAlias` で解決します。dev/build は `--webpack` を指定しています。shared の変更は不要です。

画像 URL が null のときは代替表示です。画像が登録された場合は `next/image` で表示します。配信ホストが未確定のため現状は `unoptimized` です。画像配信先の確定後に `remotePatterns` を限定して最適化を有効にする想定です。

## 仮データの制約

shared に出品提案の mock 関数がないため、web の API 層が mock のフリマ成約中央値 × 状態係数（A:1、B:0.85、C:0.65、D:0.4）を計算します。説明文・係数はデモ用で、実査定や価格保証ではありません。実 API 設定後は `POST /api/listing-assist` の結果をそのまま検証して表示します。

mock の名前検索は表記正規化と部分一致です。誤字を含むあいまい検索は実 API 側の責務です。弾コード・レアリティは完全一致です。

```sh
corepack pnpm --filter @cardkun/web build
corepack pnpm --filter @cardkun/web start
```

API 層の既存契約、mock、期間・状態変更、エラーレスポンス、Zod 検証と POST の動作を `lib/api.test.ts` で検証します。
