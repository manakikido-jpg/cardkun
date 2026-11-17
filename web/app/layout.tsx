import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "cardkun｜ポケカの相場をひと目で",
    template: "%s｜cardkun",
  },
  description: "ポケモンカードの相場検索と出品サポート",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="header">
          <Link className="logo" href="/">
            ▧ cardkun<span>ポケカ相場ノート</span>
          </Link>
          <Link href="/">カードを探す ↗</Link>
        </header>
        <main>
          {!process.env.API_BASE_URL && (
            <p className="demo">
              デモモード · 表示される価格はすべて架空の参考データです
            </p>
          )}
          {children}
        </main>
        <footer>
          cardkun · 相場を知って、納得の一枚を。
          <br />
          価格は参考情報です。状態・更新日時もあわせてご確認ください。
        </footer>
      </body>
    </html>
  );
}
