import { createDbFromEnv } from "../db/env.js";
import { collectors } from "../collectors/registry.js";
import { runCollect } from "../jobs/collect.js";

/** 定期実行用（cron などから 1 日数回呼ぶ想定） */
const handle = createDbFromEnv();
await handle.migrate();
if (collectors.length === 0) console.log("[collect] no collectors registered (see src/collectors/registry.ts)");
const reports = await runCollect(handle.db, collectors, { refreshAllSummaries: true });
await handle.close();
if (reports.some((r) => r.error)) process.exitCode = 1;
