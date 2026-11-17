import type { ListingAssistResponse } from "./api.js";
import type { Card, CardCondition, PriceSummary } from "./schemas.js";

/**
 * 出品サポートの計算（推奨価格・価格の幅・説明文）。
 * server（実データ）と web の mock の両方がこの関数を使い、計算ルールを 1 か所にまとめる。
 */

/** 状態ごとの係数（状態A を 1 とする） */
export const CONDITION_RATIO: Record<CardCondition, number> = {
  A: 1.0,
  B: 0.85,
  C: 0.7,
  D: 0.5,
  unknown: 0.8,
};

const round10 = (n: number) => Math.round(n / 10) * 10;
const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

export function suggestListing(
  card: Card,
  summaries: PriceSummary[],
  condition: CardCondition,
): ListingAssistResponse {
  // 基準価格：フリマ成約の中央値 → なければショップ販売の中央値 × 0.9
  const sold = summaries.find((s) => s.priceType === "market_sold");
  const shop = summaries.find((s) => s.priceType === "shop_sell");
  const basePrice = sold ? sold.median : shop ? round10(shop.median * 0.9) : 0;
  const basisLabel = sold
    ? `フリマ成約価格の中央値 ${yen(sold.median)}`
    : shop
      ? `ショップ販売価格の中央値 ${yen(shop.median)} × 0.9`
      : "相場データなし";

  const ratio = CONDITION_RATIO[condition];
  const suggested = round10(basePrice * ratio);

  return {
    cardId: card.id,
    suggestedPrice: suggested,
    priceRange: { low: round10(suggested * 0.93), high: round10(suggested * 1.07) },
    description: [
      `【ポケモンカード】${card.name} ${card.rarity} ${card.number}（${card.setName}）`,
      `状態：${condition === "unknown" ? "記載なし" : `${condition}ランク`}`,
      "スリーブに入れて保管していました。",
      "折れ・傷を防ぐため、硬質ケースに入れて発送します。",
    ].join("\n"),
    basis: `${basisLabel} × 状態係数 ${ratio}`,
  };
}
