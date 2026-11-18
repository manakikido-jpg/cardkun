import { sql } from "drizzle-orm";
import type { Card, CardDetails } from "@cardkun/shared";
import type { Db } from "../db/client.js";
import { cards } from "../db/schema.js";
import { buildSearchText } from "../lib/normalize.js";

/**
 * カード名鑑を登録・更新する（検索用文字列もここで作る）。
 * details を渡さなかったカードは、保存済みの詳しい情報を消さずに残す。
 */
export async function upsertCards(db: Db, list: (Card & { details?: CardDetails | null })[]): Promise<number> {
  if (list.length === 0) return 0;
  // details がないときはキーごと省く（null を渡すと JSON の null が保存されてしまうため）
  const rows = list.map(({ details, ...c }) => ({
    ...c,
    ...(details ? { details } : {}),
    searchText: buildSearchText(c),
  }));
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .insert(cards)
      .values(rows.slice(i, i + 500))
      .onConflictDoUpdate({
        target: cards.id,
        set: {
          name: sql`excluded.name`,
          nameEn: sql`excluded.name_en`,
          setCode: sql`excluded.set_code`,
          setName: sql`excluded.set_name`,
          number: sql`excluded.number`,
          rarity: sql`excluded.rarity`,
          imageUrl: sql`excluded.image_url`,
          releaseDate: sql`excluded.release_date`,
          searchText: sql`excluded.search_text`,
          details: sql`coalesce(excluded.details, ${cards.details})`,
        },
      });
  }
  return rows.length;
}
