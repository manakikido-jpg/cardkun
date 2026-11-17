import { fileURLToPath } from "node:url";
import { createDb } from "./client.js";

/**
 * 環境変数から DB に接続する。
 * DATABASE_URL があれば PostgreSQL、なければ server/.data/pglite に保存する PGlite を使う。
 */
export function createDbFromEnv() {
  const url = process.env.DATABASE_URL;
  if (url) return createDb({ url });
  const dataDir = process.env.PGLITE_DIR ?? fileURLToPath(new URL("../../.data/pglite", import.meta.url));
  return createDb({ dataDir });
}
