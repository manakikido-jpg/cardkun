import { z } from "zod";
import {
  Card,
  CardCondition,
  CardWithSummary,
  HistoryRange,
  PriceHistoryPoint,
  PriceObservation,
  PriceSource,
  PriceSummary,
} from "./schemas.js";

/**
 * API の約束事。server/ はこの形で返し、web/ はこの形を前提に表示する。
 * ベースパスは /api。
 */

export const API_PATHS = {
  health: "/api/health",
  cards: "/api/cards",
  card: (id: string) => `/api/cards/${encodeURIComponent(id)}`,
  cardHistory: (id: string) => `/api/cards/${encodeURIComponent(id)}/history`,
  sources: "/api/sources",
  listingAssist: "/api/listing-assist",
} as const;

// ---------- GET /api/health ----------

export const HealthResponse = z.object({ ok: z.literal(true) });
export type HealthResponse = z.infer<typeof HealthResponse>;

// ---------- GET /api/cards ----------

export const CardSearchQuery = z.object({
  q: z.string().trim().max(100).optional(),
  set: z.string().optional(),
  rarity: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type CardSearchQuery = z.infer<typeof CardSearchQuery>;

export const CardSearchResponse = z.object({
  items: z.array(CardWithSummary),
  /** 次のページがあればそのカーソル、なければ null */
  nextCursor: z.string().nullable(),
});
export type CardSearchResponse = z.infer<typeof CardSearchResponse>;

// ---------- GET /api/cards/:id ----------

export const CardDetailResponse = z.object({
  card: Card,
  summaries: z.array(PriceSummary),
  /** ソース別の最新の観測 */
  latest: z.array(PriceObservation),
});
export type CardDetailResponse = z.infer<typeof CardDetailResponse>;

// ---------- GET /api/cards/:id/history ----------

export const CardHistoryQuery = z.object({
  range: HistoryRange.default("30d"),
});
export type CardHistoryQuery = z.infer<typeof CardHistoryQuery>;

export const CardHistoryResponse = z.object({
  cardId: z.string(),
  range: HistoryRange,
  points: z.array(PriceHistoryPoint),
});
export type CardHistoryResponse = z.infer<typeof CardHistoryResponse>;

// ---------- GET /api/sources ----------

export const SourcesResponse = z.object({
  items: z.array(PriceSource),
});
export type SourcesResponse = z.infer<typeof SourcesResponse>;

// ---------- POST /api/listing-assist ----------

export const ListingAssistRequest = z.object({
  cardId: z.string(),
  condition: CardCondition,
});
export type ListingAssistRequest = z.infer<typeof ListingAssistRequest>;

export const ListingAssistResponse = z.object({
  cardId: z.string(),
  /** 推奨出品価格（円） */
  suggestedPrice: z.number().int().nonnegative(),
  /** 推奨価格の幅（円） */
  priceRange: z.object({
    low: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
  }),
  /** 出品説明文のたたき台 */
  description: z.string(),
  /** 推奨価格の根拠（表示用） */
  basis: z.string(),
});
export type ListingAssistResponse = z.infer<typeof ListingAssistResponse>;

// ---------- エラー ----------

export const ErrorResponse = z.object({
  error: z.object({
    code: z.enum(["bad_request", "not_found", "internal"]),
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
