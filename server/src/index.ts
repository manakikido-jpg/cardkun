import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDbFromEnv } from "./db/env.js";

const port = Number(process.env.PORT ?? 8787);

const handle = createDbFromEnv();
await handle.migrate();

serve({ fetch: createApp({ db: handle.db }).fetch, port }, (info) => {
  console.log(`cardkun server listening on http://localhost:${info.port}`);
});
