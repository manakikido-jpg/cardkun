import {
  API_PATHS,
  CardSearchQuery,
  CardSearchResponse,
  CardDetailResponse,
  CardHistoryResponse,
  SourcesResponse,
  ListingAssistRequest,
  ListingAssistResponse,
  mock,
  type HistoryRange,
} from "@cardkun/shared";
import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message = "データを取得できませんでした。時間をおいてお試しください。",
  ) {
    super(message);
  }
}
async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const base = process.env.API_BASE_URL;
  if (!base) throw new Error("API_BASE_URL が未設定です");
  const response = await fetch(new URL(path, base), {
    ...init,
    signal: AbortSignal.timeout(10000),
    ...(init?.method === "POST"
      ? { cache: "no-store" as const }
      : { next: { revalidate: 300 } }),
  });
  if (!response.ok) throw new ApiError(response.status);
  return schema.parse(await response.json());
}
const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
export async function searchCards(input: Partial<CardSearchQuery> = {}) {
  const query = CardSearchQuery.parse(input);
  if (process.env.API_BASE_URL) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    return request(`${API_PATHS.cards}?${params}`, CardSearchResponse);
  }
  const all = mock
    .mockSearch()
    .items.filter(
      (c) =>
        (!query.q ||
          normalize(`${c.name} ${c.nameEn ?? ""}`).includes(
            normalize(query.q),
          )) &&
        (!query.set || c.setCode === query.set) &&
        (!query.rarity || c.rarity === query.rarity),
    );
  const start = query.cursor
    ? all.findIndex((c) => c.id === query.cursor) + 1
    : 0;
  const items = all.slice(start, start + query.limit);
  return CardSearchResponse.parse({
    items,
    nextCursor: start + query.limit < all.length ? items.at(-1)?.id : null,
  });
}
export async function getCard(id: string) {
  if (process.env.API_BASE_URL) {
    try {
      return await request(API_PATHS.card(id), CardDetailResponse);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }
  const data = mock.mockCardDetail(id);
  return data ? CardDetailResponse.parse(data) : null;
}
export async function getHistory(id: string, range: HistoryRange = "30d") {
  return process.env.API_BASE_URL
    ? request(
        `${API_PATHS.cardHistory(id)}?range=${range}`,
        CardHistoryResponse,
      )
    : CardHistoryResponse.parse(mock.mockHistory(id, range));
}
export async function getSources() {
  return process.env.API_BASE_URL
    ? request(API_PATHS.sources, SourcesResponse)
    : SourcesResponse.parse(mock.mockSourcesResponse);
}
export async function getListingAssist(input: ListingAssistRequest) {
  const body = ListingAssistRequest.parse(input);
  if (process.env.API_BASE_URL)
    return request(API_PATHS.listingAssist, ListingAssistResponse, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const detail = mock.mockCardDetail(body.cardId);
  if (!detail) throw new ApiError(404);
  const median = detail.summaries.find(
    (s) => s.priceType === "market_sold",
  )?.median;
  if (median === undefined) throw new ApiError(500);
  const ratio = { A: 1, B: 0.85, C: 0.65, D: 0.4, unknown: 0.65 }[
    body.condition
  ];
  const suggestedPrice = Math.round((median * ratio) / 10) * 10;
  return ListingAssistResponse.parse({
    cardId: body.cardId,
    suggestedPrice,
    priceRange: {
      low: Math.round(suggestedPrice * 0.9),
      high: Math.round(suggestedPrice * 1.1),
    },
    description: `${detail.card.name}（${detail.card.setName} ${detail.card.number}）\n状態：${body.condition}\n傷や白欠けなどの詳細は写真でご確認ください。状態の説明と発送方法を追記してから出品してください。`,
    basis:
      "仮のフリマ成約中央値に状態別の係数を掛けた参考価格です。実際の相場・査定価格ではありません。",
  });
}
