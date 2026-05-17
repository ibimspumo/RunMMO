// Skill-Icon-Bibliothek. Wird per import.meta.glob automatisch aus
// src/assets/defaults/graphics/skills/ geladen. Zwei Stile parallel:
//  - "painterly" → skills/skill_<key>.png       (Standard, MMORPG-Look)
//  - "fluent"    → skills/fluent/skill_<key>.png (MS Fluent 3D Emoji)
// Neue Icons im jeweiligen Ordner sind sofort verfügbar.

export type IconStyle = "painterly" | "fluent";

const painterlyModules = import.meta.glob(
  "../assets/defaults/graphics/skills/skill_*.png",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;
const fluentModules = import.meta.glob(
  "../assets/defaults/graphics/skills/fluent/skill_*.png",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

function buildMap(modules: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [p, url] of Object.entries(modules)) {
    const m = p.match(/skill_([^/]+)\.png$/);
    if (!m) continue;
    out[m[1]] = url;
  }
  return out;
}

const PAINTERLY_URLS = buildMap(painterlyModules);
const FLUENT_URLS = buildMap(fluentModules);

// Backwards-compat: war früher der einzige Style.
export const SKILL_ICON_URLS = PAINTERLY_URLS;

export function iconUrlsForStyle(style: IconStyle): Record<string, string> {
  return style === "fluent" ? FLUENT_URLS : PAINTERLY_URLS;
}

// Welche Stile haben für diesen Key ein Bild?
export function availableStylesFor(key: string): IconStyle[] {
  const out: IconStyle[] = [];
  if (PAINTERLY_URLS[key]) out.push("painterly");
  if (FLUENT_URLS[key]) out.push("fluent");
  return out;
}

export interface SkillIconEntry {
  // Eindeutiger Sentinel-Pfad. Format:
  //   "default:<key>"          → Painterly (Default)
  //   "default:fluent:<key>"   → Fluent (3D Emoji)
  iconPath: string;
  key: string;             // Basis-Key (z.B. "heal"), identisch für beide Stile
  style: IconStyle;        // "painterly" oder "fluent"
  name: string;            // UI-Label (de) — identisch für beide Stile
  category: SkillIconCategory;
  url: string;             // pre-resolved URL ins gebündelte Asset
}

export type SkillIconCategory =
  | "heal"
  | "damage"
  | "elemental"
  | "status"
  | "buff"
  | "debuff"
  | "level"
  | "multiplier"
  | "misc";

export const SKILL_CATEGORIES: { id: SkillIconCategory; label: string }[] = [
  { id: "heal", label: "Heilung" },
  { id: "damage", label: "Schaden" },
  { id: "elemental", label: "Elementar" },
  { id: "status", label: "Status" },
  { id: "buff", label: "Buffs" },
  { id: "debuff", label: "Debuffs" },
  { id: "level", label: "Level" },
  { id: "multiplier", label: "×" },
  { id: "misc", label: "Sonstiges" },
];

// Master-Katalog (Konzept-Liste, ein Eintrag pro Subjekt). Reihenfolge
// bestimmt Anzeige im Picker. Die Style-Varianten werden unten daraus expandiert.
type RawEntry = {
  key: string;
  name: string;
  category: SkillIconCategory;
};
const RAW_CATALOG: RawEntry[] = [
  // Heilung
  { key: "heal", name: "Heilung", category: "heal" },
  { key: "heal_medium", name: "Heilung (mittel)", category: "heal" },
  { key: "heal_large", name: "Heilung (groß)", category: "heal" },
  { key: "heal_mega", name: "Mega-Heilung", category: "heal" },
  { key: "regen", name: "Regeneration", category: "heal" },
  { key: "bandage", name: "Verband", category: "heal" },
  { key: "first_aid", name: "Erste-Hilfe", category: "heal" },
  { key: "heart", name: "Herz", category: "heal" },

  // Schaden
  { key: "damage_fire", name: "Feuerball", category: "damage" },
  { key: "damage_ice", name: "Eissplitter", category: "damage" },
  { key: "damage_lightning", name: "Blitz", category: "damage" },
  { key: "damage_poison", name: "Gift", category: "damage" },
  { key: "damage_dagger", name: "Dolch", category: "damage" },
  { key: "damage_bomb", name: "Bombe", category: "damage" },
  { key: "damage_skull", name: "Totenkopf", category: "damage" },
  { key: "damage_curse", name: "Fluch", category: "damage" },
  { key: "damage_bleed", name: "Blutung", category: "damage" },
  { key: "damage_meteor", name: "Meteor", category: "damage" },

  // Elemente
  { key: "elem_fire", name: "Feuer", category: "elemental" },
  { key: "elem_water", name: "Wasser", category: "elemental" },
  { key: "elem_earth", name: "Erde", category: "elemental" },
  { key: "elem_wind", name: "Wind", category: "elemental" },
  { key: "elem_lightning", name: "Blitz", category: "elemental" },
  { key: "elem_shadow", name: "Schatten", category: "elemental" },
  { key: "elem_light", name: "Licht", category: "elemental" },
  { key: "elem_arcane", name: "Arkan", category: "elemental" },

  // Status
  { key: "status_freeze", name: "Einfrieren", category: "status" },
  { key: "status_burn", name: "Brennen", category: "status" },
  { key: "status_stun", name: "Betäubung", category: "status" },
  { key: "status_sleep", name: "Schlaf", category: "status" },
  { key: "status_silence", name: "Stille", category: "status" },
  { key: "status_confuse", name: "Verwirrt", category: "status" },
  { key: "status_root", name: "Wurzeln", category: "status" },
  { key: "status_chains", name: "Ketten", category: "status" },

  // Buffs
  { key: "buff_shield", name: "Schild", category: "buff" },
  { key: "buff_attack", name: "Angriff", category: "buff" },
  { key: "buff_speed", name: "Geschwindigkeit", category: "buff" },
  { key: "buff_strength", name: "Stärke", category: "buff" },
  { key: "buff_bless", name: "Segnung", category: "buff" },
  { key: "buff_crit", name: "Krit", category: "buff" },

  // Debuffs
  { key: "debuff_weak", name: "Schwäche", category: "debuff" },
  { key: "debuff_slow", name: "Verlangsamung", category: "debuff" },
  { key: "debuff_doom", name: "Verhängnis", category: "debuff" },
  { key: "debuff_tear", name: "Trauer", category: "debuff" },
  { key: "debuff_fear", name: "Furcht", category: "debuff" },

  // Level
  { key: "level_up", name: "Level Up", category: "level" },
  { key: "level_down", name: "Level Down", category: "level" },
  { key: "level_reset", name: "Reset", category: "level" },
  { key: "trophy", name: "Trophäe", category: "level" },
  { key: "crown", name: "Krone", category: "level" },

  // Multiplikator
  { key: "mult_x2", name: "×2", category: "multiplier" },
  { key: "mult_x3", name: "×3", category: "multiplier" },
  { key: "mult_x4", name: "×4", category: "multiplier" },
  { key: "mult_x5", name: "×5", category: "multiplier" },
  { key: "mult_x10", name: "×10", category: "multiplier" },

  // Sonstiges
  { key: "lucky_wheel", name: "Glücksrad", category: "misc" },
  { key: "dice", name: "Würfel", category: "misc" },
  { key: "roulette", name: "Roulette", category: "misc" },
  { key: "slot_machine", name: "Spielautomat", category: "misc" },
  { key: "cards", name: "Spielkarten", category: "misc" },
  { key: "chips", name: "Casino-Chips", category: "misc" },
  { key: "coin", name: "Münze", category: "misc" },
  { key: "gem", name: "Edelstein", category: "misc" },
  { key: "chest", name: "Schatzkiste", category: "misc" },
  { key: "key", name: "Schlüssel", category: "misc" },
  { key: "scroll", name: "Schriftrolle", category: "misc" },
  { key: "spellbook", name: "Zauberbuch", category: "misc" },
  { key: "crystal_ball", name: "Kristallkugel", category: "misc" },
  { key: "hourglass", name: "Sanduhr", category: "misc" },
];

// Expandierter Katalog: pro Basis-Eintrag eine Variante je Stil (sofern das
// Bild existiert). Sortierung: alphabetisch nach Name (locale-aware, de),
// bei Gleichstand Painterly vor Fluent — so liegen die zwei Varianten eines
// Subjekts direkt nebeneinander.
export const SKILL_CATALOG: SkillIconEntry[] = (() => {
  const out: SkillIconEntry[] = [];
  for (const style of ["painterly", "fluent"] as IconStyle[]) {
    const urls = style === "fluent" ? FLUENT_URLS : PAINTERLY_URLS;
    const prefix = style === "fluent" ? "default:fluent:" : "default:";
    for (const e of RAW_CATALOG) {
      if (!urls[e.key]) continue;
      out.push({
        iconPath: `${prefix}${e.key}`,
        key: e.key,
        style,
        name: e.name,
        category: e.category,
        url: urls[e.key],
      });
    }
  }
  out.sort((a, b) => {
    const byName = a.name.localeCompare(b.name, "de", { sensitivity: "base" });
    if (byName !== 0) return byName;
    // Gleicher Name → Painterly zuerst (alphabetisch passt zufällig: p < f? Nein.
    // Explizit: painterly < fluent in dieser Sortierung).
    if (a.style === b.style) return 0;
    return a.style === "painterly" ? -1 : 1;
  });
  return out;
})();

// Suche nach Eintrag über vollen iconPath (z.B. "default:fluent:heal").
export function findIconEntry(iconPath: string): SkillIconEntry | null {
  return SKILL_CATALOG.find((e) => e.iconPath === iconPath) ?? null;
}

// Resolver: gibt die URL für ein iconPath im Format "default:[<style>:]<key>"
// zurück. Wenn der gewünschte Stil das Bild nicht hat → Fallback auf den
// anderen Stil. Wenn beide leer → null.
export function resolveDefaultIcon(iconPath: string): string | null {
  if (!iconPath.startsWith("default:")) return null;
  let rest = iconPath.slice("default:".length);
  let style: IconStyle = "painterly";
  if (rest.startsWith("fluent:")) {
    style = "fluent";
    rest = rest.slice("fluent:".length);
  } else if (rest.startsWith("painterly:")) {
    style = "painterly";
    rest = rest.slice("painterly:".length);
  }
  const key = rest;
  const primary = style === "fluent" ? FLUENT_URLS : PAINTERLY_URLS;
  if (primary[key]) return primary[key];
  const fallback = style === "fluent" ? PAINTERLY_URLS : FLUENT_URLS;
  return fallback[key] ?? null;
}
