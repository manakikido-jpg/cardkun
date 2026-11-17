import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import type { SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema.js";

/** PGlite（開発・テスト）と PostgreSQL（本番）の共通の型 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  db: Db;
  /** マイグレーションを適用する */
  migrate(): Promise<void>;
  close(): Promise<void>;
}

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

/**
 * DB に接続する。
 * - url を渡す（DATABASE_URL）と PostgreSQL に接続する
 * - 渡さないと PGlite を使う。dataDir を渡すとファイルに保存し、省略するとメモリ上で動く
 */
export function createDb(opts: { url?: string; dataDir?: string } = {}): DbHandle {
  if (opts.url) {
    const client = postgres(opts.url, { max: 10 });
    const db = drizzlePostgres(client, { schema });
    return {
      db: db as unknown as Db,
      migrate: () => migratePostgres(db, { migrationsFolder }),
      close: () => client.end(),
    };
  }
  const client = new PGlite({ dataDir: opts.dataDir, extensions: { pg_trgm } });
  const db = drizzlePglite(client, { schema });
  return {
    db: db as unknown as Db,
    migrate: () => migratePglite(db, { migrationsFolder }),
    close: () => client.close(),
  };
}

/**
 * 生 SQL を実行して行を返す。
 * ドライバによって戻り値の形が違う（PGlite は {rows}、postgres-js は配列）ので吸収する。
 * 型の違いを避けるため、SQL 側で count は ::int、日付は ::text にキャストすること。
 */
export async function queryRows<T>(db: Db, query: SQL): Promise<T[]> {
  const res = (await db.execute(query)) as unknown;
  if (Array.isArray(res)) return res as T[];
  return (res as { rows: T[] }).rows;
}
