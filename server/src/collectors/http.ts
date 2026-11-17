/**
 * 取得先サイトに負荷をかけないための HTTP クライアント。
 * - 同じホストへのリクエストは minIntervalMs 以上あける
 * - robots.txt を確認し、禁止されたパスにはアクセスしない
 * - タイムアウトと、5xx・通信エラー時の 1 回だけの再試行
 */

export const USER_AGENT = "cardkun-bot/0.1";

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

interface RobotsRules {
  allow: string[];
  disallow: string[];
}

/**
 * robots.txt から、指定した User-Agent に適用されるルールを取り出す。
 * 自分の名前のグループがあればそれを、なければ "*" のグループを使う。
 */
export function parseRobots(text: string, userAgent: string): RobotsRules {
  const groups: { agents: string[]; rules: RobotsRules }[] = [];
  let current: { agents: string[]; rules: RobotsRules } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: { allow: [], disallow: [] } };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!current) continue;
      if (key === "allow" && value) current.rules.allow.push(value);
      if (key === "disallow" && value) current.rules.disallow.push(value);
    }
  }

  const name = userAgent.split("/")[0]!.toLowerCase();
  const own = groups.find((g) => g.agents.some((a) => a !== "*" && name.includes(a)));
  const star = groups.find((g) => g.agents.includes("*"));
  return (own ?? star)?.rules ?? { allow: [], disallow: [] };
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** パスが許可されているか。最も長く一致したルールを優先し、同じ長さなら Allow を優先する */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  let best: { len: number; allow: boolean } | null = null;
  for (const [list, allow] of [
    [rules.allow, true],
    [rules.disallow, false],
  ] as const) {
    for (const p of list) {
      if (patternToRegExp(p).test(path)) {
        if (!best || p.length > best.len || (p.length === best.len && allow)) best = { len: p.length, allow };
      }
    }
  }
  return best ? best.allow : true;
}

export interface PoliteFetcherOptions {
  minIntervalMs?: number;
  timeoutMs?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export class PoliteFetcher {
  private readonly minIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly lastRequestAt = new Map<string, number>();
  private readonly robotsCache = new Map<string, Promise<RobotsRules>>();
  private readonly hostQueue = new Map<string, Promise<unknown>>();

  constructor(opts: PoliteFetcherOptions = {}) {
    this.minIntervalMs = opts.minIntervalMs ?? 3000;
    this.timeoutMs = opts.timeoutMs ?? 15000;
    this.userAgent = opts.userAgent ?? USER_AGENT;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? Date.now;
  }

  /** 同じホストへのリクエストを 1 本ずつ、間隔をあけて実行する */
  private schedule<T>(host: string, task: () => Promise<T>): Promise<T> {
    const prev = this.hostQueue.get(host) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(async () => {
      const last = this.lastRequestAt.get(host);
      if (last !== undefined) {
        const wait = last + this.minIntervalMs - this.now();
        if (wait > 0) await this.sleep(wait);
      }
      try {
        return await task();
      } finally {
        this.lastRequestAt.set(host, this.now());
      }
    });
    this.hostQueue.set(host, run);
    return run;
  }

  private async rawFetch(url: string, init?: RequestInit): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const headers = new Headers(init?.headers);
      headers.set("User-Agent", this.userAgent);
      return await this.fetchImpl(url, { ...init, headers, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private robotsFor(origin: string, host: string): Promise<RobotsRules> {
    let p = this.robotsCache.get(origin);
    if (!p) {
      p = this.schedule(host, async () => {
        try {
          const res = await this.rawFetch(`${origin}/robots.txt`);
          // 404 などで robots.txt が無ければ制限なし。5xx は安全側に倒して全面禁止
          if (res.status >= 500) return { allow: [], disallow: ["/"] };
          if (!res.ok) return { allow: [], disallow: [] };
          return parseRobots(await res.text(), this.userAgent);
        } catch {
          return { allow: [], disallow: ["/"] };
        }
      });
      this.robotsCache.set(origin, p);
    }
    return p;
  }

  /** robots.txt を確認したうえで取得する。禁止されていれば RobotsDisallowedError */
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    const u = new URL(url);
    const rules = await this.robotsFor(u.origin, u.host);
    if (!isAllowed(rules, u.pathname + u.search)) throw new RobotsDisallowedError(url);

    const attempt = () => this.schedule(u.host, () => this.rawFetch(url, init));
    try {
      const res = await attempt();
      if (res.status >= 500) return await attempt();
      return res;
    } catch (e) {
      if (e instanceof RobotsDisallowedError) throw e;
      return attempt();
    }
  }
}
