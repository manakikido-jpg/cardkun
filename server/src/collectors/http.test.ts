import { describe, expect, it } from "vitest";
import { PoliteFetcher, RobotsDisallowedError, isAllowed, parseRobots } from "./http.js";

const ROBOTS = `
User-agent: *
Disallow: /cart
Disallow: /search
Allow: /search/public

User-agent: cardkun-bot
User-agent: other-bot
Disallow: /private
Disallow: /*.pdf$
`;

describe("robots.txt", () => {
  it("uses the group for our bot when present", () => {
    const rules = parseRobots(ROBOTS, "cardkun-bot/0.1");
    expect(isAllowed(rules, "/cart")).toBe(true); // * のルールは適用されない
    expect(isAllowed(rules, "/private/x")).toBe(false);
    expect(isAllowed(rules, "/files/a.pdf")).toBe(false);
    expect(isAllowed(rules, "/files/a.pdf?x=1")).toBe(true);
  });

  it("falls back to * and prefers the longest match", () => {
    const rules = parseRobots(ROBOTS, "someone-else/1.0");
    expect(isAllowed(rules, "/cart")).toBe(false);
    expect(isAllowed(rules, "/search?q=1")).toBe(false);
    expect(isAllowed(rules, "/search/public/1")).toBe(true);
    expect(isAllowed(rules, "/cards/1")).toBe(true);
  });
});

function fakeFetch(routes: Record<string, { status: number; body?: string }>) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const r = routes[url] ?? { status: 404 };
    return new Response(r.body ?? "", { status: r.status });
  }) as typeof fetch;
  return { impl, calls };
}

describe("PoliteFetcher", () => {
  it("blocks paths disallowed by robots.txt", async () => {
    const { impl, calls } = fakeFetch({
      "https://shop.example/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /secret" },
    });
    const f = new PoliteFetcher({ fetchImpl: impl, sleep: async () => undefined });
    await expect(f.fetch("https://shop.example/secret/1")).rejects.toBeInstanceOf(RobotsDisallowedError);
    expect(calls).toEqual(["https://shop.example/robots.txt"]);
  });

  it("waits between requests to the same host", async () => {
    const { impl } = fakeFetch({ "https://shop.example/a": { status: 200 }, "https://shop.example/b": { status: 200 } });
    let clock = 0;
    const waits: number[] = [];
    const f = new PoliteFetcher({
      fetchImpl: impl,
      minIntervalMs: 3000,
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    });
    await Promise.all([f.fetch("https://shop.example/a"), f.fetch("https://shop.example/b")]);
    // robots.txt → a → b の 3 回。2 回目以降は 3 秒ずつ待つ
    expect(waits).toEqual([3000, 3000]);
  });

  it("treats a 5xx robots.txt as disallow-all", async () => {
    const { impl } = fakeFetch({ "https://down.example/robots.txt": { status: 503 } });
    const f = new PoliteFetcher({ fetchImpl: impl, sleep: async () => undefined });
    await expect(f.fetch("https://down.example/x")).rejects.toBeInstanceOf(RobotsDisallowedError);
  });
});

describe("PoliteFetcher robots.txt exemption", () => {
  // TCGdex の実際の robots.txt（github.com/tcgdex/cards-database の server/public/robots.txt）
  const TCGDEX_ROBOTS =
    "User-agent: *\nDisallow: /\n\n# Please note that this is for Crawlers only\n# You can logically use robots to use the API\n";
  const routes = {
    "https://api.tcgdex.net/robots.txt": { status: 200, body: TCGDEX_ROBOTS },
    "https://api.tcgdex.net/v2/ja/series/SV": { status: 200, body: "{}" },
  };

  it("blocks by default, even for an API host", async () => {
    const { impl } = fakeFetch(routes);
    const f = new PoliteFetcher({ fetchImpl: impl, sleep: async () => undefined });
    await expect(f.fetch("https://api.tcgdex.net/v2/ja/series/SV")).rejects.toThrow("robots.txt disallows");
  });

  it("skips robots.txt only when a reason is given", async () => {
    const { impl, calls } = fakeFetch(routes);
    const f = new PoliteFetcher({
      fetchImpl: impl,
      sleep: async () => undefined,
      ignoreRobotsTxt: { reason: "API use explicitly allowed" },
    });
    expect((await f.fetch("https://api.tcgdex.net/v2/ja/series/SV")).status).toBe(200);
    expect(calls).toEqual(["https://api.tcgdex.net/v2/ja/series/SV"]);
  });

  it("says when robots.txt could not be read (instead of 'disallows')", async () => {
    const impl = (async () => {
      throw new Error("ECONNRESET");
    }) as typeof fetch;
    const f = new PoliteFetcher({ fetchImpl: impl, sleep: async () => undefined });
    await expect(f.fetch("https://x.example/a")).rejects.toThrow(/確認できないため中止.*ECONNRESET/);
  });
});
