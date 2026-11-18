import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import type { DbHandle } from "../db/client.js";
import { cards } from "../db/schema.js";
import { PoliteFetcher } from "../collectors/http.js";
import { TcgdexClient } from "../catalog/tcgdex.js";
import { rarityToJa } from "../catalog/rarity.js";
import { fakeTcgdexFetch } from "../catalog/fake-tcgdex.js";
import { searchCards } from "../repo/cards.js";
import { createTestDb } from "../test-helpers.js";
import { importCatalog } from "./import-catalog.js";
import { upsertCards } from "./cards.js";

const client = (impl: typeof fetch) =>
  new TcgdexClient(new PoliteFetcher({ fetchImpl: impl, minIntervalMs: 0, sleep: async () => undefined }));
const quiet = { log: () => undefined };

let h: DbHandle;
beforeAll(async () => {
  h = await createTestDb();
});
afterAll(() => h.close());

describe("rarityToJa", () => {
  it("maps TCGdex rarities to the labels printed on Japanese cards", () => {
    expect(rarityToJa("Special illustration rare", "SV")).toBe("SAR");
    expect(rarityToJa("Illustration rare", "SV")).toBe("AR");
    expect(rarityToJa("Double rare", "SV")).toBe("RR");
    expect(rarityToJa("Ultra Rare", "SV")).toBe("SR");
    // SV 期の金色カードは UR、メガ期は MUR
    expect(rarityToJa("Mega Hyper Rare", "SV")).toBe("UR");
    expect(rarityToJa("Mega Hyper Rare", "M")).toBe("MUR");
    expect(rarityToJa("Something New", "SV")).toBe("Something New");
    expect(rarityToJa(undefined, "SV")).toBe("-");
  });
});

describe("importCatalog", () => {
  it("imports cards with Japanese rarity, printed number and image", async () => {
    const { impl } = fakeTcgdexFetch();
    const report = await importCatalog(h.db, client(impl), quiet);
    expect(report).toMatchObject({ setsSeen: 1, setsImported: 1, cardsUpserted: 5, errors: [] });

    const rows = await h.db.select().from(cards).orderBy(asc(cards.id));
    expect(rows.map((r) => [r.id, r.rarity, r.number])).toEqual([
      ["sv2a-001", "C", "001/165"],
      ["sv2a-165", "U", "165/165"],
      ["sv2a-173", "AR", "173/165"],
      ["sv2a-201", "SAR", "201/165"],
      ["sv2a-208", "UR", "208/165"],
    ]);
    expect(rows[3]).toMatchObject({
      name: "リザードンex",
      setCode: "sv2a",
      setName: "ポケモンカード151",
      releaseDate: "2023-06-16",
      imageUrl: "https://assets.tcgdex.net/ja/SV/SV2a/201/low.webp",
    });
  });

  it("imported cards are searchable (hiragana, set name, rarity)", async () => {
    const q = (query: string) =>
      searchCards(h.db, { q: query, limit: 20 }).then((r) => r.items.map((c) => c.id));
    expect(await q("りざーどん")).toEqual(["sv2a-201"]);
    expect(await q("SAR")).toEqual(["sv2a-201"]);
    expect((await q("151")).length).toBe(5);
  });

  it("skips sets that are already imported, unless full", async () => {
    const first = fakeTcgdexFetch();
    await importCatalog(h.db, client(first.impl), quiet);
    expect(first.calls.filter((p) => p.startsWith("/cards/"))).toEqual([]);

    const full = fakeTcgdexFetch();
    await importCatalog(h.db, client(full.impl), { ...quiet, full: true });
    expect(full.calls.filter((p) => p.startsWith("/cards/"))).toHaveLength(5);
  });

  it("records per-card failures without stopping the set", async () => {
    const h2 = await createTestDb();
    const { impl } = fakeTcgdexFetch({ "/cards/SV2a-173": { broken: true } });
    const report = await importCatalog(h2.db, client(impl), quiet);
    expect(report.cardsUpserted).toBe(4);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("SV2a-173");
    await h2.close();
  });
});

describe("importCatalog resume", () => {
  it("re-run fetches only the cards that failed last time", async () => {
    const h3 = await createTestDb();
    const failing = fakeTcgdexFetch({ "/cards/SV2a-201": { broken: true } });
    await importCatalog(h3.db, client(failing.impl), quiet);

    const retry = fakeTcgdexFetch();
    const report = await importCatalog(h3.db, client(retry.impl), quiet);
    expect(retry.calls.filter((p) => p.startsWith("/cards/"))).toEqual(["/cards/SV2a-201"]);
    expect(report).toMatchObject({ cardsUpserted: 1, errors: [] });
    expect((await h3.db.select().from(cards)).length).toBe(5);
    await h3.close();
  });
});

describe("card details", () => {
  it("stores details translated to Japanese", async () => {
    const h4 = await createTestDb();
    await importCatalog(h4.db, client(fakeTcgdexFetch().impl), quiet);
    const byId = Object.fromEntries((await h4.db.select().from(cards)).map((r) => [r.id, r.details]));

    expect(byId["sv2a-201"]).toEqual({
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
        { name: "ブレイブウイング", cost: ["炎"], damage: "60+", effect: "このポケモンにダメカンがのっているなら、100ダメージ追加。" },
        { name: "ばくえんのうず", cost: ["炎", "炎", "炎", "炎"], damage: "330", effect: "このポケモンについているエネルギーを3個選び、トラッシュする。" },
      ],
      weaknesses: [{ type: "水", value: "×2" }],
      resistances: [],
      retreat: 2,
    });
    expect(byId["sv2a-165"]).toMatchObject({ category: "トレーナーズ", trainerType: "スタジアム", hp: null, types: [] });
    expect(byId["sv2a-001"]).toMatchObject({ stage: "たね", types: ["草"] });
    await h4.close();
  });

  it("backfills details for cards imported before details existed", async () => {
    const h5 = await createTestDb();
    await importCatalog(h5.db, client(fakeTcgdexFetch().impl), quiet);
    // 詳しい情報がない状態（以前の取り込み）を再現する
    await h5.db.update(cards).set({ details: null });

    const again = fakeTcgdexFetch();
    const report = await importCatalog(h5.db, client(again.impl), quiet);
    expect(again.calls.filter((p) => p.startsWith("/cards/"))).toHaveLength(5);
    expect(report.errors).toEqual([]);
    const rows = await h5.db.select().from(cards);
    expect(rows.every((r) => r.details !== null)).toBe(true);
    await h5.close();
  });

  it("keeps stored details when a card is upserted without details", async () => {
    const h6 = await createTestDb();
    await importCatalog(h6.db, client(fakeTcgdexFetch().impl), quiet);
    const [row] = await h6.db.select().from(cards).where(eq(cards.id, "sv2a-201"));
    const { details: _d, searchText: _s, ...card } = row!;
    await upsertCards(h6.db, [card]);
    const [after] = await h6.db.select().from(cards).where(eq(cards.id, "sv2a-201"));
    expect(after!.details?.hp).toBe(330);
    await h6.close();
  });
});
