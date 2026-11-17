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
