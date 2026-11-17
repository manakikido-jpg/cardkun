import { and, eq, inArray, sql } from "drizzle-orm";
import { queryRows, type Db } from "../db/client.js";
import { priceDaily, priceSummaries } from "../db/schema.js";

/**
 * 集計のルール（SPEC.md「相場の集計ルール」と合わせること）
 * - 集計に使うのは 状態A・鑑定なし の観測だけ（PSA10 などが混ざると相場がゆがむため）
 * - shop_sell / shop_buy / market_listing / overseas：直近7日以内の「取得元ごとの最新の観測」
 * - market_sold：直近30日のすべての成約
 * - change7d：今の中央値と、7日前（日本時間）の日次中央値との比較
 * - 日付はすべて日本時間（Asia/Tokyo）で区切る
 */

export const TZ = "Asia/Tokyo";

/** Date → 日本時間の YYYY-MM-DD */
export function jstDate(d: Date): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const QUALIFYING = sql`condition = 'A' AND grading_company IS NULL`;

/** 指定カード・日付の日次集計を作り直す */
export async function recomputeDaily(db: Db, cardIds: string[], dates: string[]): Promise<void> {
  if (cardIds.length === 0 || dates.length === 0) return;
  await db.transaction(async (tx) => {
    await tx
      .delete(priceDaily)
      .where(and(inArray(priceDaily.cardId, cardIds), inArray(priceDaily.date, dates)));
    await tx.execute(sql`
      INSERT INTO price_daily (card_id, price_type, date, min, median, max, count)
      SELECT
        card_id,
        price_type,
        (observed_at AT TIME ZONE ${TZ})::date AS d,
        min(price_jpy),
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price_jpy))::int,
        max(price_jpy),
        count(*)::int
      FROM price_observations
      WHERE ${QUALIFYING}
        AND card_id IN (${sql.join(cardIds.map((id) => sql`${id}`), sql`, `)})
        AND (observed_at AT TIME ZONE ${TZ})::date IN (${sql.join(
          dates.map((d) => sql`${d}::date`),
          sql`, `,
        )})
      GROUP BY card_id, price_type, d
    `);
  });
}

interface SummaryRow {
  card_id: string;
  price_type: string;
  min: number;
  median: number;
  max: number;
  count: number;
  latest_at: Date | string;
}

/** 指定カードの集計（price_summaries）を作り直す */
export async function recomputeSummaries(db: Db, cardIds: string[], now: Date): Promise<void> {
  if (cardIds.length === 0) return;
  const ids = sql.join(cardIds.map((id) => sql`${id}`), sql`, `);
  const nowTs = now.toISOString();

  const rows = await queryRows<SummaryRow>(
    db,
    sql`
      WITH base AS (
        SELECT card_id, source_id, price_type, price_jpy, observed_at
        FROM price_observations
        WHERE ${QUALIFYING}
          AND card_id IN (${ids})
          AND observed_at <= ${nowTs}::timestamptz
          AND observed_at > ${nowTs}::timestamptz - interval '30 days'
      ),
      latest_per_source AS (
        SELECT DISTINCT ON (card_id, source_id, price_type)
          card_id, source_id, price_type, price_jpy, observed_at
        FROM base
        WHERE price_type <> 'market_sold'
          AND observed_at > ${nowTs}::timestamptz - interval '7 days'
        ORDER BY card_id, source_id, price_type, observed_at DESC
      ),
      pool AS (
        SELECT * FROM latest_per_source
        UNION ALL
        SELECT * FROM base WHERE price_type = 'market_sold'
      )
      SELECT
        card_id,
        price_type,
        min(price_jpy)::int AS min,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price_jpy))::int AS median,
        max(price_jpy)::int AS max,
        count(*)::int AS count,
        max(observed_at) AS latest_at
      FROM pool
      GROUP BY card_id, price_type
    `,
  );

  // 7日前の日次中央値（変化率の計算用）
  const weekAgo = addDays(jstDate(now), -7);
  const prev = await db
    .select({ cardId: priceDaily.cardId, priceType: priceDaily.priceType, median: priceDaily.median })
    .from(priceDaily)
    .where(and(inArray(priceDaily.cardId, cardIds), eq(priceDaily.date, weekAgo)));
  const prevMap = new Map(prev.map((p) => [`${p.cardId}|${p.priceType}`, p.median]));

  const values = rows.map((r) => {
    const before = prevMap.get(`${r.card_id}|${r.price_type}`);
    return {
      cardId: r.card_id,
      priceType: r.price_type,
      min: r.min,
      median: r.median,
      max: r.max,
      count: r.count,
      change7d: before ? Math.round(((r.median - before) / before) * 10000) / 10000 : null,
      latestAt: new Date(r.latest_at),
    };
  });

  await db.transaction(async (tx) => {
    await tx.delete(priceSummaries).where(inArray(priceSummaries.cardId, cardIds));
    if (values.length > 0) await tx.insert(priceSummaries).values(values);
  });
}
