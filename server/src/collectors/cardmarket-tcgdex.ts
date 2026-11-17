import type { PriceSource } from "@cardkun/shared";
import type { CardmarketPricing, TcgdexClient } from "../catalog/tcgdex.js";
import { DEFAULT_SERIES } from "../jobs/import-catalog.js";
import type { Collector, RawObservation } from "./types.js";

/**
 * 海外相場：Cardmarket（欧州最大のカード取引所）の日本語版カードの相場（EUR）。
 * Cardmarket の API はプロ販売者限定のため、Cardmarket の公開相場を収録している TCGdex（MIT）経由で取得する。
 * 出典表示：「Cardmarket（TCGdex 経由）」
 */

export const CARDMARKET_SOURCE: PriceSource = {
  id: "cardmarket",
  name: "Cardmarket（TCGdex経由）",
  kind: "overseas",
  region: "EU",
  currency: "EUR",
  url: "https://www.cardmarket.com",
};

/** 相場として使う値：トレンド価格 → 7日平均 → 平均 →（ホロ版の値） */
export function pickEur(p: CardmarketPricing): number | null {
  for (const v of [p.trend, p.avg7, p.avg, p["trend-holo"], p["avg-holo"]]) {
    if (typeof v === "number" && v > 0) return v;
  }
  return null;
}

export function createCardmarketCollector(opts: {
  client: TcgdexClient;
  /** 対象の弾コード（DB に登録済みのカードの set_code。小文字） */
  listSetCodes: () => Promise<string[]>;
  /** TCGdex の正式なセット ID（大文字小文字あり）を調べるシリーズ */
  series?: string[];
}): Collector {
  return {
    source: CARDMARKET_SOURCE,
    async *collect({ now, log }) {
      // 小文字の弾コード → TCGdex の正式なセット ID（例: sv2a → SV2a）
      const officialIds = new Map<string, string>();
      for (const serieId of opts.series ?? DEFAULT_SERIES) {
        try {
          for (const s of (await opts.client.serie(serieId)).sets) officialIds.set(s.id.toLowerCase(), s.id);
        } catch (e) {
          log(`[cardmarket] serie ${serieId}: ${e instanceof Error ? e.message : e}`);
        }
      }

      for (const setCode of await opts.listSetCodes()) {
        const setId = officialIds.get(setCode) ?? setCode;
        let set;
        try {
          set = await opts.client.set(setId);
        } catch (e) {
          log(`[cardmarket] set ${setCode}: ${e instanceof Error ? e.message : e}`);
          continue;
        }
        for (const brief of set.cards) {
          let card;
          try {
            card = await opts.client.card(brief.id);
          } catch (e) {
            log(`[cardmarket] card ${brief.id}: ${e instanceof Error ? e.message : e}`);
            continue;
          }
          const pricing = card.pricing?.cardmarket;
          if (!pricing || (pricing.unit && pricing.unit !== "EUR")) continue;
          const eur = pickEur(pricing);
          if (eur === null) continue;
          const updated = pricing.updated ? new Date(pricing.updated) : now;
          const observedAt = Number.isNaN(updated.getTime()) || updated > now ? now : updated;
          const obs: RawObservation = {
            card: { setCode: set.id, number: card.localId },
            priceType: "overseas",
            price: Math.round(eur * 100), // セント
            currency: "EUR",
            condition: "A",
            observedAt,
            // Cardmarket の相場は 1 日 1 回更新。同じ更新分を二重に保存しない
            externalId: `${card.id}:${observedAt.toISOString()}`,
          };
          yield obs;
        }
      }
    },
  };
}
