import Link from "next/link";
import { notFound } from "next/navigation";
import { CardCondition } from "@cardkun/shared";
import { getCard, getListingAssist } from "../../../../lib/api";
import { yen } from "../../../../lib/format";
import { ConditionSelect } from "../../../../components/condition-select";
import { CopyButton } from "../../../../components/copy-button";
export default async function Sell({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ condition?: string }>;
}) {
  const { id } = await params;
  const detail = await getCard(id);
  if (!detail) notFound();
  const parsed = CardCondition.exclude(["unknown"]).safeParse(
    (await searchParams).condition,
  );
  const condition = parsed.success ? parsed.data : "A";
  const result = await getListingAssist({ cardId: id, condition });
  return (
    <>
      <Link className="back" href={`/cards/${encodeURIComponent(id)}`}>
        ← カード詳細
      </Link>
      <section className="sell-intro">
        <p className="eyebrow">出品サポート</p>
        <h1>出品価格を決める</h1>
        <p>
          {detail.card.name} · {detail.card.number}
        </p>
      </section>
      <div className="sell-grid">
        <section className="panel">
          <h2>1. カードの状態を選択</h2>
          <form>
            <ConditionSelect condition={condition} />
            <button type="submit">この状態で提案を見る →</button>
          </form>
          <p className="caption">
            状態区分は目安です。写真と実物を確認し、傷の位置や程度を説明してください。
          </p>
        </section>
        <section className="panel recommendation">
          <h2>2. おすすめの出品価格</h2>
          <p className="big-price">{yen(result.suggestedPrice)}</p>
          <p>
            参考の幅：{yen(result.priceRange.low)} 〜{" "}
            {yen(result.priceRange.high)}
          </p>
          <p className="caption">{result.basis}</p>
        </section>
      </div>
      <section className="panel">
        <h2>3. 出品説明文のたたき台</h2>
        <p className="muted">
          内容を確認し、実際の状態・発送方法などを追記してご利用ください。
        </p>
        <pre className="description">{result.description}</pre>
        <CopyButton text={result.description} />
      </section>
    </>
  );
}
