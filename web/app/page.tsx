import Link from "next/link";
import { searchCards } from "../lib/api";
import { CardImage } from "../components/card-image";
import { yen } from "../lib/format";
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
  const featured = !q && !set && !rarity && !cursor ? data.items[0] : undefined;
  const rarityLink = (value: string) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (set) query.set("set", set);
    if (value) query.set("rarity", value);
    return `/?${query}#cards`;
  };
  return (
    <>
      {featured && (
        <section className="spotlight" aria-labelledby="spotlight-title">
          <div className="spotlight-copy">
            <p className="spotlight-kicker">ピックアップ / {featured.rarity}</p>
            <h2 id="spotlight-title">{featured.name}</h2>
            <p className="spotlight-set">{featured.setName}</p>
            <div className="spotlight-price">
              <span>ショップ販売最安</span>
              <strong>
                {featured.summaries.find(
                  (s) => s.priceType === "shop_sell" && s.count > 0,
                )
                  ? yen(
                      featured.summaries.find(
                        (s) => s.priceType === "shop_sell",
                      )!.min,
                    )
                  : "価格未登録"}
              </strong>
            </div>
            <Link href={`/cards/${encodeURIComponent(featured.id)}`}>
              相場をチェック <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="spotlight-art">
            <div className="foil-orbit" aria-hidden="true" />
            <CardImage card={featured} />
            <span className="spotlight-stamp">{featured.number}</span>
          </div>
        </section>
      )}
      <section className="hero" id="search">
        <div className="hero-copy">
          <h1>カード相場</h1>
          <p className="muted">販売・買取・成約価格を比較</p>
        </div>
        <div className="search-panel">
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
            <details className="search-filters" open={Boolean(set || rarity)}>
              <summary>
                弾・レアリティで絞り込む{(set || rarity) && "（設定中）"}
              </summary>
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
              </div>
            </details>
            <button className="search-submit" type="submit">
              相場を検索 →
            </button>
          </form>
        </div>
      </section>
      <section id="cards">
        <nav className="rarity-nav" aria-label="レアリティで絞り込む">
          {["", "SAR", "AR", "UR", "SR", "RR"].map((value) => (
            <Link
              key={value}
              href={rarityLink(value)}
              aria-current={(rarity ?? "") === value ? "page" : undefined}
            >
              {value || "すべて"}
            </Link>
          ))}
        </nav>
        <div className="section-heading">
          <h2>{q ? `「${q}」の検索結果` : "カード一覧"}</h2>
          <span className="result-count">
            このページ <b>{data.items.length}</b> 件
          </span>
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
              <Link
                className="result-action"
                href={`/cards/${encodeURIComponent(card.id)}`}
                aria-label={`${card.name}の価格推移を見る`}
              >
                詳細・価格推移 <span aria-hidden="true">↗</span>
              </Link>
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
      <section className="usage-guide" id="guide">
        <h2>cardkunの使い方</h2>
        <ol>
          <li>
            <b>探す</b>
            <span>カード名・弾・レアリティで検索。</span>
          </li>
          <li>
            <b>くらべる</b>
            <span>販売・買取・成約の相場を確認。</span>
          </li>
          <li>
            <b>出品する</b>
            <span>カード詳細から状態別の参考価格と説明文を作成。</span>
          </li>
        </ol>
      </section>
    </>
  );
}
