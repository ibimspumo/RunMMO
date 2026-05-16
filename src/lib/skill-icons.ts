// Skill-Icon-Bibliothek. Wird per import.meta.glob automatisch aus
// src/assets/defaults/graphics/skills/skill_*.png geladen — neue Icons im
// Ordner sind sofort verfügbar, kein manuelles Eintragen nötig.
//
// Der Katalog (Metadaten) ist hier vorgehalten; URLs kommen aus dem Glob.
// Wenn ein Katalog-Eintrag kein passendes Bild hat, fehlt er einfach in der
// fertigen Liste — kein Fehler.

const iconModules = import.meta.glob(
  "../assets/defaults/graphics/skills/skill_*.png",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

// Map: key → URL. Pfad-Form: ".../skills/skill_<key>.png" → "<key>"
export const SKILL_ICON_URLS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [p, url] of Object.entries(iconModules)) {
    const m = p.match(/skill_([^/]+)\.png$/);
    if (!m) continue;
    out[m[1]] = url;
  }
  return out;
})();

export interface SkillIconEntry {
  key: string;
  name: string;       // UI-Label (de)
  category: SkillIconCategory;
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

// Master-Katalog. Reihenfolge bestimmt Anzeige im Picker.
const RAW_CATALOG: SkillIconEntry[] = [
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
  { key: "coin", name: "Münze", category: "misc" },
  { key: "gem", name: "Edelstein", category: "misc" },
  { key: "chest", name: "Schatzkiste", category: "misc" },
  { key: "key", name: "Schlüssel", category: "misc" },
  { key: "scroll", name: "Schriftrolle", category: "misc" },
  { key: "spellbook", name: "Zauberbuch", category: "misc" },
  { key: "crystal_ball", name: "Kristallkugel", category: "misc" },
  { key: "hourglass", name: "Sanduhr", category: "misc" },
];

// Nur Einträge mit existierendem PNG. Schützt vor halb-generierten States.
export const SKILL_CATALOG: SkillIconEntry[] = RAW_CATALOG.filter(
  (e) => SKILL_ICON_URLS[e.key],
);

// Suche nach Eintrag (für Anzeige des aktuell gewählten Icons).
export function findIconEntry(key: string): SkillIconEntry | null {
  return SKILL_CATALOG.find((e) => e.key === key) ?? null;
}

// Resolver: gibt die URL für ein iconPath im Format "default:<key>" zurück.
// Falls der Key nicht im Glob ist → null.
export function resolveDefaultIcon(iconPath: string): string | null {
  if (!iconPath.startsWith("default:")) return null;
  const key = iconPath.slice("default:".length);
  return SKILL_ICON_URLS[key] ?? null;
}
