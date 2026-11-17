import type { PriceType } from "@cardkun/shared";
export const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
export const labels: Record<PriceType, string> = {
  shop_sell: "ショップ販売",
  shop_buy: "ショップ買取",
  market_sold: "フリマ成約",
  market_listing: "フリマ出品中",
  overseas: "海外相場",
};
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
