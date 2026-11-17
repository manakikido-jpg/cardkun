import { createDb } from "./db/client.js";
import { seedDevData } from "./jobs/seed.js";

/** テスト用の現在時刻（固定） */
export const TEST_NOW = new Date("2026-11-17T03:00:00.000Z");

/** メモリ上の空の DB（マイグレーション済み） */
export async function createTestDb() {
  const handle = createDb();
  await handle.migrate();
  return handle;
}

/** 開発用データ入りの DB */
export async function createSeededDb() {
  const handle = await createTestDb();
  await seedDevData(handle.db, { now: TEST_NOW, days: 120 });
  return handle;
}
