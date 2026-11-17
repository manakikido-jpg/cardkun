import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { fxRates } from "../db/schema.js";
import type { PoliteFetcher } from "../collectors/http.js";

/**
 * 為替レートの更新。欧州中央銀行（ECB）の参照レートを Frankfurter（無料・キー不要）から取得する。
 * 出典表示：「為替レート：欧州中央銀行（ECB）」
 */

export const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=JPY,USD";

const FrankfurterResponse = z.object({
  base: z.literal("EUR"),
  date: z.iso.date(),
  rates: z.object({ JPY: z.number().positive(), USD: z.number().positive() }),
});

/** 取得して fx_rates に保存する。保存したレート（1 単位あたりの円）を返す */
export async function updateFxRates(
  db: Db,
  fetcher: PoliteFetcher,
  url = FRANKFURTER_URL,
): Promise<{ date: string; EUR: number; USD: number }> {
  const res = await fetcher.fetch(url);
  if (!res.ok) throw new Error(`fx: HTTP ${res.status}`);
  const { date, rates } = FrankfurterResponse.parse(await res.json());
  const eur = rates.JPY;
  const usd = Math.round((rates.JPY / rates.USD) * 10000) / 10000;
  await db
    .insert(fxRates)
    .values([
      { currency: "EUR", date, rateJpy: eur },
      { currency: "USD", date, rateJpy: usd },
    ])
    .onConflictDoUpdate({ target: [fxRates.currency, fxRates.date], set: { rateJpy: sql`excluded.rate_jpy` } });
  return { date, EUR: eur, USD: usd };
}
