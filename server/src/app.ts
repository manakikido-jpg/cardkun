import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import {
  CardHistoryQuery,
  CardSearchQuery,
  ListingAssistRequest,
  type ErrorResponse,
  type HealthResponse,
  type ListingAssistResponse,
  type SourcesResponse,
} from "@cardkun/shared";
import type { Db } from "./db/client.js";
import { cardExists, getCardDetail, getCardHistory, listSources, searchCards } from "./repo/cards.js";

/**
 * API ルート。レスポンスの形は shared/src/api.ts のまま変えないこと。
 */

const CONDITION_RATIO = { A: 1.0, B: 0.85, C: 0.7, D: 0.5, unknown: 0.8 } as const;

const round10 = (n: number) => Math.round(n / 10) * 10;

function error(c: Context, status: 400 | 404, code: "bad_request" | "not_found", message: string) {
  return c.json<ErrorResponse>({ error: { code, message } }, status);
}

export interface AppDeps {
  db: Db;
  /** 現在時刻（テストで固定するため） */
  now?: () => Date;
}

export function createApp({ db, now = () => new Date() }: AppDeps) {
  const app = new Hono().basePath("/api");

  app.use("*", cors());

  app.onError((err, c) => {
    console.error(err);
    return c.json<ErrorResponse>({ error: { code: "internal", message: "internal error" } }, 500);
  });

  app.get("/health", (c) => c.json<HealthResponse>({ ok: true }));

  app.get("/cards", async (c) => {
    const parsed = CardSearchQuery.safeParse(c.req.query());
    if (!parsed.success) return error(c, 400, "bad_request", "invalid query");
    const res = await searchCards(db, parsed.data);
    c.header("Cache-Control", "public, max-age=60");
    return c.json(res);
  });

  app.get("/cards/:id", async (c) => {
    const res = await getCardDetail(db, c.req.param("id"), now());
    if (!res) return error(c, 404, "not_found", "card not found");
    c.header("Cache-Control", "public, max-age=60");
    return c.json(res);
  });

  app.get("/cards/:id/history", async (c) => {
    const id = c.req.param("id");
    const parsed = CardHistoryQuery.safeParse(c.req.query());
    if (!parsed.success) return error(c, 400, "bad_request", "invalid query");
    if (!(await cardExists(db, id))) return error(c, 404, "not_found", "card not found");
    const res = await getCardHistory(db, id, parsed.data.range, now());
    c.header("Cache-Control", "public, max-age=300");
    return c.json(res);
  });

  app.get("/sources", async (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.json<SourcesResponse>({ items: await listSources(db) });
  });

  app.post("/listing-assist", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = ListingAssistRequest.safeParse(body);
    if (!parsed.success) return error(c, 400, "bad_request", "invalid request body");
    const { cardId, condition } = parsed.data;
    const detail = await getCardDetail(db, cardId, now());
    if (!detail) return error(c, 404, "not_found", "card not found");

    // 基準価格：フリマ成約の中央値 → なければショップ販売の中央値 × 0.9
    const sold = detail.summaries.find((s) => s.priceType === "market_sold");
    const shop = detail.summaries.find((s) => s.priceType === "shop_sell");
    const basePrice = sold?.median ?? (shop ? round10(shop.median * 0.9) : 0);
    const basisLabel = sold
      ? `フリマ成約価格の中央値 ${sold.median.toLocaleString("ja-JP")}円`
      : shop
        ? `ショップ販売価格の中央値 ${shop.median.toLocaleString("ja-JP")}円 × 0.9`
        : "相場データなし";
    const suggested = round10(basePrice * CONDITION_RATIO[condition]);
    const { card } = detail;

    const res: ListingAssistResponse = {
      cardId,
      suggestedPrice: suggested,
      priceRange: { low: round10(suggested * 0.93), high: round10(suggested * 1.07) },
      description: [
        `【ポケモンカード】${card.name} ${card.rarity} ${card.number}（${card.setName}）`,
        `状態：${condition === "unknown" ? "記載なし" : `${condition}ランク`}`,
        "スリーブに入れて保管していました。",
        "折れ・傷を防ぐため、硬質ケースに入れて発送します。",
      ].join("\n"),
      basis: `${basisLabel} × 状態係数 ${CONDITION_RATIO[condition]}`,
    };
    return c.json(res);
  });

  return app;
}
