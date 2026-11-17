import { asc } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { cards } from "../db/schema.js";
import { TcgdexClient } from "../catalog/tcgdex.js";
import { PoliteFetcher } from "./http.js";
import { createCardmarketCollector } from "./cardmarket-tcgdex.js";
import type { Collector } from "./types.js";

/**
 * 定期収集で実行する Collector の一覧。
 * 取得元ごとに利用規約・robots.txt を確認してから追加すること（types.ts、docs/sources.md 参照）。
 *
 * 国内ショップ・フリマは、規約で自動取得が禁止されているか確認できていないため未登録。
 */
export function buildCollectors(db: Db): Collector[] {
  // TCGdex には明示的なレート制限はないが、1 秒 4 リクエストまでに抑える
  const tcgdex = new TcgdexClient(new PoliteFetcher({ minIntervalMs: 250 }));
  return [
    createCardmarketCollector({
      client: tcgdex,
      listSetCodes: async () =>
        (await db.selectDistinct({ s: cards.setCode }).from(cards).orderBy(asc(cards.setCode))).map((r) => r.s),
    }),
  ];
}
