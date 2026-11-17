import { z } from "zod";

/**
 * cardkun の共通データ定義。
 * Claude（server/）と Codex（web/）の共通の約束事なので、
 * 既存フィールドの削除・改名はしないこと（追加は可）。
 */

// ---------- 基本の列挙型 ----------

/** 価格の種類 */
export const PriceType = z.enum([
  "shop_sell", // カードショップの販売価格
  "shop_buy", // カードショップの買取価格
  "market_sold", // フリマ・オークションの成約価格
  "market_listing", // フリマの出品中の価格
  "overseas", // 海外サイトの価格
]);
export type PriceType = z.infer<typeof PriceType>;

/** 取得元の種類 */
export const SourceKind = z.enum(["shop", "marketplace", "overseas"]);
export type SourceKind = z.infer<typeof SourceKind>;

/** 通貨（ISO 4217） */
export const Currency = z.enum(["JPY", "USD", "EUR"]);
export type Currency = z.infer<typeof Currency>;

/** カードの状態（国内ショップの一般的な表記に合わせる） */
export const CardCondition = z.enum(["A", "B", "C", "D", "unknown"]);
export type CardCondition = z.infer<typeof CardCondition>;

/** 鑑定（PSA など） */
export const Grading = z.object({
  company: z.enum(["PSA", "BGS", "CGC", "ARS"]),
  grade: z.number().min(1).max(10),
});
export type Grading = z.infer<typeof Grading>;

/** 価格推移の期間 */
export const HistoryRange = z.enum(["30d", "90d", "1y"]);
export type HistoryRange = z.infer<typeof HistoryRange>;

// ---------- エンティティ ----------

/** カード。id は「弾コード-番号」（例: sv2a-201） */
export const Card = z.object({
  id: z.string(),
  name: z.string(), // 日本語名
  nameEn: z.string().nullable(),
  setCode: z.string(), // 例: sv2a
  setName: z.string(), // 例: ポケモンカード151
  number: z.string(), // 例: 201/165
  rarity: z.string(), // 例: SAR, AR, SR, RR, R, U, C
  imageUrl: z.url().nullable(),
  releaseDate: z.iso.date().nullable(), // YYYY-MM-DD
});
export type Card = z.infer<typeof Card>;

/** 価格の取得元 */
export const PriceSource = z.object({
  id: z.string(),
  name: z.string(),
  kind: SourceKind,
  region: z.string(), // 例: JP, US
  currency: Currency,
  url: z.url(),
});
export type PriceSource = z.infer<typeof PriceSource>;

/**
 * 1 回の価格観測。
 * 金額は整数（JPY は円、USD/EUR はセント）。priceJpy は日本円換算額。
 */
export const PriceObservation = z.object({
  cardId: z.string(),
  sourceId: z.string(),
  priceType: PriceType,
  price: z.number().int().nonnegative(),
  currency: Currency,
  priceJpy: z.number().int().nonnegative(),
  condition: CardCondition,
  grading: Grading.nullable(),
  url: z.url().nullable(),
  observedAt: z.iso.datetime(),
});
export type PriceObservation = z.infer<typeof PriceObservation>;

/** カード × priceType ごとの集計（事前計算済み、金額は円） */
export const PriceSummary = z.object({
  priceType: PriceType,
  min: z.number().int().nonnegative(),
  median: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
  /** 7 日前の中央値からの変化率（0.1 = +10%）。比較できない場合は null */
  change7d: z.number().nullable(),
  latestAt: z.iso.datetime(),
});
export type PriceSummary = z.infer<typeof PriceSummary>;

/** 価格推移の 1 日分（金額は円） */
export const PriceHistoryPoint = z.object({
  date: z.iso.date(),
  priceType: PriceType,
  min: z.number().int().nonnegative(),
  median: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
});
export type PriceHistoryPoint = z.infer<typeof PriceHistoryPoint>;

/** 集計付きのカード（検索結果の 1 行） */
export const CardWithSummary = Card.extend({
  summaries: z.array(PriceSummary),
});
export type CardWithSummary = z.infer<typeof CardWithSummary>;
