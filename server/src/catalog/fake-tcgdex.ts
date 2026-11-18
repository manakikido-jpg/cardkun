/**
 * テスト用の偽 TCGdex。
 * 値は TCGdex のデータ（github.com/tcgdex/cards-database、data-asia/SV/SV2a、MIT）の実データから抜粋。
 * レスポンスの形は TCGdex API v2 に合わせている。
 */

const IMG = "https://assets.tcgdex.net/ja/SV/SV2a";

const SET_SV2A = {
  id: "SV2a",
  name: "ポケモンカード151",
  releaseDate: "2023-06-16",
  serie: { id: "SV", name: "ポケモンカードゲーム スカーレット&バイオレット" },
  cardCount: { official: 165, total: 210 },
  logo: `${IMG}/logo`,
};

const CARDS: Record<string, { name: string; rarity: string; eur?: number; extra?: Record<string, unknown> }> = {
  "001": {
    name: "フシギダネ",
    rarity: "Common",
    extra: { category: "Pokemon", illustrator: "Yuu Nishida", hp: 70, types: ["Grass"], stage: "Basic", retreat: 2, regulationMark: "G", weaknesses: [{ type: "Fire", value: "x2" }] },
  },
  "165": {
    name: "サイクリングロード",
    rarity: "Uncommon",
    extra: {
      category: "Trainer",
      illustrator: "Oswaldo KATO",
      trainerType: "Stadium",
      effect: "おたがいのプレイヤーは、自分の番ごとに1回、自分の手札から基本エネルギーを1枚トラッシュするなら、自分の山札を1枚引いてよい。",
    },
  },
  "173": { name: "ピカチュウ", rarity: "Illustration rare", eur: 21.5 },
  "201": {
    name: "リザードンex",
    rarity: "Special illustration rare",
    eur: 89.99,
    extra: {
      category: "Pokemon",
      illustrator: "miki kudo",
      hp: 330,
      types: ["Fire"],
      stage: "Stage2",
      evolveFrom: "リザード",
      suffix: "EX",
      attacks: [
        { name: "ブレイブウイング", damage: "60+", cost: ["Fire"], effect: "このポケモンにダメカンがのっているなら、100ダメージ追加。" },
        { name: "ばくえんのうず", damage: 330, cost: ["Fire", "Fire", "Fire", "Fire"], effect: "このポケモンについているエネルギーを3個選び、トラッシュする。" },
      ],
      weaknesses: [{ type: "Water", value: "x2" }],
      retreat: 2,
      regulationMark: "G",
    },
  },
  "208": { name: "ミュウex", rarity: "Mega Hyper Rare", eur: 40 },
};

export const FAKE_PRICING_UPDATED = "2026-11-16T22:00:00.000Z";

function cardDetail(localId: string) {
  const c = CARDS[localId]!;
  return {
    category: "Pokemon",
    ...c.extra,
    id: `SV2a-${localId}`,
    localId,
    name: c.name,
    image: `${IMG}/${localId}`,
    rarity: c.rarity,
    set: { id: "SV2a", name: SET_SV2A.name, cardCount: SET_SV2A.cardCount },
    variants: { holo: true },
    pricing: {
      cardmarket: c.eur
        ? { updated: FAKE_PRICING_UPDATED, unit: "EUR", avg: c.eur * 1.05, low: c.eur * 0.8, trend: c.eur, avg7: c.eur }
        : null,
      tcgplayer: null,
    },
  };
}

export const FAKE_ROUTES: Record<string, unknown> = {
  "/series/SV": { id: "SV", name: SET_SV2A.serie.name, sets: [{ id: "SV2a", name: SET_SV2A.name, cardCount: SET_SV2A.cardCount }] },
  "/series/M": { id: "M", name: "MEGA", sets: [] },
  "/sets/SV2a": {
    ...SET_SV2A,
    cards: Object.entries(CARDS).map(([localId, c]) => ({
      id: `SV2a-${localId}`,
      localId,
      name: c.name,
      image: `${IMG}/${localId}`,
    })),
  },
  ...Object.fromEntries(Object.keys(CARDS).map((id) => [`/cards/SV2a-${id}`, cardDetail(id)])),
};

/** FAKE_ROUTES を返す fetch。呼ばれたパスを calls に記録する */
export function fakeTcgdexFetch(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const routes = { ...FAKE_ROUTES, ...overrides };
  const impl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname === "/robots.txt") return new Response("", { status: 404 });
    const path = url.pathname.replace(/^\/v2\/ja/, "");
    calls.push(path);
    const body = routes[path];
    if (body === undefined) return new Response("not found", { status: 404 });
    if (body instanceof Error) throw body;
    return Response.json(body);
  }) as typeof fetch;
  return { impl, calls };
}
