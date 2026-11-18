import { and, asc, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import type {
  Card,
  CardObservationsQuery,
  CardObservationsResponse,
  CardSet,
  CardDetailResponse,
  CardHistoryResponse,
  CardSearchQuery,
  CardSearchResponse,
  HistoryRange,
  PriceObservation,
  PriceSource,
  PriceSummary,
} from "@cardkun/shared";
import { queryRows, type Db } from "../db/client.js";
import { cards, priceDaily, priceObservations, priceSummaries, sources } from "../db/schema.js";
import { jstDate } from "../aggregate/summaries.js";
import { escapeLike, normalizeForSearch } from "../lib/normalize.js";

/** DB の行 → API の形への変換と、読み取り系のクエリ */

type CardRow = typeof cards.$inferSelect;
type SummaryRow = typeof priceSummaries.$inferSelect;

const toCard = (r: CardRow): Card => ({
  id: r.id,
  name: r.name,
  nameEn: r.nameEn,
  setCode: r.setCode,
  setName: r.setName,
  number: r.number,
  rarity: r.rarity,
  imageUrl: r.imageUrl,
  releaseDate: r.releaseDate,
});

const toSummary = (r: SummaryRow): PriceSummary => ({
  priceType: r.priceType as PriceSummary["priceType"],
  min: r.min,
  median: r.median,
  max: r.max,
  count: r.count,
  change7d: r.change7d,
  latestAt: r.latestAt.toISOString(),
});

// cursor は「何件目から」を base64url にしたもの
const encodeCursor = (offset: number) => Buffer.from(String(offset)).toString("base64url");
function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const n = Number(Buffer.from(cursor, "base64url").toString());
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

async function summariesByCard(db: Db, cardIds: string[]): Promise<Map<string, PriceSummary[]>> {
  const map = new Map<string, PriceSummary[]>();
  if (cardIds.length === 0) return map;
  const rows = await db
    .select()
    .from(priceSummaries)
    .where(inArray(priceSummaries.cardId, cardIds))
    .orderBy(asc(priceSummaries.priceType));
  for (const r of rows) {
    const list = map.get(r.cardId) ?? [];
    list.push(toSummary(r));
    map.set(r.cardId, list);
  }
  return map;
}

export async function searchCards(db: Db, query: CardSearchQuery): Promise<CardSearchResponse> {
  const offset = decodeCursor(query.cursor);
  const q = query.q ? normalizeForSearch(query.q) : "";

  const where: SQL[] = [];
  if (q) where.push(sql`${cards.searchText} LIKE ${`%${escapeLike(q)}%`}`);
  if (query.set) where.push(eq(cards.setCode, query.set));
  if (query.rarity) where.push(eq(cards.rarity, query.rarity));

  // 参考価格：ショップ販売 → フリマ成約 → 海外相場 の中央値のうち、最初にあるもの
  const refPrice = sql`(
    SELECT coalesce(
      max(ps.median) FILTER (WHERE ps.price_type = 'shop_sell'),
      max(ps.median) FILTER (WHERE ps.price_type = 'market_sold'),
      max(ps.median) FILTER (WHERE ps.price_type = 'overseas')
    ) FROM price_summaries ps WHERE ps.card_id = ${cards.id}
  )`;
  const sort = query.sort ?? (q ? undefined : "new");
  const order =
    sort === "number"
      ? [asc(cards.setCode), asc(cards.id)]
      : sort === "price_desc"
        ? [sql`${refPrice} DESC NULLS LAST`, asc(cards.id)]
        : sort === "price_asc"
          ? [sql`${refPrice} ASC NULLS LAST`, asc(cards.id)]
          : sort === "new"
            ? [sql`${cards.releaseDate} DESC NULLS LAST`, asc(cards.setCode), asc(cards.id)]
            : // キーワード検索で並び順の指定がなければ、一致度の高い順
              [desc(sql`similarity(${cards.searchText}, ${q})`), asc(cards.id)];

  const rows = await db
    .select()
    .from(cards)
    .where(where.length ? and(...where) : undefined)
    .orderBy(...order)
    .limit(query.limit + 1)
    .offset(offset);

  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  const sums = await summariesByCard(db, page.map((r) => r.id));
  return {
    items: page.map((r) => ({ ...toCard(r), summaries: sums.get(r.id) ?? [] })),
    nextCursor: hasMore ? encodeCursor(offset + query.limit) : null,
  };
}

interface LatestRow {
  card_id: string;
  source_id: string;
  price_type: string;
  price: number;
  currency: string;
  price_jpy: number;
  condition: string;
  grading_company: string | null;
  grading_grade: number | null;
  url: string | null;
  observed_at: Date | string;
}

const toObservation = (r: LatestRow): PriceObservation => ({
  cardId: r.card_id,
  sourceId: r.source_id,
  priceType: r.price_type as PriceObservation["priceType"],
  price: r.price,
  currency: r.currency as PriceObservation["currency"],
  priceJpy: r.price_jpy,
  condition: r.condition as PriceObservation["condition"],
  grading:
    r.grading_company && r.grading_grade != null
      ? {
          company: r.grading_company as NonNullable<PriceObservation["grading"]>["company"],
          grade: r.grading_grade,
        }
      : null,
  url: r.url,
  observedAt: new Date(r.observed_at).toISOString(),
});

export async function getCardDetail(db: Db, cardId: string, now: Date): Promise<CardDetailResponse | null> {
  const [row] = await db.select().from(cards).where(eq(cards.id, cardId));
  if (!row) return null;

  const sums = await summariesByCard(db, [cardId]);
  // 取得元 × 種類 × 状態 × 鑑定 ごとの、直近30日で最新の観測
  const latest = await queryRows<LatestRow>(
    db,
    sql`
      SELECT * FROM (
        SELECT DISTINCT ON (source_id, price_type, condition, grading_company, grading_grade)
          card_id, source_id, price_type, price, currency, price_jpy, condition,
          grading_company, grading_grade, url, observed_at
        FROM price_observations
        WHERE card_id = ${cardId}
          AND observed_at > ${now.toISOString()}::timestamptz - interval '30 days'
        ORDER BY source_id, price_type, condition, grading_company, grading_grade, observed_at DESC
      ) t
      ORDER BY price_type, price_jpy
    `,
  );

  return {
    card: toCard(row),
    details: row.details ?? null,
    summaries: sums.get(cardId) ?? [],
    latest: latest.map(toObservation),
  };
}

const RANGE_DAYS: Record<HistoryRange, number> = { "30d": 30, "90d": 90, "1y": 365 };

export async function cardExists(db: Db, cardId: string): Promise<boolean> {
  const [row] = await db.select({ id: cards.id }).from(cards).where(eq(cards.id, cardId));
  return Boolean(row);
}

export async function getCardHistory(
  db: Db,
  cardId: string,
  range: HistoryRange,
  now: Date,
): Promise<CardHistoryResponse> {
  const from = new Date(now.getTime() - (RANGE_DAYS[range] - 1) * 86400_000);
  const rows = await db
    .select()
    .from(priceDaily)
    .where(and(eq(priceDaily.cardId, cardId), gte(priceDaily.date, jstDate(from))))
    .orderBy(asc(priceDaily.date), asc(priceDaily.priceType));
  return {
    cardId,
    range,
    points: rows.map((r) => ({
      date: r.date,
      priceType: r.priceType as CardHistoryResponse["points"][number]["priceType"],
      min: r.min,
      median: r.median,
      max: r.max,
    })),
  };
}

export async function listSources(db: Db): Promise<PriceSource[]> {
  const rows = await db.select().from(sources).where(eq(sources.enabled, true)).orderBy(asc(sources.id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind as PriceSource["kind"],
    region: r.region,
    currency: r.currency as PriceSource["currency"],
    url: r.url,
  }));
}

/** 価格の観測（生データ）を新しい順に返す */
export async function listObservations(
  db: Db,
  cardId: string,
  query: CardObservationsQuery,
): Promise<CardObservationsResponse> {
  const offset = decodeCursor(query.cursor);
  const where: SQL[] = [eq(priceObservations.cardId, cardId)];
  if (query.sourceId) where.push(eq(priceObservations.sourceId, query.sourceId));
  if (query.priceType) where.push(eq(priceObservations.priceType, query.priceType));
  const rows = await db
    .select()
    .from(priceObservations)
    .where(and(...where))
    .orderBy(desc(priceObservations.observedAt), desc(priceObservations.id))
    .limit(query.limit + 1)
    .offset(offset);
  const hasMore = rows.length > query.limit;
  return {
    cardId,
    items: rows.slice(0, query.limit).map((r) =>
      toObservation({
        card_id: r.cardId,
        source_id: r.sourceId,
        price_type: r.priceType,
        price: r.price,
        currency: r.currency,
        price_jpy: r.priceJpy,
        condition: r.condition,
        grading_company: r.gradingCompany,
        grading_grade: r.gradingGrade,
        url: r.url,
        observed_at: r.observedAt,
      }),
    ),
    nextCursor: hasMore ? encodeCursor(offset + query.limit) : null,
  };
}

/** 弾（セット）の一覧。発売日の新しい順 */
export async function listSets(db: Db): Promise<CardSet[]> {
  const rows = await db
    .select({
      setCode: cards.setCode,
      setName: sql<string>`max(${cards.setName})`,
      releaseDate: sql<string | null>`max(${cards.releaseDate})::text`,
      cardCount: sql<number>`count(*)::int`,
    })
    .from(cards)
    .groupBy(cards.setCode)
    .orderBy(sql`max(${cards.releaseDate}) DESC NULLS LAST`, asc(cards.setCode));
  return rows.map((r) => ({ ...r, cardCount: Number(r.cardCount) }));
}
