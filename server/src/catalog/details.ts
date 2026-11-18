import type { CardDetails } from "@cardkun/shared";
import type { TcgdexCard } from "./tcgdex.js";

/**
 * TCGdex のカード詳細 → cardkun の CardDetails。
 * TCGdex は日本語版でもタイプ・進化段階などを英語の固定値で返すので、日本語の表記に直す。
 * 対応表にない値は英語のまま返す。
 */

const TYPE_JA: Record<string, string> = {
  Grass: "草",
  Fire: "炎",
  Water: "水",
  Lightning: "雷",
  Psychic: "超",
  Fighting: "闘",
  Darkness: "悪",
  Metal: "鋼",
  Dragon: "ドラゴン",
  Fairy: "フェアリー",
  Colorless: "無色",
};

const STAGE_JA: Record<string, string> = {
  Basic: "たね",
  Stage1: "1進化",
  Stage2: "2進化",
  BREAK: "BREAK",
  "LEVEL-UP": "レベルアップ",
  MEGA: "メガシンカ",
  VMAX: "VMAX",
  VSTAR: "VSTAR",
  "V-UNION": "V-UNION",
  Restored: "復元",
};

const CATEGORY_JA: Record<string, string> = {
  Pokemon: "ポケモン",
  Trainer: "トレーナーズ",
  Energy: "エネルギー",
};

const TRAINER_TYPE_JA: Record<string, string> = {
  Item: "グッズ",
  Supporter: "サポート",
  Stadium: "スタジアム",
  Tool: "ポケモンのどうぐ",
  "Technical Machine": "ワザマシン",
  "Rocket's Secret Machine": "ロケット団のひみつマシン",
  "Goldenrod Game Corner": "コガネシティのゲームコーナー",
};

const ABILITY_TYPE_JA: Record<string, string> = {
  Ability: "特性",
  "Poke-POWER": "ポケパワー",
  "Poke-BODY": "ポケボディー",
  "Pokemon Power": "ポケモンパワー",
  "Ancient Trait": "古代能力",
};

const ja = (map: Record<string, string>, v: string) => map[v] ?? v;
const str = (v: unknown): string | null => (v === undefined || v === null || v === "" ? null : String(v));

/** 弱点の倍率などの表記をそろえる（"x2" → "×2"） */
const modifierValue = (v: string) => v.replace(/^x/i, "×");

export function toDetails(card: TcgdexCard): CardDetails {
  return {
    category: ja(CATEGORY_JA, card.category ?? ""),
    hp: typeof card.hp === "number" ? card.hp : null,
    types: (card.types ?? []).map((t) => ja(TYPE_JA, t)),
    stage: card.stage ? ja(STAGE_JA, card.stage) : null,
    evolveFrom: str(card.evolveFrom),
    illustrator: str(card.illustrator),
    regulationMark: str(card.regulationMark),
    trainerType: card.trainerType ? ja(TRAINER_TYPE_JA, card.trainerType) : null,
    effect: str(card.effect),
    abilities: (card.abilities ?? []).map((a) => ({
      type: ja(ABILITY_TYPE_JA, a.type ?? "Ability"),
      name: a.name ?? "",
      effect: a.effect ?? "",
    })),
    attacks: (card.attacks ?? []).map((a) => ({
      name: a.name ?? "",
      cost: (a.cost ?? []).map((t) => ja(TYPE_JA, t)),
      damage: str(a.damage),
      effect: str(a.effect),
    })),
    weaknesses: (card.weaknesses ?? []).map((w) => ({ type: ja(TYPE_JA, w.type), value: modifierValue(w.value ?? "") })),
    resistances: (card.resistances ?? []).map((r) => ({ type: ja(TYPE_JA, r.type), value: modifierValue(r.value ?? "") })),
    retreat: typeof card.retreat === "number" ? card.retreat : null,
  };
}
