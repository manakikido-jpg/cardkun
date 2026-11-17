import { createDbFromEnv } from "../db/env.js";

const handle = createDbFromEnv();
await handle.migrate();
await handle.close();
console.log("migrations applied");
