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
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" aria-hidden="true" />{" "}
            あなたのカードに、相場のものさし。
          </p>
          <h1>
            あのカードの、
            <br />
            <span className="hero-accent">いまの相場を。</span>
          </h1>
          <p className="muted">
            ショップ・フリマ・海外の価格を、ひとつの場所で。
          </p>
        </div>
        <div className="search-panel">
          <div className="search-panel-heading">
            <span className="step-label">01 / カードを探す</span>
            <span className="search-hint">名前の一部でも検索できます</span>
          </div>
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
        <div className="guide-strip" aria-label="使い方">
          <span>
            <b>01</b> カードを探す
          </span>
          <span>
            <b>02</b> 相場をくらべる
          </span>
          <span>
            <b>03</b> 出品に役立てる
          </span>
        </div>
      </section>
      <section>
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
                価格推移・取得元を見る <span aria-hidden="true">↗</span>
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
    </>
  );
}
