import { desc } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { cards, fxRates, priceObservations, sources } from "../db/schema.js";
import { jstDate, recomputeDaily, recomputeSummaries } from "../aggregate/summaries.js";
import { makeCardId } from "../lib/normalize.js";
import { PoliteFetcher } from "../collectors/http.js";
import type { Collector, RawObservation } from "../collectors/types.js";

/**
 * 収集ジョブ：Collector を順に実行 → 観測を保存 → 集計を作り直す。
 * 1 つの Collector が失敗しても、ほかの Collector は続けて実行する。
 */

export interface CollectorReport {
  sourceId: string;
  inserted: number;
  /** DB に存在しないカード（カード名鑑の追加が必要） */
  unmatched: number;
  /** 為替レートがなく円換算できなかった件数 */
  noFxRate: number;
  /** 保存済み（externalId が同じ）のため飛ばした件数 */
  duplicates: number;
  error: string | null;
}

const BATCH = 500;

/** 通貨ごとの最新の為替レート（1 単位あたりの円） */
async function latestFxRates(db: Db): Promise<Map<string, number>> {
  const rows = await db.select().from(fxRates).orderBy(desc(fxRates.date));
  const map = new Map<string, number>([["JPY", 1]]);
  for (const r of rows) if (!map.has(r.currency)) map.set(r.currency, r.rateJpy);
  return map;
}

/** 金額を円に換算する。JPY は円、それ以外はセント単位の整数 */
export function toJpy(price: number, currency: string, rates: Map<string, number>): number | null {
  if (currency === "JPY") return price;
  const rate = rates.get(currency);
  if (rate === undefined) return null;
  return Math.round((price / 100) * rate);
}

function resolveCardId(card: RawObservation["card"]): string {
  return "cardId" in card ? card.cardId : makeCardId(card.setCode, card.number);
}

export async function runCollect(
  db: Db,
  collectorList: Collector[],
  opts: {
    now?: Date;
    fetcher?: PoliteFetcher;
    log?: (msg: string) => void;
    /** true なら今回観測のなかったカードも含め、全カードの集計を作り直す（古い相場が残らないように） */
    refreshAllSummaries?: boolean;
  } = {},
): Promise<CollectorReport[]> {
  const now = opts.now ?? new Date();
  const log = opts.log ?? ((m) => console.log(m));
  const fetcher = opts.fetcher ?? new PoliteFetcher();

  const knownCards = new Set((await db.select({ id: cards.id }).from(cards)).map((r) => r.id));
  const rates = await latestFxRates(db);
  const touchedCards = new Set<string>();
  const touchedDates = new Set<string>();
  const reports: CollectorReport[] = [];

  for (const collector of collectorList) {
    const { source } = collector;
    const report: CollectorReport = {
      sourceId: source.id,
      inserted: 0,
      unmatched: 0,
      noFxRate: 0,
      duplicates: 0,
      error: null,
    };
    reports.push(report);

    await db
      .insert(sources)
      .values({ ...source })
      .onConflictDoUpdate({
        target: sources.id,
        set: { name: source.name, kind: source.kind, region: source.region, currency: source.currency, url: source.url },
      });

    let buffer: (typeof priceObservations.$inferInsert)[] = [];
    const flush = async () => {
      if (buffer.length === 0) return;
      const inserted = await db
        .insert(priceObservations)
        .values(buffer)
        .onConflictDoNothing()
        .returning({ id: priceObservations.id });
      report.inserted += inserted.length;
      report.duplicates += buffer.length - inserted.length;
      buffer = [];
    };

    try {
      for await (const obs of collector.collect({ fetcher, now, log })) {
        const cardId = resolveCardId(obs.card);
        if (!knownCards.has(cardId)) {
          report.unmatched++;
          continue;
        }
        const priceJpy = toJpy(obs.price, obs.currency, rates);
        if (priceJpy === null) {
          report.noFxRate++;
          continue;
        }
        buffer.push({
          cardId,
          sourceId: source.id,
          priceType: obs.priceType,
          price: obs.price,
          currency: obs.currency,
          priceJpy,
          condition: obs.condition,
          gradingCompany: obs.grading?.company ?? null,
          gradingGrade: obs.grading?.grade ?? null,
          url: obs.url ?? null,
          observedAt: obs.observedAt,
          externalId: obs.externalId ?? null,
        });
        touchedCards.add(cardId);
        touchedDates.add(jstDate(obs.observedAt));
        if (buffer.length >= BATCH) await flush();
      }
      await flush();
    } catch (e) {
      // 途中までに保存した分は残す
      await flush().catch(() => undefined);
      report.error = e instanceof Error ? e.message : String(e);
    }
    log(
      `[collect] ${source.id}: inserted=${report.inserted} unmatched=${report.unmatched} ` +
        `noFxRate=${report.noFxRate} duplicates=${report.duplicates}${report.error ? ` error=${report.error}` : ""}`,
    );
  }

  await recomputeDaily(db, [...touchedCards], [...touchedDates]);
  const summaryTargets = opts.refreshAllSummaries ? [...knownCards] : [...touchedCards];
  for (let i = 0; i < summaryTargets.length; i += 1000) {
    await recomputeSummaries(db, summaryTargets.slice(i, i + 1000), now);
  }
  return reports;
}
