import Link from "next/link";
export default function NotFound() {
  return (
    <section className="empty">
      <p className="eyebrow">404</p>
      <h1>カードが見つかりませんでした</h1>
      <p>URLをご確認いただくか、検索からカードを探してください。</p>
      <Link className="button" href="/">
        カードを探す →
      </Link>
    </section>
  );
}
