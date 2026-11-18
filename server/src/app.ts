import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import {
  CardHistoryQuery,
  CardObservationsQuery,
  CardSearchQuery,
  ListingAssistRequest,
  suggestListing,
  type ErrorResponse,
  type HealthResponse,
  type SetsResponse,
  type SourcesResponse,
} from "@cardkun/shared";
import type { Db } from "./db/client.js";
import {
  cardExists,
  getCardDetail,
  getCardHistory,
  listObservations,
  listSets,
  listSources,
  searchCards,
} from "./repo/cards.js";

/**
 * API ルート。レスポンスの形は shared/src/api.ts のまま変えないこと。
 */

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

  app.get("/cards/:id/observations", async (c) => {
    const id = c.req.param("id");
    const parsed = CardObservationsQuery.safeParse(c.req.query());
    if (!parsed.success) return error(c, 400, "bad_request", "invalid query");
    if (!(await cardExists(db, id))) return error(c, 404, "not_found", "card not found");
    c.header("Cache-Control", "public, max-age=60");
    return c.json(await listObservations(db, id, parsed.data));
  });

  app.get("/sets", async (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.json<SetsResponse>({ items: await listSets(db) });
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

    return c.json(suggestListing(detail.card, detail.summaries, condition));
  });

  return app;
}
