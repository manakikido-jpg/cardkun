import Link from "next/link";
import { notFound } from "next/navigation";
import { getCard, getHistory, getSources } from "../../../lib/api";
import { labels, yen, dateTime } from "../../../lib/format";
import { CardImage } from "../../../components/card-image";
import { Prices, Change } from "../../../components/prices";
import { HistoryChart } from "../../../components/history-chart";
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getCard(id);
  if (!detail) notFound();
  const [histories, sources] = await Promise.all([
    Promise.all(
      (["30d", "90d", "1y"] as const).map((range) => getHistory(id, range)),
    ),
    getSources(),
  ]);
  const { card, summaries, latest } = detail;
  return (
    <>
      <Link className="back" href="/">
        ← カード検索
      </Link>
      <section className="detail-hero">
        <CardImage card={card} />
        <div>
          <span className="badge">{card.rarity}</span>
          <h1>{card.name}</h1>
          <p>
            {card.setName} · {card.number}
          </p>
          <p className="muted">
            弾コード：{card.setCode}
            {card.releaseDate && ` / 発売日：${card.releaseDate}`}
          </p>
          <Link
            className="button"
            href={`/cards/${encodeURIComponent(id)}/sell`}
          >
            このカードの出品をサポート →
          </Link>
        </div>
      </section>
      <Prices summaries={summaries} />
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>価格の推移</h2>
            <p className="caption">各日の中央値 · 日本円</p>
          </div>
        </div>
        <HistoryChart histories={histories} />
      </section>
      <section className="panel">
        <h2>価格種別ごとの集計</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>種類</th>
                <th>最安</th>
                <th>中央値</th>
                <th>最高</th>
                <th>件数</th>
                <th>7日間の変化</th>
                <th>更新日時（日本時間）</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.priceType}>
                  <th>{labels[s.priceType]}</th>
                  <td>{s.count ? yen(s.min) : "—"}</td>
                  <td>{s.count ? yen(s.median) : "—"}</td>
                  <td>{s.count ? yen(s.max) : "—"}</td>
                  <td>{s.count}</td>
                  <td>
                    <Change value={s.change7d} />
                  </td>
                  <td>{dateTime(s.latestAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!summaries.length && <p>集計データはまだありません。</p>}
      </section>
      <section className="panel">
        <h2>ソース別の最新価格</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>取得元</th>
                <th>種類</th>
                <th>価格（円換算）</th>
                <th>状態・鑑定</th>
                <th>観測日時（日本時間）</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((p, i) => (
                <tr key={`${p.sourceId}-${p.priceType}-${i}`}>
                  <th>
                    {p.sourceId === "overseas-a" && !process.env.API_BASE_URL
                      ? "海外A（仮）"
                      : (sources.items.find((s) => s.id === p.sourceId)?.name ??
                        p.sourceId)}
                  </th>
                  <td>{labels[p.priceType]}</td>
                  <td>{yen(p.priceJpy)}</td>
                  <td>
                    {p.condition === "unknown" ? "不明" : p.condition}
                    {p.grading && ` / ${p.grading.company} ${p.grading.grade}`}
                  </td>
                  <td>{dateTime(p.observedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!latest.length && <p>最新価格はまだありません。</p>}
      </section>
    </>
  );
}
