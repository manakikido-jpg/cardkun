import { z } from "zod";
import type { Card } from "@cardkun/shared";
import type { PoliteFetcher } from "../collectors/http.js";
import { makeCardId } from "../lib/normalize.js";
import { rarityToJa } from "./rarity.js";

/**
 * TCGdex（https://tcgdex.dev）の日本語カード API クライアント。
 * - データは MIT ライセンス。出典として TCGdex を表示する
 * - カード画像の権利は株式会社ポケモン等にあるため、画像は再ホストせず TCGdex の URL にリンクする
 * - レスポンスは zod で検証し、知らないフィールドは無視する（API 側の追加に強くする）
 */

export const TCGDEX_BASE = "https://api.tcgdex.net/v2/ja";

const CardCount = z.object({ official: z.number().optional(), total: z.number().optional() }).partial();

export const TcgdexSerie = z.object({
  id: z.string(),
  name: z.string(),
  sets: z.array(z.object({ id: z.string(), name: z.string(), cardCount: CardCount.optional() })),
});
export type TcgdexSerie = z.infer<typeof TcgdexSerie>;

export const TcgdexSet = z.object({
  id: z.string(),
  name: z.string(),
  releaseDate: z.string().optional(),
  serie: z.object({ id: z.string(), name: z.string() }),
  cardCount: CardCount,
  cards: z.array(z.object({ id: z.string(), localId: z.string(), name: z.string(), image: z.string().optional() })),
});
export type TcgdexSet = z.infer<typeof TcgdexSet>;

/** Cardmarket の価格（EUR、小数）。項目は揃わないことがあるので全部任意 */
export const CardmarketPricing = z
  .object({
    updated: z.string(),
    unit: z.string(),
    avg: z.number().nullable(),
    low: z.number().nullable(),
    trend: z.number().nullable(),
    avg7: z.number().nullable(),
    avg30: z.number().nullable(),
    "avg-holo": z.number().nullable(),
    "trend-holo": z.number().nullable(),
  })
  .partial();
export type CardmarketPricing = z.infer<typeof CardmarketPricing>;

export const TcgdexCard = z.object({
  id: z.string(),
  localId: z.string(),
  name: z.string(),
  image: z.string().optional(),
  rarity: z.string().optional(),
  set: z.object({ id: z.string(), name: z.string(), cardCount: CardCount.optional() }),
  pricing: z
    .object({ cardmarket: CardmarketPricing.nullable().optional() })
    .partial()
    .nullable()
    .optional(),
});
export type TcgdexCard = z.infer<typeof TcgdexCard>;

export class TcgdexClient {
  constructor(
    private readonly fetcher: PoliteFetcher,
    private readonly base = TCGDEX_BASE,
  ) {}

  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const res = await this.fetcher.fetch(`${this.base}${path}`);
    if (!res.ok) throw new Error(`TCGdex ${path}: HTTP ${res.status}`);
    return schema.parse(await res.json());
  }

  serie(id: string) {
    return this.get(`/series/${encodeURIComponent(id)}`, TcgdexSerie);
  }
  set(id: string) {
    return this.get(`/sets/${encodeURIComponent(id)}`, TcgdexSet);
  }
  card(id: string) {
    return this.get(`/cards/${encodeURIComponent(id)}`, TcgdexCard);
  }
}

/** TCGdex のカード → cardkun のカード */
export function toCard(card: TcgdexCard, set: Pick<TcgdexSet, "id" | "name" | "releaseDate" | "serie" | "cardCount">): Card {
  const official = set.cardCount.official;
  // 収録番号の表記：151 なら「201/165」。公式枚数がないセット（プロモ等）は番号だけ
  const number = official ? `${card.localId}/${String(official).padStart(3, "0")}` : card.localId;
  return {
    id: makeCardId(set.id, card.localId),
    name: card.name,
    nameEn: null,
    setCode: set.id.toLowerCase(),
    setName: set.name,
    number,
    rarity: rarityToJa(card.rarity, set.serie.id),
    // 一覧表示の速度を優先して小さい画像（low.webp）にする
    imageUrl: card.image ? `${card.image}/low.webp` : null,
    releaseDate: set.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(set.releaseDate) ? set.releaseDate : null,
  };
}
