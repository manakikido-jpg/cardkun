"use client";
import { useState } from "react";
import type { CardHistoryResponse, PriceType } from "@cardkun/shared";
import { labels, yen } from "../lib/format";
const colors = ["#74d8e4", "#e9b86f", "#a5b6fa", "#e6a6cb", "#9cadb8"];
export function HistoryChart({
  histories,
}: {
  histories: CardHistoryResponse[];
}) {
  const [range, setRange] = useState("30d");
  const history = histories.find((h) => h.range === range) ?? histories[0]!;
  if (!history.points.length)
    return <p>この期間の価格データはまだありません。</p>;
  const dates = [...new Set(history.points.map((p) => p.date))].sort();
  const values = history.points.map((p) => p.median);
  const low = Math.min(...values) * 0.95,
    high = Math.max(...values) * 1.05;
  const types = [...new Set(history.points.map((p) => p.priceType))];
  const x = (date: string) =>
    85 + (dates.indexOf(date) / Math.max(dates.length - 1, 1)) * 370;
  const y = (value: number) =>
    215 - ((value - low) / Math.max(high - low, 1)) * 180;
  return (
    <div>
      <div className="tabs" role="group" aria-label="価格推移の期間">
        {histories.map((h) => (
          <button
            type="button"
            key={h.range}
            aria-pressed={range === h.range}
            onClick={() => setRange(h.range)}
          >
            {h.range === "30d" ? "30日" : h.range === "90d" ? "90日" : "1年"}
          </button>
        ))}
      </div>
      <svg
        className="chart"
        viewBox="0 0 480 260"
        role="img"
        aria-label="価格種別ごとの中央値の推移。詳細は下の価格データから確認できます。"
      >
        {[0, 1, 2, 3].map((i) => {
          const value = low + ((high - low) * i) / 3;
          return (
            <g key={i}>
              <line
                x1="85"
                x2="455"
                y1={y(value)}
                y2={y(value)}
                stroke="var(--line)"
              />
              <text x="5" y={y(value) + 5}>
                {yen(Math.round(value))}
              </text>
            </g>
          );
        })}
        {types.map((type: PriceType, i) => (
          <polyline
            key={type}
            fill="none"
            stroke={colors[i]}
            strokeWidth="3"
            points={history.points
              .filter((p) => p.priceType === type)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((p) => `${x(p.date)},${y(p.median)}`)
              .join(" ")}
          />
        ))}
        <text x="85" y="250">
          {dates[0]}
        </text>
        <text x="455" y="250" textAnchor="end">
          {dates.at(-1)}
        </text>
      </svg>
      <div className="legend">
        {types.map((type, i) => (
          <span key={type}>
            <i style={{ background: colors[i] }} />
            {labels[type]}
          </span>
        ))}
      </div>
      <details>
        <summary>価格データを表示</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>日付</th>
                <th>種類</th>
                <th>中央値</th>
              </tr>
            </thead>
            <tbody>
              {history.points.map((p) => (
                <tr key={`${p.date}-${p.priceType}`}>
                  <td>{p.date}</td>
                  <td>{labels[p.priceType]}</td>
                  <td>{yen(p.median)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
