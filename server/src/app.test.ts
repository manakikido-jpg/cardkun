import { describe, expect, it } from "vitest";
import {
  CardDetailResponse,
  CardHistoryResponse,
  CardSearchResponse,
  ErrorResponse,
  HealthResponse,
  ListingAssistResponse,
  SourcesResponse,
} from "@cardkun/shared";
import { createApp } from "./app.js";

const app = createApp();
const get = (path: string) => app.request(path);

// API のレスポンスが shared の約束事どおりかを確認する
describe("API matches the shared contract", () => {
  it("GET /api/health", async () => {
    const res = await get("/api/health");
    expect(res.status).toBe(200);
    HealthResponse.parse(await res.json());
  });

  it("GET /api/cards", async () => {
    const res = await get("/api/cards?q=リザードン");
    expect(res.status).toBe(200);
    const body = CardSearchResponse.parse(await res.json());
    expect(body.items.map((c) => c.id)).toEqual(["sv2a-201"]);
  });

  it("GET /api/cards respects limit and rejects bad input", async () => {
    const ok = CardSearchResponse.parse(await (await get("/api/cards?limit=1")).json());
    expect(ok.items).toHaveLength(1);
    const bad = await get("/api/cards?limit=0");
    expect(bad.status).toBe(400);
    ErrorResponse.parse(await bad.json());
  });

  it("GET /api/cards/:id", async () => {
    const res = await get("/api/cards/sv2a-201");
    expect(res.status).toBe(200);
    CardDetailResponse.parse(await res.json());
    expect((await get("/api/cards/nope")).status).toBe(404);
  });

  it("GET /api/cards/:id/history", async () => {
    const res = await get("/api/cards/sv2a-201/history?range=90d");
    expect(res.status).toBe(200);
    const body = CardHistoryResponse.parse(await res.json());
    expect(body.range).toBe("90d");
    expect((await get("/api/cards/sv2a-201/history?range=5y")).status).toBe(400);
  });

  it("GET /api/sources", async () => {
    SourcesResponse.parse(await (await get("/api/sources")).json());
  });

  it("POST /api/listing-assist", async () => {
    const res = await app.request("/api/listing-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: "sv2a-201", condition: "B" }),
    });
    expect(res.status).toBe(200);
    const body = ListingAssistResponse.parse(await res.json());
    expect(body.suggestedPrice).toBeGreaterThan(0);
    expect(body.priceRange.low).toBeLessThanOrEqual(body.suggestedPrice);
    expect(body.priceRange.high).toBeGreaterThanOrEqual(body.suggestedPrice);
  });
});
