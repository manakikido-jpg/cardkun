import { createDbFromEnv } from "../db/env.js";
import { TcgdexClient, createTcgdexFetcher } from "../catalog/tcgdex.js";
import { importCatalog } from "../jobs/import-catalog.js";

/**
 * カード名鑑の取り込み。
 *   pnpm --filter @cardkun/server import-catalog            # 未取り込みのセットだけ
 *   pnpm --filter @cardkun/server import-catalog --full     # 全セットやり直し
 *   pnpm --filter @cardkun/server import-catalog SV         # シリーズを指定
 */
const args = process.argv.slice(2);
const full = args.includes("--full");
const series = args.filter((a) => !a.startsWith("--"));

const handle = createDbFromEnv();
await handle.migrate();
const client = new TcgdexClient(createTcgdexFetcher());
const report = await importCatalog(handle.db, client, { full, series: series.length ? series : undefined });
await handle.close();

console.log(
  `[catalog] sets: ${report.setsImported}/${report.setsSeen} imported, cards: ${report.cardsUpserted}, errors: ${report.errors.length}`,
);
for (const e of report.errors.slice(0, 20)) console.error(`  ${e}`);
if (report.errors.length) process.exitCode = 1;
