import type { PriceSummary, PriceType } from "@cardkun/shared";
import { yen } from "../lib/format";
export function Change({ value }: { value: number | null }) {
  return (
    <span
      className={
        value === null
          ? "muted"
          : value > 0
            ? "up"
            : value < 0
              ? "down"
              : "muted"
      }
    >
      {value === null
        ? "比較データなし"
        : `${value > 0 ? "↑ +" : value < 0 ? "↓ " : ""}${(value * 100).toFixed(1)}%`}
      <small> / 7日</small>
    </span>
  );
}
const metrics: [PriceType, string, "min" | "max" | "median"][] = [
  ["shop_sell", "販売最安", "min"],
  ["shop_buy", "買取最高", "max"],
  ["market_sold", "フリマ相場", "median"],
  ["overseas", "海外相場", "median"],
];
export function Prices({ summaries }: { summaries: PriceSummary[] }) {
  return (
    <dl className="metrics">
      {metrics.map(([type, title, field]) => {
        const s = summaries.find((s) => s.priceType === type);
        return (
          <div key={type}>
            <dt>{title}</dt>
            <dd>{s && s.count > 0 ? yen(s[field]) : "—"}</dd>
            <Change value={s?.change7d ?? null} />
          </div>
        );
      })}
    </dl>
  );
}
