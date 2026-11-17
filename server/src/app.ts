import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import {
  CardHistoryQuery,
  CardSearchQuery,
  ListingAssistRequest,
  mock,
  type CardDetailResponse,
  type CardHistoryResponse,
  type CardSearchResponse,
  type ErrorResponse,
  type HealthResponse,
  type ListingAssistResponse,
  type SourcesResponse,
} from "@cardkun/shared";

/**
 * API ルート。
 * 今は shared の仮データを返す。DB と価格収集ができたら中身を差し替える
 * （レスポンスの形は shared/src/api.ts のまま変えない）。
 */

const CONDITION_RATIO = { A: 1.0, B: 0.85, C: 0.7, D: 0.5, unknown: 0.8 } as const;

function error(c: Context, status: 400 | 404, code: "bad_request" | "not_found", message: string) {
  return c.json<ErrorResponse>({ error: { code, message } }, status);
}

export function createApp() {
  const app = new Hono().basePath("/api");

  app.use("*", cors());

  app.get("/health", (c) => c.json<HealthResponse>({ ok: true }));

  app.get("/cards", (c) => {
    const parsed = CardSearchQuery.safeParse(c.req.query());
    if (!parsed.success) return error(c, 400, "bad_request", parsed.error.message);
    const res: CardSearchResponse = mock.mockSearch(parsed.data.q);
    res.items = res.items.slice(0, parsed.data.limit);
    c.header("Cache-Control", "public, max-age=60");
    return c.json(res);
  });

  app.get("/cards/:id", (c) => {
    const res: CardDetailResponse | null = mock.mockCardDetail(c.req.param("id"));
    if (!res) return error(c, 404, "not_found", "card not found");
    c.header("Cache-Control", "public, max-age=60");
    return c.json(res);
  });

  app.get("/cards/:id/history", (c) => {
    const id = c.req.param("id");
    const parsed = CardHistoryQuery.safeParse(c.req.query());
    if (!parsed.success) return error(c, 400, "bad_request", parsed.error.message);
    if (!mock.mockCardDetail(id)) return error(c, 404, "not_found", "card not found");
    const res: CardHistoryResponse = mock.mockHistory(id, parsed.data.range);
    c.header("Cache-Control", "public, max-age=300");
    return c.json(res);
  });

  app.get("/sources", (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.json<SourcesResponse>(mock.mockSourcesResponse);
  });

  app.post("/listing-assist", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = ListingAssistRequest.safeParse(body);
    if (!parsed.success) return error(c, 400, "bad_request", "invalid request body");
    const { cardId, condition } = parsed.data;
    const detail = mock.mockCardDetail(cardId);
    if (!detail) return error(c, 404, "not_found", "card not found");

    // 仮ロジック：フリマ成約の中央値 × 状態の係数
    const sold = detail.summaries.find((s) => s.priceType === "market_sold");
    const basePrice = sold?.median ?? 0;
    const suggested = Math.round((basePrice * CONDITION_RATIO[condition]) / 10) * 10;
    const { card } = detail;
    const res: ListingAssistResponse = {
      cardId,
      suggestedPrice: suggested,
      priceRange: {
        low: Math.round((suggested * 0.93) / 10) * 10,
        high: Math.round((suggested * 1.07) / 10) * 10,
      },
      description: [
        `【ポケモンカード】${card.name} ${card.rarity} ${card.number}（${card.setName}）`,
        `状態：${condition === "unknown" ? "記載なし" : `${condition}ランク`}`,
        "スリーブに入れて保管していました。",
        "折れ・傷を防ぐため、硬質ケースに入れて発送します。",
      ].join("\n"),
      basis: `フリマ成約価格の中央値 ${basePrice.toLocaleString("ja-JP")}円 × 状態係数 ${CONDITION_RATIO[condition]}`,
    };
    return c.json(res);
  });

  return app;
}
