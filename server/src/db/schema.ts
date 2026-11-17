import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * DB スキーマ。変更したら `pnpm --filter @cardkun/server db:generate` でマイグレーションを作る。
 * API の形は shared/src/api.ts が正。ここは保存のための形。
 */

/** カード。id は「弾コード-番号（3桁ゼロ埋め）」（例: sv2a-201） */
export const cards = pgTable(
  "cards",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    setCode: text("set_code").notNull(),
    setName: text("set_name").notNull(),
    number: text("number").notNull(),
    rarity: text("rarity").notNull(),
    imageUrl: text("image_url"),
    releaseDate: date("release_date", { mode: "string" }),
    /** 検索用に正規化した文字列（lib/normalize.ts の buildSearchText） */
    searchText: text("search_text").notNull(),
  },
  (t) => [
    // 部分一致・あいまい検索を高速化する（pg_trgm）
    index("cards_search_trgm_idx").using("gin", t.searchText.op("gin_trgm_ops")),
    index("cards_set_code_idx").on(t.setCode),
    index("cards_rarity_idx").on(t.rarity),
  ],
);

/** 価格の取得元 */
export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // shop | marketplace | overseas
  region: text("region").notNull(),
  currency: text("currency").notNull(),
  url: text("url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

/** 価格の観測（収集した生データ）。金額は整数、price_jpy は円換算額 */
export const priceObservations = pgTable(
  "price_observations",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    priceType: text("price_type").notNull(),
    price: integer("price").notNull(),
    currency: text("currency").notNull(),
    priceJpy: integer("price_jpy").notNull(),
    condition: text("condition").notNull(),
    gradingCompany: text("grading_company"),
    gradingGrade: real("grading_grade"),
    url: text("url"),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" }).notNull(),
    /** 取得元での一意な ID（同じ観測を二重に保存しないため）。任意 */
    externalId: text("external_id"),
  },
  (t) => [
    uniqueIndex("price_obs_source_external_uq")
      .on(t.sourceId, t.externalId)
      .where(sql`${t.externalId} IS NOT NULL`),
    index("price_obs_card_type_time_idx").on(t.cardId, t.priceType, t.observedAt.desc()),
    index("price_obs_source_time_idx").on(t.sourceId, t.observedAt.desc()),
  ],
);

/** カード × priceType の集計（事前計算）。金額は円 */
export const priceSummaries = pgTable(
  "price_summaries",
  {
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    priceType: text("price_type").notNull(),
    min: integer("min").notNull(),
    median: integer("median").notNull(),
    max: integer("max").notNull(),
    count: integer("count").notNull(),
    change7d: real("change_7d"),
    latestAt: timestamp("latest_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.priceType] })],
);

/** 日ごとの集計（価格推移グラフ用）。date は日本時間の日付 */
export const priceDaily = pgTable(
  "price_daily",
  {
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    priceType: text("price_type").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    min: integer("min").notNull(),
    median: integer("median").notNull(),
    max: integer("max").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.priceType, t.date] })],
);

/** 為替レート（1 単位あたりの円） */
export const fxRates = pgTable(
  "fx_rates",
  {
    currency: text("currency").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    rateJpy: real("rate_jpy").notNull(),
  },
  (t) => [primaryKey({ columns: [t.currency, t.date] })],
);
