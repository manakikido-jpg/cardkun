/**
 * TCGdex のレアリティ（英語の固定値）→ 日本語版カードに印刷されている表記。
 * 対応表にないものは英語のまま返す。
 */
const RARITY_JA: Record<string, string> = {
  Common: "C",
  Uncommon: "U",
  Rare: "R",
  "Double rare": "RR",
  "Triple Rare": "RRR",
  "Illustration rare": "AR",
  "Special illustration rare": "SAR",
  "Ultra Rare": "SR",
  "Hyper rare": "UR",
  "Mega Hyper Rare": "MUR",
  "Mega Attack Rare": "MA",
  "Shiny rare": "S",
  "Shiny Ultra Rare": "SSR",
  "ACE SPEC Rare": "ACE",
  "Black White Rare": "BWR",
  "Radiant Rare": "K",
  "Amazing Rare": "A",
  "Character Rare": "CHR",
  "Character Super Rare": "CSR",
  "Secret Rare": "SR",
  None: "-",
};

export function rarityToJa(rarity: string | undefined, serieId: string): string {
  if (!rarity) return "-";
  // TCGdex はスカーレット&バイオレット期の UR（金色のカード）も "Mega Hyper Rare" にしている
  // （例: ポケモンカード151 の 208〜210）。MUR はメガ期（M）だけの表記なので SV 期は UR にする
  if (rarity === "Mega Hyper Rare" && serieId.toUpperCase() === "SV") return "UR";
  return RARITY_JA[rarity] ?? rarity;
}
