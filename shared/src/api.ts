import { z } from "zod";
import {
  Card,
  CardCondition,
  CardDetails,
  CardSet,
  CardWithSummary,
  HistoryRange,
  PriceHistoryPoint,
  PriceObservation,
  PriceSource,
  PriceSummary,
  PriceType,
  SearchSort,
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
  cardObservations: (id: string) => `/api/cards/${encodeURIComponent(id)}/observations`,
  sets: "/api/sets",
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
  /** 並び順。省略時は new（発売日の新しい順） */
  sort: SearchSort.optional(),
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
  /** カードの詳しい情報（HP・ワザなど）。未取得なら null か省略 */
  details: CardDetails.nullable().optional(),
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

// ---------- GET /api/cards/:id/observations ----------

/** 価格の観測（生データ）を新しい順に全件返す */
export const CardObservationsQuery = z.object({
  sourceId: z.string().optional(),
  priceType: PriceType.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().optional(),
});
export type CardObservationsQuery = z.infer<typeof CardObservationsQuery>;

export const CardObservationsResponse = z.object({
  cardId: z.string(),
  items: z.array(PriceObservation),
  nextCursor: z.string().nullable(),
});
export type CardObservationsResponse = z.infer<typeof CardObservationsResponse>;

// ---------- GET /api/sets ----------

/** 弾（セット）の一覧。発売日の新しい順 */
export const SetsResponse = z.object({
  items: z.array(CardSet),
});
export type SetsResponse = z.infer<typeof SetsResponse>;

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
