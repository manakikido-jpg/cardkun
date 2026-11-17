import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CardDetailResponse,
  CardHistoryResponse,
  CardSearchResponse,
  ListingAssistResponse,
  SourcesResponse,
} from "@cardkun/shared";
import {
  ApiError,
  getCard,
  getHistory,
  getListingAssist,
  getSources,
  searchCards,
} from "./api";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("mock データ層", () => {
  it("検索・詳細・取得元を shared の契約で返す", async () => {
    vi.stubEnv("API_BASE_URL", "");
    expect(CardSearchResponse.parse(await searchCards()).items).toHaveLength(3);
    expect((await searchCards({ q: "ぴかちゅう" })).items[0]?.id).toBe(
      "sv2a-173",
    );
    expect(
      (await searchCards({ q: "CHARIZARD", rarity: "SAR", set: "sv2a" })).items,
    ).toHaveLength(1);
    expect((await searchCards({ rarity: "AR", set: "other" })).items).toEqual(
      [],
    );
    expect(
      CardDetailResponse.parse(await getCard("sv2a-201")).latest.length,
    ).toBeGreaterThan(0);
    expect(await getCard("missing")).toBeNull();
    expect(
      SourcesResponse.parse(await getSources()).items.length,
    ).toBeGreaterThan(0);
  });
  it.each([
    ["30d", 30],
    ["90d", 90],
    ["1y", 365],
  ] as const)("期間 %s の推移を返す", async (range, days) => {
    vi.stubEnv("API_BASE_URL", "");
    const history = CardHistoryResponse.parse(
      await getHistory("sv2a-201", range),
    );
    expect(new Set(history.points.map((p) => p.date)).size).toBe(days);
    expect(history.range).toBe(range);
  });
  it("状態別の仮の出品提案とページ送りを返す", async () => {
    vi.stubEnv("API_BASE_URL", "");
    const a = ListingAssistResponse.parse(
      await getListingAssist({ cardId: "sv2a-201", condition: "A" }),
    );
    const d = await getListingAssist({ cardId: "sv2a-201", condition: "D" });
    expect(d.suggestedPrice).toBeLessThan(a.suggestedPrice);
    expect(a.description).toContain("リザードンex");
    const first = await searchCards({ limit: 1 });
    expect(first.nextCursor).toBe(first.items[0]?.id);
    expect(
      (await searchCards({ limit: 1, cursor: first.nextCursor! })).items[0]?.id,
    ).not.toBe(first.items[0]?.id);
    await expect(
      getListingAssist({ cardId: "missing", condition: "A" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
describe("実 API", () => {
  it("API パス・クエリ・キャッシュを設定する", async () => {
    vi.stubEnv("API_BASE_URL", "https://api.example.test");
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ items: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetcher);
    await searchCards({ q: "ミュウ" });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain("https://api.example.test/api/cards?");
    expect(new URL(String(url)).searchParams.get("q")).toBe("ミュウ");
    expect(init.next.revalidate).toBe(300);
  });
  it("不正レスポンスと API エラーを隠さず返す", async () => {
    vi.stubEnv("API_BASE_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ items: "invalid" })),
    );
    await expect(searchCards()).rejects.toThrow();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );
    await expect(getCard("sv2a-201")).rejects.toBeInstanceOf(ApiError);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
    expect(await getCard("missing")).toBeNull();
  });
  it("出品サポートを POST し、キャッシュしない", async () => {
    vi.stubEnv("API_BASE_URL", "");
    const result = await getListingAssist({
      cardId: "sv2a-201",
      condition: "B",
    });
    vi.stubEnv("API_BASE_URL", "https://api.example.test");
    const fetcher = vi.fn().mockResolvedValue(Response.json(result));
    vi.stubGlobal("fetch", fetcher);
    expect(
      await getListingAssist({ cardId: "sv2a-201", condition: "B" }),
    ).toEqual(result);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      cache: "no-store",
      body: JSON.stringify({ cardId: "sv2a-201", condition: "B" }),
    });
  });
});
