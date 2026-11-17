import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mock, type PriceSource } from "@cardkun/shared";
import type { DbHandle } from "../db/client.js";
import { fxRates, priceDaily, priceObservations, priceSummaries } from "../db/schema.js";
import { createFixtureCollector } from "../collectors/fixture.js";
import type { Collector, RawObservation } from "../collectors/types.js";
import { createTestDb, TEST_NOW } from "../test-helpers.js";
import { upsertCards } from "./cards.js";
import { runCollect, toJpy } from "./collect.js";

const shop: PriceSource = { id: "s1", name: "S1", kind: "shop", region: "JP", currency: "JPY", url: "https://s1.example" };
const shop2: PriceSource = { ...shop, id: "s2", name: "S2" };
const flea: PriceSource = { ...shop, id: "f1", name: "F1", kind: "marketplace" };
const us: PriceSource = { ...shop, id: "u1", name: "U1", kind: "overseas", region: "US", currency: "USD" };

const daysAgo = (d: number) => new Date(TEST_NOW.getTime() - d * 86400_000);
const obs = (o: Partial<RawObservation> & Pick<RawObservation, "priceType" | "price">): RawObservation => ({
  card: { cardId: "sv2a-201" },
  currency: "JPY",
  condition: "A",
  observedAt: daysAgo(0),
  ...o,
});

let h: DbHandle;
beforeAll(async () => {
  h = await createTestDb();
  await upsertCards(h.db, mock.mockCards);
  await h.db.insert(fxRates).values({ currency: "USD", date: "2026-11-17", rateJpy: 150 });
});
afterAll(() => h.close());

describe("toJpy", () => {
  it("converts cents with the latest rate", () => {
    const rates = new Map([["USD", 150]]);
    expect(toJpy(1000, "JPY", rates)).toBe(1000);
    expect(toJpy(1234, "USD", rates)).toBe(1851);
    expect(toJpy(100, "EUR", rates)).toBeNull();
  });
});

describe("runCollect", () => {
  it("saves observations and computes summaries with the documented rules", async () => {
    const collectors: Collector[] = [
      createFixtureCollector(shop, [
        obs({ priceType: "shop_sell", price: 9000, observedAt: daysAgo(2) }), // 古い → 使わない
        obs({ priceType: "shop_sell", price: 10000, observedAt: daysAgo(1) }), // s1 の最新
        obs({ priceType: "shop_sell", price: 5000, condition: "B" }), // 状態B → 集計に使わない
        obs({ priceType: "shop_sell", price: 90000, grading: { company: "PSA", grade: 10 } }), // 鑑定 → 使わない
        obs({ priceType: "shop_sell", price: 1, observedAt: daysAgo(8) }), // 7日より前 → 使わない
        obs({ priceType: "shop_sell", price: 7000, observedAt: daysAgo(7) }), // 7日前の日次用
        // 番号指定。ゼロ埋めされて sv2a-201 になる
        obs({ card: { setCode: "SV2a", number: "201/165" }, priceType: "shop_buy", price: 7000 }),
        obs({ card: { setCode: "sv9", number: "999/999" }, priceType: "shop_buy", price: 1 }), // 未登録カード
      ]),
      createFixtureCollector(shop2, [obs({ priceType: "shop_sell", price: 12000 })]),
      createFixtureCollector(flea, [
        obs({ priceType: "market_sold", price: 8000, observedAt: daysAgo(20) }),
        obs({ priceType: "market_sold", price: 9000, observedAt: daysAgo(10) }),
        obs({ priceType: "market_sold", price: 10000, observedAt: daysAgo(1) }),
        obs({ priceType: "market_sold", price: 1, observedAt: daysAgo(40) }), // 30日より前
      ]),
      createFixtureCollector(us, [
        obs({ priceType: "overseas", price: 6000, currency: "USD" }), // $60 → 9000円
        obs({ priceType: "overseas", price: 100, currency: "EUR" }), // レートなし
      ]),
    ];

    const reports = await runCollect(h.db, collectors, { now: TEST_NOW, log: () => undefined });
    const byId = Object.fromEntries(reports.map((r) => [r.sourceId, r]));
    expect(byId.s1).toMatchObject({ inserted: 7, unmatched: 1, error: null });
    expect(byId.u1).toMatchObject({ inserted: 1, noFxRate: 1 });

    const sums = await h.db.select().from(priceSummaries).where(eq(priceSummaries.cardId, "sv2a-201"));
    const s = Object.fromEntries(sums.map((r) => [r.priceType, r]));

    // shop_sell：s1 の最新 10000 と s2 の 12000
    expect(s.shop_sell).toMatchObject({ min: 10000, median: 11000, max: 12000, count: 2 });
    // 7日前の日次中央値 7000 → 11000 で +57.14%
    expect(s.shop_sell!.change7d).toBeCloseTo(0.5714, 4);
    expect(s.shop_buy).toMatchObject({ median: 7000, count: 1, change7d: null });
    // market_sold：30日以内のすべて
    expect(s.market_sold).toMatchObject({ min: 8000, median: 9000, max: 10000, count: 3 });
    expect(s.overseas).toMatchObject({ median: 9000, count: 1 });

    const [usObs] = await h.db.select().from(priceObservations).where(eq(priceObservations.sourceId, "u1"));
    expect(usObs).toMatchObject({ price: 6000, currency: "USD", priceJpy: 9000 });

    const daily = await h.db.select().from(priceDaily).where(eq(priceDaily.date, "2026-11-10"));
    expect(daily.find((d) => d.priceType === "shop_sell")).toMatchObject({ median: 7000 });
  });

  it("keeps going when a collector throws", async () => {
    const broken: Collector = {
      source: { ...shop, id: "broken" },
      // eslint-disable-next-line require-yield
      async *collect() {
        throw new Error("boom");
      },
    };
    const ok = createFixtureCollector(shop2, [obs({ priceType: "shop_sell", price: 11000 })]);
    const reports = await runCollect(h.db, [broken, ok], { now: TEST_NOW, log: () => undefined });
    expect(reports[0]).toMatchObject({ sourceId: "broken", error: "boom" });
    expect(reports[1]).toMatchObject({ sourceId: "s2", inserted: 1, error: null });
  });
});

describe("refreshAllSummaries", () => {
  it("drops summaries whose observations have aged out", async () => {
    const before = await h.db.select().from(priceSummaries).where(eq(priceSummaries.cardId, "sv2a-201"));
    expect(before.length).toBeGreaterThan(0);
    // 60 日後：どの観測も集計期間外になる。今回の収集では sv2a-201 の観測なし
    const later = new Date(TEST_NOW.getTime() + 60 * 86400_000);
    await runCollect(h.db, [], { now: later, log: () => undefined, refreshAllSummaries: true });
    const after = await h.db.select().from(priceSummaries).where(eq(priceSummaries.cardId, "sv2a-201"));
    expect(after).toEqual([]);
  });
});
