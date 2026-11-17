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

const CARDS: Record<string, { name: string; rarity: string; eur?: number }> = {
  "001": { name: "フシギダネ", rarity: "Common" },
  "173": { name: "ピカチュウ", rarity: "Illustration rare", eur: 21.5 },
  "201": { name: "リザードンex", rarity: "Special illustration rare", eur: 89.99 },
  "208": { name: "ミュウex", rarity: "Mega Hyper Rare", eur: 40 },
};

export const FAKE_PRICING_UPDATED = "2026-11-16T22:00:00.000Z";

function cardDetail(localId: string) {
  const c = CARDS[localId]!;
  return {
    category: "Pokemon",
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
