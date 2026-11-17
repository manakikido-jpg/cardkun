"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="empty" role="alert">
      <h1>データを取得できませんでした</h1>
      <p>通信状況を確認し、時間をおいてもう一度お試しください。</p>
      <button onClick={reset}>再試行する</button>{" "}
      <Link href="/">検索に戻る</Link>
    </section>
  );
}
