import type { Collector } from "./types.js";

/**
 * 定期収集で実行する Collector の一覧。
 * 取得元ごとに利用規約・robots.txt を確認してから追加すること（types.ts 参照）。
 * 現在は確認済みの取得元がないため空。
 */
export const collectors: Collector[] = [];
