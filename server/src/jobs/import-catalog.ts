import { and, eq, isNotNull } from "drizzle-orm";
import type { Card, CardDetails } from "@cardkun/shared";
import type { Db } from "../db/client.js";
import { cards } from "../db/schema.js";
import { TcgdexClient, toCard } from "../catalog/tcgdex.js";
import { makeCardId } from "../lib/normalize.js";
import { upsertCards } from "./cards.js";

/**
 * TCGdex から日本語カードのカード名鑑を取り込む。
 * - 対象シリーズ（既定はスカーレット&バイオレット期とメガ期）のセットを順に取り込む
 * - 取り込み済みのカードは飛ばし、足りないカード（詳しい情報が未取得のカードを含む）だけ取りに行く
 *   （途中で失敗しても、再実行で続きから進む）
 * - full: true なら全部やり直す
 * - レアリティはカード詳細にしかないため、カードごとに 1 リクエストかかる
 */

export const DEFAULT_SERIES = ["SV", "M"];

export interface ImportReport {
  setsSeen: number;
  setsImported: number;
  cardsUpserted: number;
  errors: string[];
}

export async function importCatalog(
  db: Db,
  client: TcgdexClient,
  opts: { series?: string[]; full?: boolean; log?: (m: string) => void } = {},
): Promise<ImportReport> {
  const log = opts.log ?? ((m) => console.log(m));
  const report: ImportReport = { setsSeen: 0, setsImported: 0, cardsUpserted: 0, errors: [] };

  for (const serieId of opts.series ?? DEFAULT_SERIES) {
    let serie;
    try {
      serie = await client.serie(serieId);
    } catch (e) {
      report.errors.push(`serie ${serieId}: ${e instanceof Error ? e.message : e}`);
      continue;
    }

    for (const setResume of serie.sets) {
      report.setsSeen++;
      try {
        const set = await client.set(setResume.id);
        const existing = opts.full
          ? new Set<string>()
          : new Set(
              (
                await db
                  .select({ id: cards.id })
                  .from(cards)
                  .where(and(eq(cards.setCode, set.id.toLowerCase()), isNotNull(cards.details)))
              ).map((r) => r.id),
            );
        const missing = set.cards.filter((b) => !existing.has(makeCardId(set.id, b.localId)));
        if (missing.length === 0) continue;

        const list: (Card & { details: CardDetails })[] = [];
        for (const brief of missing) {
          try {
            list.push(toCard(await client.card(brief.id), set));
          } catch (e) {
            report.errors.push(`card ${brief.id}: ${e instanceof Error ? e.message : e}`);
          }
        }
        report.cardsUpserted += await upsertCards(db, list);
        report.setsImported++;
        log(`[catalog] ${set.id} ${set.name}: ${list.length}/${missing.length} cards (set total ${set.cards.length})`);
      } catch (e) {
        report.errors.push(`set ${setResume.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  return report;
}
