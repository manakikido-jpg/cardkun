import { createDbFromEnv } from "../db/env.js";
import { PoliteFetcher } from "../collectors/http.js";
import { buildCollectors } from "../collectors/registry.js";
import { updateFxRates } from "../jobs/fx.js";
import { runCollect } from "../jobs/collect.js";

/** 定期実行用（cron などから 1 日 1〜数回呼ぶ想定） */
const handle = createDbFromEnv();
await handle.migrate();

// 為替を先に更新する。失敗しても保存済みの最新レートで続ける
try {
  const fx = await updateFxRates(handle.db, new PoliteFetcher());
  console.log(`[fx] ${fx.date} EUR=${fx.EUR} USD=${fx.USD}`);
} catch (e) {
  console.error(`[fx] update failed, using stored rates: ${e instanceof Error ? e.message : e}`);
}

const reports = await runCollect(handle.db, buildCollectors(handle.db), { refreshAllSummaries: true });
await handle.close();
if (reports.some((r) => r.error)) process.exitCode = 1;
