import type { CardCondition, Currency, Grading, PriceSource, PriceType } from "@cardkun/shared";
import type { PoliteFetcher } from "./http.js";

/**
 * 価格収集の共通インターフェース。
 * 取得元（ショップ・フリマ・海外サイト）ごとに 1 つ Collector を作り、registry.ts に登録する。
 *
 * 新しい取得元を追加する前に必ず確認すること：
 * - 利用規約で自動取得が禁止されていないか
 * - robots.txt で対象パスが禁止されていないか（PoliteFetcher が自動で確認する）
 * - 公式 API や提携プログラムがあるなら、そちらを使う
 */

/** 収集した 1 件の価格（DB に入れる前の形） */
export interface RawObservation {
  /** カードの特定方法：cardId を直接指定するか、弾コード + 番号（例: "sv2a", "201/165"） */
  card: { cardId: string } | { setCode: string; number: string };
  priceType: PriceType;
  /** 整数。JPY は円、USD/EUR はセント */
  price: number;
  currency: Currency;
  condition: CardCondition;
  grading?: Grading | null;
  url?: string | null;
  observedAt: Date;
}

export interface CollectContext {
  fetcher: PoliteFetcher;
  now: Date;
  log: (msg: string) => void;
}

export interface Collector {
  /** sources テーブルに登録する取得元の情報 */
  source: PriceSource;
  collect(ctx: CollectContext): AsyncIterable<RawObservation>;
}
