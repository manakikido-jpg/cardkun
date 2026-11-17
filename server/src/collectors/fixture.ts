import type { PriceSource } from "@cardkun/shared";
import type { Collector, RawObservation } from "./types.js";

/**
 * 固定データを返す Collector。収集の流れのテストや、開発用のデータ投入に使う。
 * 実際のサイトにはアクセスしない。
 */
export function createFixtureCollector(source: PriceSource, rows: RawObservation[]): Collector {
  return {
    source,
    async *collect() {
      yield* rows;
    },
  };
}
