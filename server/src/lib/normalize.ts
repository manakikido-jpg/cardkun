/**
 * 検索用の文字列正規化。
 * - 全角英数→半角、半角カナ→全角（NFKC）
 * - 英字は小文字
 * - カタカナ→ひらがな（「りざーどん」でも「リザードン」でもヒットさせる）
 * - 空白は除去（「リザードン ex」と「リザードンex」を同一視）
 */
export function normalizeForSearch(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/\s+/g, "");
}

/** カードの検索用文字列。フィールドごとに正規化して区切り文字でつなぐ */
export function buildSearchText(card: {
  name: string;
  nameEn: string | null;
  setCode: string;
  setName: string;
  number: string;
  rarity: string;
}): string {
  return [card.name, card.nameEn ?? "", card.setName, card.setCode, card.number, card.rarity]
    .map(normalizeForSearch)
    .join("|");
}

/** LIKE のワイルドカードをエスケープする */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * カード ID を作る。「弾コード-番号（3桁ゼロ埋め）」
 * 例: ("sv2a", "201/165") → "sv2a-201"、("SV2a", "1/165") → "sv2a-001"
 */
export function makeCardId(setCode: string, number: string): string {
  const prefix = number.split("/")[0]!.trim();
  const padded = /^\d+$/.test(prefix) ? prefix.padStart(3, "0") : prefix.toLowerCase();
  return `${setCode.trim().toLowerCase()}-${padded}`;
}
