import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DbHandle } from "../db/client.js";
import { fxRates, priceObservations, priceSummaries } from "../db/schema.js";
import { TcgdexClient } from "../catalog/tcgdex.js";
import { FAKE_PRICING_UPDATED, fakeTcgdexFetch } from "../catalog/fake-tcgdex.js";
import { importCatalog } from "../jobs/import-catalog.js";
import { runCollect } from "../jobs/collect.js";
import { updateFxRates } from "../jobs/fx.js";
import { createTestDb, TEST_NOW } from "../test-helpers.js";
import { PoliteFetcher } from "./http.js";
import { createCardmarketCollector, pickEur } from "./cardmarket-tcgdex.js";

const fetcher = (impl: typeof fetch) =>
  new PoliteFetcher({ fetchImpl: impl, minIntervalMs: 0, sleep: async () => undefined });
const quiet = () => undefined;

const frankfurter = (body: unknown) =>
  (async (input: string | URL | Request) =>
    new URL(String(input)).pathname === "/robots.txt"
      ? new Response("", { status: 404 })
      : Response.json(body)) as typeof fetch;

let h: DbHandle;
beforeAll(async () => {
  h = await createTestDb();
  await importCatalog(h.db, new TcgdexClient(fetcher(fakeTcgdexFetch().impl)), { log: quiet });
});
afterAll(() => h.close());

describe("pickEur", () => {
  it("prefers trend, then falls back", () => {
    expect(pickEur({ trend: 10, avg: 12 })).toBe(10);
    expect(pickEur({ trend: null, avg7: 0, avg: 12 })).toBe(12);
    expect(pickEur({ "trend-holo": 7 })).toBe(7);
    expect(pickEur({})).toBeNull();
  });
});

describe("updateFxRates", () => {
  it("stores EUR and USD in yen", async () => {
    const fx = await updateFxRates(
      h.db,
      fetcher(frankfurter({ amount: 1, base: "EUR", date: "2026-11-17", rates: { JPY: 160, USD: 1.08 } })),
    );
    expect(fx).toEqual({ date: "2026-11-17", EUR: 160, USD: 148.1481 });
    const rows = await h.db.select().from(fxRates).where(eq(fxRates.date, "2026-11-17"));
    expect(rows).toHaveLength(2);
  });

  it("rejects an unexpected response", async () => {
    await expect(updateFxRates(h.db, fetcher(frankfurter({ base: "USD", rates: {} })))).rejects.toThrow();
  });
});

describe("Cardmarket collector (via TCGdex)", () => {
  const collector = () =>
    createCardmarketCollector({
      client: new TcgdexClient(fetcher(fakeTcgdexFetch().impl)),
      listSetCodes: async () => ["sv2a"],
    });

  it("collects EUR prices, converts to yen and builds overseas summaries", async () => {
    const [report] = await runCollect(h.db, [collector()], { now: TEST_NOW, log: quiet });
    // 4 枚のうち価格があるのは 3 枚（フシギダネは価格なし）
    expect(report).toMatchObject({ sourceId: "cardmarket", inserted: 3, unmatched: 0, error: null });

    const [obs] = await h.db.select().from(priceObservations).where(eq(priceObservations.cardId, "sv2a-201"));
    // €89.99 × 160円 = 14,398円
    expect(obs).toMatchObject({ price: 8999, currency: "EUR", priceJpy: 14398, condition: "A" });
    expect(obs!.observedAt.toISOString()).toBe(FAKE_PRICING_UPDATED);

    const [sum] = await h.db.select().from(priceSummaries).where(eq(priceSummaries.cardId, "sv2a-201"));
    expect(sum).toMatchObject({ priceType: "overseas", median: 14398, count: 1 });
  });

  it("does not store the same daily price twice", async () => {
    const [report] = await runCollect(h.db, [collector()], { now: TEST_NOW, log: quiet });
    expect(report).toMatchObject({ inserted: 0, duplicates: 3 });
    const rows = await h.db.select().from(priceObservations).where(eq(priceObservations.sourceId, "cardmarket"));
    expect(rows).toHaveLength(3);
  });
});
