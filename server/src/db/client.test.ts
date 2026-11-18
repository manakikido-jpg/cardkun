import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "./client.js";

const root = mkdtempSync(join(tmpdir(), "cardkun-db-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("createDb (PGlite on disk)", () => {
  it("creates missing parent folders on first run (e.g. server/.data/pglite)", async () => {
    const dataDir = join(root, ".data", "pglite");
    const h = createDb({ dataDir });
    await h.migrate();
    await h.close();
    // 2 回目（フォルダがある状態）でも開ける
    const h2 = createDb({ dataDir });
    await expect(h2.migrate()).resolves.toBeUndefined();
    await h2.close();
  });
});
