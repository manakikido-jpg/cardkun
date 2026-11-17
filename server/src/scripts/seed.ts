import { createDbFromEnv } from "../db/env.js";
import { seedDevData } from "../jobs/seed.js";

if (process.env.NODE_ENV === "production") {
  console.error("seed is for development only");
  process.exit(1);
}

const handle = createDbFromEnv();
await handle.migrate();
const reports = await seedDevData(handle.db, { log: console.log });
await handle.close();
console.log(`seeded: ${reports.reduce((n, r) => n + r.inserted, 0)} observations`);
