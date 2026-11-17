import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CardDetailResponse,
  CardHistoryResponse,
  CardSearchResponse,
  ErrorResponse,
  HealthResponse,
  ListingAssistResponse,
  SourcesResponse,
} from "@cardkun/shared";
import type { DbHandle } from "./db/client.js";
import { createApp } from "./app.js";
import { createSeededDb, TEST_NOW } from "./test-helpers.js";

let h: DbHandle;
let app: ReturnType<typeof createApp>;
const get = (path: string) => app.request(path);
const search = async (qs: string) => CardSearchResponse.parse(await (await get(`/api/cards?${qs}`)).json());

beforeAll(async () => {
  h = await createSeededDb();
  app = createApp({ db: h.db, now: () => TEST_NOW });
});
afterAll(() => h.close());

// API のレスポンスが shared の約束事どおりで、DB のデータを返しているかを確認する
describe("API (DB-backed) matches the shared contract", () => {
  it("GET /api/health", async () => {
    HealthResponse.parse(await (await get("/api/health")).json());
  });

  it("search matches katakana, hiragana, half-width and English", async () => {
    for (const q of ["リザードン", "りざーどん", "ﾘｻﾞｰﾄﾞﾝ", "charizard", "リザードン EX"]) {
      const body = await search(`q=${encodeURIComponent(q)}`);
      expect(body.items.map((c) => c.id), q).toEqual(["sv2a-201"]);
    }
  });

  it("search results include pre-computed summaries", async () => {
    const [card] = (await search("q=ピカチュウ")).items;
    const types = card!.summaries.map((s) => s.priceType).sort();
    expect(types).toEqual(["market_listing", "market_sold", "overseas", "shop_buy", "shop_sell"]);
    const sell = card!.summaries.find((s) => s.priceType === "shop_sell")!;
    expect(sell.count).toBe(2); // shop-a と shop-b の最新
    expect(sell.change7d).not.toBeNull();
  });

  it("search filters and paginates", async () => {
    expect((await search("rarity=SAR")).items.map((c) => c.id)).toEqual(["sv2a-201"]);
    const page1 = await search("set=sv2a&limit=2");
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();
    const page2 = await search(`set=sv2a&limit=2&cursor=${page1.nextCursor}`);
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
    const ids = [...page1.items, ...page2.items].map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("search treats LIKE wildcards literally", async () => {
    expect((await search("q=%25")).items).toEqual([]);
  });

  it("rejects bad input", async () => {
    const bad = await get("/api/cards?limit=0");
    expect(bad.status).toBe(400);
    ErrorResponse.parse(await bad.json());
  });

  it("GET /api/cards/:id", async () => {
    const res = await get("/api/cards/sv2a-201");
    expect(res.status).toBe(200);
    const body = CardDetailResponse.parse(await res.json());
    // 取得元 × 種類ごとの最新：shop-a 2 + shop-b 2 + flea-a 2 + overseas-a 1
    expect(body.latest).toHaveLength(7);
    expect(body.latest.find((o) => o.sourceId === "overseas-a")).toMatchObject({ currency: "USD" });
    expect((await get("/api/cards/nope")).status).toBe(404);
  });

  it("GET /api/cards/:id/history", async () => {
    const body = CardHistoryResponse.parse(await (await get("/api/cards/sv2a-201/history?range=30d")).json());
    const dates = new Set(body.points.map((p) => p.date));
    expect(dates.size).toBe(30);
    expect([...dates].at(-1)).toBe("2026-11-17");
    expect((await get("/api/cards/sv2a-201/history?range=5y")).status).toBe(400);
    expect((await get("/api/cards/nope/history")).status).toBe(404);
  });

  it("GET /api/sources", async () => {
    const body = SourcesResponse.parse(await (await get("/api/sources")).json());
    expect(body.items.map((s) => s.id)).toEqual(["flea-a", "overseas-a", "shop-a", "shop-b"]);
  });

  it("POST /api/listing-assist", async () => {
    const post = (body: unknown) =>
      app.request("/api/listing-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const a = ListingAssistResponse.parse(await (await post({ cardId: "sv2a-201", condition: "A" })).json());
    const b = ListingAssistResponse.parse(await (await post({ cardId: "sv2a-201", condition: "B" })).json());
    expect(b.suggestedPrice).toBeLessThan(a.suggestedPrice);
    expect(b.priceRange.low).toBeLessThanOrEqual(b.suggestedPrice);
    expect(b.priceRange.high).toBeGreaterThanOrEqual(b.suggestedPrice);
    expect(b.description).toContain("リザードンex");
    expect((await post({ cardId: "nope", condition: "A" })).status).toBe(404);
    expect((await post({ cardId: "sv2a-201", condition: "Z" })).status).toBe(400);
  });
});
