import { mock, type PriceType } from "@cardkun/shared";
import type { Db } from "../db/client.js";
import { fxRates } from "../db/schema.js";
import { createFixtureCollector } from "../collectors/fixture.js";
import type { RawObservation } from "../collectors/types.js";
import { jstDate } from "../aggregate/summaries.js";
import { upsertCards } from "./cards.js";
import { runCollect } from "./collect.js";

/**
 * 開発用のデータを入れる。価格はすべて架空。
 * shared の仮カード・仮の取得元を使い、1 年分の観測を作って、本物と同じ収集の流れで保存する。
 */

const BASE_PRICE: Record<string, number> = { "sv2a-201": 18000, "sv2a-173": 3500, "sv2a-205": 6800 };

const SOURCE_TYPES: Record<string, { priceType: PriceType; ratio: number }[]> = {
  "shop-a": [
    { priceType: "shop_sell", ratio: 1.0 },
    { priceType: "shop_buy", ratio: 0.7 },
  ],
  "shop-b": [
    { priceType: "shop_sell", ratio: 1.05 },
    { priceType: "shop_buy", ratio: 0.68 },
  ],
  "flea-a": [
    { priceType: "market_sold", ratio: 0.88 },
    { priceType: "market_listing", ratio: 0.95 },
  ],
  "overseas-a": [{ priceType: "overseas", ratio: 0.82 }],
};

/** 再現性のある乱数 */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const USD_JPY = 150;

export async function seedDevData(db: Db, opts: { now?: Date; days?: number; log?: (m: string) => void } = {}) {
  const now = opts.now ?? new Date();
  const days = opts.days ?? 365;
  const rand = rng(42);

  await upsertCards(db, mock.mockCards);
  await db
    .insert(fxRates)
    .values({ currency: "USD", date: jstDate(now), rateJpy: USD_JPY })
    .onConflictDoNothing();

  const collectorList = mock.mockSources.map((source) => {
    const rows: RawObservation[] = [];
    for (const card of mock.mockCards) {
      const base = BASE_PRICE[card.id] ?? 1000;
      for (let i = days - 1; i >= 0; i--) {
        const observedAt = new Date(now.getTime() - i * 86400_000 - 3600_000);
        // 1 年で約 15% 上昇 + 波 + ゆらぎ
        const trend = 0.85 + 0.15 * ((days - i) / days) + 0.03 * Math.sin(i / 4);
        for (const { priceType, ratio } of SOURCE_TYPES[source.id] ?? []) {
          const count = priceType === "market_sold" ? 2 : 1;
          for (let k = 0; k < count; k++) {
            const jpy = Math.round((base * ratio * trend * (0.95 + rand() * 0.1)) / 10) * 10;
            const isUsd = source.currency === "USD";
            rows.push({
              card: { cardId: card.id },
              priceType,
              price: isUsd ? Math.round((jpy / USD_JPY) * 100) : jpy,
              currency: source.currency,
              condition: "A",
              observedAt,
            });
          }
        }
      }
    }
    return createFixtureCollector(source, rows);
  });

  return runCollect(db, collectorList, { now, log: opts.log ?? (() => undefined) });
}
