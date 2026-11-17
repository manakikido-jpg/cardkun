import Link from "next/link";
import { searchCards } from "../lib/api";
import { CardImage } from "../components/card-image";
import { Prices } from "../components/prices";
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const get = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;
  const q = get("q"),
    set = get("set"),
    rarity = get("rarity"),
    cursor = get("cursor");
  if ((q?.trim().length ?? 0) > 100)
    return (
      <section>
        <h1>検索語が長すぎます</h1>
        <p>カード名は100文字以内で入力してください。</p>
        <Link href="/">検索に戻る</Link>
      </section>
    );
  const data = await searchCards({ q, set, rarity, cursor });
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({
    q,
    set,
    rarity,
    cursor: data.nextCursor,
  }))
    if (value) next.set(key, value);
  return (
    <>
      <section className="hero">
        <p className="eyebrow">POKÉMON CARD PRICE GUIDE</p>
        <h1>
          あのカードの、
          <br />
          いまの相場を。
        </h1>
        <p className="muted">
          ショップ・フリマ・海外の価格を、ひとつの場所で。
        </p>
        <form action="/" className="search-form">
          <label className="search-name">
            カード名
            <input
              name="q"
              defaultValue={q}
              maxLength={100}
              placeholder="リザードン、ぴかちゅう、Charizard…"
            />
          </label>
          <div className="filters">
            <label>
              弾コード
              <input name="set" defaultValue={set} placeholder="例：sv2a" />
            </label>
            <label>
              レアリティ
              <input
                name="rarity"
                defaultValue={rarity}
                placeholder="例：SAR"
              />
            </label>
            <button type="submit">相場を検索 →</button>
          </div>
        </form>
      </section>
      <section>
        <div className="section-heading">
          <h2>{q ? `「${q}」の検索結果` : "カード一覧"}</h2>
          <span className="muted">このページ {data.items.length}件</span>
        </div>
        <p className="caption">
          フリマ・海外は中央値（円換算）。変化率は各種別の中央値の7日前比です。
        </p>
        <div className="results">
          {data.items.map((card) => (
            <article className="result" key={card.id}>
              <Link
                href={`/cards/${encodeURIComponent(card.id)}`}
                className="card-heading"
              >
                <CardImage card={card} />
                <div>
                  <span className="badge">{card.rarity}</span>
                  <h3>
                    {card.name} <span>↗</span>
                  </h3>
                  <p>{card.setName}</p>
                  <small>
                    {card.number} · {card.setCode}
                  </small>
                </div>
              </Link>
              <Prices summaries={card.summaries} />
            </article>
          ))}
        </div>
        {!data.items.length && (
          <div className="empty">
            <h3>カードが見つかりませんでした</h3>
            <p>名前の一部や英語名で検索するか、絞り込みを減らしてください。</p>
            <Link href="/">すべてのカードを見る →</Link>
          </div>
        )}
        {data.nextCursor && (
          <Link className="button" href={`/?${next}`}>
            次のページ →
          </Link>
        )}
      </section>
    </>
  );
}
