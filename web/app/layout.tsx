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
        <a className="skip-link" href="#main-content">
          本文へ移動
        </a>
        <header className="header">
          <Link className="logo" href="/">
            <span className="brand-mark" aria-hidden="true">
              ▱
            </span>
            <span className="brand-name">
              cardkun<small>ポケモンカード相場</small>
            </span>
          </Link>
          <Link className="header-search" href="/">
            相場検索 <span aria-hidden="true">↗</span>
          </Link>
        </header>
        <div className="brand-strip">
          販売・買取・フリマの価格を、まとめて比較
        </div>
        <main id="main-content">
          {!process.env.API_BASE_URL && (
            <p className="demo">
              デモモード · 表示される価格はすべて架空の参考データです
            </p>
          )}
          {children}
        </main>
        <nav className="bottom-nav" aria-label="メインメニュー">
          <Link href="/">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="m3 10 9-7 9 7v10H4V10M9 21v-8h6v8" />
            </svg>
            ホーム
          </Link>
          <Link href="/#search">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="6" />
              <path d="m15 15 6 6" />
            </svg>
            カード検索
          </Link>
          <Link href="/#guide">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <path d="M8 8h8M8 12h8M8 16h5" />
            </svg>
            使い方
          </Link>
        </nav>
        <footer>
          cardkun / ポケモンカード相場
          <br />
          価格は参考情報です。状態・更新日時もあわせてご確認ください。
        </footer>
      </body>
    </html>
  );
}
