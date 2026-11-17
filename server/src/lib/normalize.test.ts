import { describe, expect, it } from "vitest";
import { buildSearchText, escapeLike, makeCardId, normalizeForSearch } from "./normalize.js";

describe("normalizeForSearch", () => {
  it("katakana → hiragana, full-width → half-width, lowercase, no spaces", () => {
    expect(normalizeForSearch("リザードン ＥＸ")).toBe("りざーどんex");
    expect(normalizeForSearch("ﾋﾟｶﾁｭｳ")).toBe("ぴかちゅう");
    expect(normalizeForSearch("Charizard ex")).toBe("charizardex");
  });

  it("buildSearchText joins normalized fields", () => {
    expect(
      buildSearchText({
        name: "ミュウex",
        nameEn: "Mew ex",
        setCode: "sv2a",
        setName: "ポケモンカード151",
        number: "205/165",
        rarity: "UR",
      }),
    ).toBe("みゅうex|mewex|ぽけもんかーど151|sv2a|205/165|ur");
  });
});

describe("escapeLike", () => {
  it("escapes wildcards", () => {
    expect(escapeLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });
});

describe("makeCardId", () => {
  it("pads the number and lowercases the set code", () => {
    expect(makeCardId("sv2a", "201/165")).toBe("sv2a-201");
    expect(makeCardId("SV2a", "1/165")).toBe("sv2a-001");
    expect(makeCardId("svp", "SV-P")).toBe("svp-sv-p");
  });
});
