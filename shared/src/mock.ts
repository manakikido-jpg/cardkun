import type {
  CardDetailResponse,
  CardHistoryResponse,
  CardObservationsResponse,
  CardSearchResponse,
  ListingAssistResponse,
  SetsResponse,
  SourcesResponse,
} from "./api.js";
import { suggestListing } from "./listing.js";
import type {
  Card,
  CardCondition,
  CardDetails,
  HistoryRange,
  PriceHistoryPoint,
  PriceObservation,
  PriceSource,
  PriceSummary,
  PriceType,
} from "./schemas.js";

/**
 * 画面開発用の仮データ。価格はすべて架空の値。
 * server/ の API ができるまで、web/ はこれを使って画面を作れる。
 */

const AT = "2026-11-17T00:00:00.000Z";

export const mockSources: PriceSource[] = [
  { id: "shop-a", name: "ショップA（仮）", kind: "shop", region: "JP", currency: "JPY", url: "https://example.com/shop-a" },
  { id: "shop-b", name: "ショップB（仮）", kind: "shop", region: "JP", currency: "JPY", url: "https://example.com/shop-b" },
  { id: "flea-a", name: "フリマA（仮）", kind: "marketplace", region: "JP", currency: "JPY", url: "https://example.com/flea-a" },
  { id: "overseas-a", name: "Overseas A (mock)", kind: "overseas", region: "US", currency: "USD", url: "https://example.com/overseas-a" },
];

export const mockCards: Card[] = [
  {
    id: "sv2a-201",
    name: "リザードンex",
    nameEn: "Charizard ex",
    setCode: "sv2a",
    setName: "ポケモンカード151",
    number: "201/165",
    rarity: "SAR",
    imageUrl: null,
    releaseDate: "2023-06-16",
  },
  {
    id: "sv2a-173",
    name: "ピカチュウ",
    nameEn: "Pikachu",
    setCode: "sv2a",
    setName: "ポケモンカード151",
    number: "173/165",
    rarity: "AR",
    imageUrl: null,
    releaseDate: "2023-06-16",
  },
  {
    id: "sv2a-205",
    name: "ミュウex",
    nameEn: "Mew ex",
    setCode: "sv2a",
    setName: "ポケモンカード151",
    number: "205/165",
    rarity: "UR",
    imageUrl: null,
    releaseDate: "2023-06-16",
  },
];

/** カードごとの基準価格（円・架空） */
const BASE_PRICE: Record<string, number> = {
  "sv2a-201": 18000,
  "sv2a-173": 3500,
  "sv2a-205": 6800,
};

/** priceType ごとの基準価格に対する倍率（架空） */
const TYPE_RATIO: Record<PriceType, number> = {
  shop_sell: 1.0,
  shop_buy: 0.7,
  market_sold: 0.88,
  market_listing: 0.95,
  overseas: 0.82,
};

const round10 = (n: number) => Math.round(n / 10) * 10;

function summariesFor(cardId: string): PriceSummary[] {
  const base = BASE_PRICE[cardId] ?? 1000;
  return (Object.keys(TYPE_RATIO) as PriceType[]).map((priceType) => {
    const median = round10(base * TYPE_RATIO[priceType]);
    return {
      priceType,
      min: round10(median * 0.9),
      median,
      max: round10(median * 1.15),
      count: 12,
      change7d: 0.03,
      latestAt: AT,
    };
  });
}

function latestFor(cardId: string): PriceObservation[] {
  const base = BASE_PRICE[cardId] ?? 1000;
  const obs = (
    sourceId: string,
    priceType: PriceType,
    priceJpy: number,
    currency: "JPY" | "USD" = "JPY",
    price = priceJpy,
  ): PriceObservation => ({
    cardId,
    sourceId,
    priceType,
    price,
    currency,
    priceJpy,
    condition: "A",
    grading: null,
    url: null,
    observedAt: AT,
  });
  const overseasJpy = round10(base * TYPE_RATIO.overseas);
  return [
    obs("shop-a", "shop_sell", round10(base * 1.0)),
    obs("shop-a", "shop_buy", round10(base * 0.7)),
    obs("shop-b", "shop_sell", round10(base * 1.05)),
    obs("shop-b", "shop_buy", round10(base * 0.68)),
    obs("flea-a", "market_sold", round10(base * 0.88)),
    obs("flea-a", "market_listing", round10(base * 0.95)),
    // 1 USD = 150 JPY として換算（架空）。price はセント単位
    obs("overseas-a", "overseas", overseasJpy, "USD", Math.round((overseasJpy / 150) * 100)),
  ];
}

export function mockSearch(q?: string): CardSearchResponse {
  const needle = q?.trim().toLowerCase();
  const items = mockCards
    .filter(
      (c) =>
        !needle ||
        c.name.toLowerCase().includes(needle) ||
        (c.nameEn?.toLowerCase().includes(needle) ?? false),
    )
    .map((c) => ({ ...c, summaries: summariesFor(c.id) }));
  return { items, nextCursor: null };
}

/** カードの詳しい情報の仮データ（リザードンex だけ。値は実際のカードに合わせている） */
export const mockDetails: Record<string, CardDetails> = {
  "sv2a-201": {
    category: "ポケモン",
    hp: 330,
    types: ["炎"],
    stage: "2進化",
    evolveFrom: "リザード",
    illustrator: "miki kudo",
    regulationMark: "G",
    trainerType: null,
    effect: null,
    abilities: [],
    attacks: [
      {
        name: "ブレイブウイング",
        cost: ["炎"],
        damage: "60+",
        effect: "このポケモンにダメカンがのっているなら、100ダメージ追加。",
      },
      {
        name: "ばくえんのうず",
        cost: ["炎", "炎", "炎", "炎"],
        damage: "330",
        effect: "このポケモンについているエネルギーを3個選び、トラッシュする。",
      },
    ],
    weaknesses: [{ type: "水", value: "×2" }],
    resistances: [],
    retreat: 2,
  },
};

export function mockCardDetail(cardId: string): CardDetailResponse | null {
  const card = mockCards.find((c) => c.id === cardId);
  if (!card) return null;
  return {
    card,
    summaries: summariesFor(cardId),
    latest: latestFor(cardId),
    details: mockDetails[cardId] ?? null,
  };
}

/** 弾の一覧の仮データ */
export function mockSets(): SetsResponse {
  return {
    items: [{ setCode: "sv2a", setName: "ポケモンカード151", releaseDate: "2023-06-16", cardCount: mockCards.length }],
  };
}

/** 価格の観測（生データ）の仮データ：最新の観測を新しい順に返す */
export function mockObservations(cardId: string): CardObservationsResponse | null {
  if (!mockCards.some((c) => c.id === cardId)) return null;
  return { cardId, items: latestFor(cardId), nextCursor: null };
}

export function mockHistory(cardId: string, range: HistoryRange = "30d"): CardHistoryResponse {
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const base = BASE_PRICE[cardId] ?? 1000;
  const end = new Date(AT);
  const points: PriceHistoryPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    // ゆるやかな上昇 + 波（架空）
    const factor = 0.85 + 0.15 * ((days - i) / days) + 0.03 * Math.sin(i / 4);
    for (const priceType of ["shop_sell", "shop_buy", "market_sold"] as const) {
      const median = round10(base * TYPE_RATIO[priceType] * factor);
      points.push({ date, priceType, min: round10(median * 0.92), median, max: round10(median * 1.1) });
    }
  }
  return { cardId, range, points };
}

export const mockSourcesResponse: SourcesResponse = { items: mockSources };

/** 出品サポートの仮データ（計算は server と同じ suggestListing を使う） */
export function mockListingAssist(cardId: string, condition: CardCondition): ListingAssistResponse | null {
  const detail = mockCardDetail(cardId);
  return detail ? suggestListing(detail.card, detail.summaries, condition) : null;
}
