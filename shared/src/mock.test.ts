import { describe, expect, it } from "vitest";
import {
  CardDetailResponse,
  CardHistoryResponse,
  CardSearchResponse,
  SourcesResponse,
} from "./api.js";
import * as mock from "./mock.js";

// 仮データが約束事（スキーマ）どおりの形になっているかを確認する
describe("mock data matches the shared schemas", () => {
  it("search", () => {
    const res = mock.mockSearch();
    expect(() => CardSearchResponse.parse(res)).not.toThrow();
    expect(res.items.length).toBe(mock.mockCards.length);
  });

  it("search filters by Japanese and English name", () => {
    expect(mock.mockSearch("リザードン").items.map((c) => c.id)).toEqual(["sv2a-201"]);
    expect(mock.mockSearch("pikachu").items.map((c) => c.id)).toEqual(["sv2a-173"]);
  });

  it("card detail", () => {
    const res = mock.mockCardDetail("sv2a-201");
    expect(() => CardDetailResponse.parse(res)).not.toThrow();
    expect(mock.mockCardDetail("nope")).toBeNull();
  });

  it("history", () => {
    for (const range of ["30d", "90d", "1y"] as const) {
      expect(() => CardHistoryResponse.parse(mock.mockHistory("sv2a-201", range))).not.toThrow();
    }
  });

  it("sources", () => {
    expect(() => SourcesResponse.parse(mock.mockSourcesResponse)).not.toThrow();
  });
});

describe("suggestListing (shared by server and mock)", () => {
  it("applies the condition ratio and returns a valid response", async () => {
    const { ListingAssistResponse } = await import("./api.js");
    const a = ListingAssistResponse.parse(mock.mockListingAssist("sv2a-201", "A"));
    const d = ListingAssistResponse.parse(mock.mockListingAssist("sv2a-201", "D"));
    expect(d.suggestedPrice).toBe(Math.round((a.suggestedPrice * 0.5) / 10) * 10);
    expect(mock.mockListingAssist("nope", "A")).toBeNull();
  });
});
