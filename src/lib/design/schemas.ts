// Design-Modus: Schema-System für floatende Style-Panels.
//
// Ein Schema beschreibt, welche Settings-Felder zu einem klickbaren Sub-Target
// eines Overlay-Elements gehören. Beim Klick öffnet der Design-Modus ein Panel,
// das die hier definierten Felder rendert und direkt in den Settings-Store
// schreibt (analog zum Edit-Modus: Live-Preview, persistiert beim Verlassen).
//
// Konvention: `key` ist der Pfad in AppSettings — flach (z.B. "streamHpBgColor")
// oder mit Punkt für verschachtelte Objekte (z.B. "skillValueText.color").

import type { AppSettings, RGBA } from "../types";

export type FieldDef =
  | {
      kind: "color";
      key: string;
      label: string;
      withAlpha?: boolean; // default true
    }
  | {
      kind: "number";
      key: string;
      label: string;
      min?: number;
      max?: number;
      step?: number;
      suffix?: string;
      hint?: string;
    }
  | {
      kind: "toggle";
      key: string;
      label: string;
    }
  | {
      kind: "select";
      key: string;
      label: string;
      options: { value: string; label: string }[];
    }
  | {
      // Visueller Abschnitts-Trenner im Panel (kein Wert, keine Bindung).
      kind: "group";
      label: string;
    };

export interface DesignSchema {
  id: string; // matcht data-design-target
  label: string; // Anzeige im Panel-Header
  fields: FieldDef[];
}

// === Wert-Zugriff über flache Settings-Keys mit Punkt-Notation ===

export function getByPath(obj: AppSettings, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

// Liefert eine neue AppSettings mit value an path gesetzt (immutable, damit
// Svelte-Stores ein Update auslösen).
export function setByPath(obj: AppSettings, path: string, value: unknown): AppSettings {
  const parts = path.split(".");
  const next = { ...obj } as Record<string, unknown>;
  let cur = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const child = cur[p];
    if (child && typeof child === "object") {
      cur[p] = { ...(child as Record<string, unknown>) };
      cur = cur[p] as Record<string, unknown>;
    } else {
      cur[p] = {};
      cur = cur[p] as Record<string, unknown>;
    }
  }
  cur[parts[parts.length - 1]] = value;
  return next as unknown as AppSettings;
}

// === Schema-Registry ===
//
// Alle bekannten Sub-Targets. Schema-IDs entsprechen den Werten von
// data-design-target im DOM. Dasselbe Schema darf an mehreren DOM-Knoten
// hängen (z.B. an jedem Level-Balken) — Design.svelte rendert dann mehrere
// Hit-Zonen, die alle dasselbe Panel öffnen.

export const SCHEMAS: Record<string, DesignSchema> = {
  // ===== HP-Leiste =====
  "hp.bar": {
    id: "hp.bar",
    label: "HP-Leiste · Balken",
    fields: [
      {
        kind: "number",
        key: "streamHpBorderRadius",
        label: "Eckenradius",
        min: 0,
        max: 120,
        suffix: "px",
        hint: "0 = eckig, hoch = Pille. Wird auf halbe Höhe begrenzt.",
      },
      { kind: "color", key: "streamHpFillColor", label: "Füllung", withAlpha: false },
      { kind: "color", key: "streamHpBgColor", label: "Hintergrund" },
      { kind: "color", key: "streamHpBorderColor", label: "Rand" },
      // Show-Toggle bleibt am Container — sonst kein Wiedereinschalten möglich.
      { kind: "toggle", key: "streamHpShowNumbers", label: "HP-Zahlen anzeigen" },
    ],
  },
  "hp.text": {
    id: "hp.text",
    label: "HP-Leiste · Text",
    fields: [
      { kind: "color", key: "streamHpTextColor", label: "Textfarbe", withAlpha: false },
    ],
  },

  // ===== Leiter (Levelbar) =====
  "ladder.bar": {
    id: "ladder.bar",
    label: "Leiter · Balken",
    fields: [
      { kind: "group", label: "Größe" },
      { kind: "number", key: "barHeight", label: "Höhe", min: 5, max: 300, suffix: "px" },
      { kind: "number", key: "barBaseWidth", label: "Basis-Breite (1 KMH)", min: 10, max: 1000, suffix: "px" },
      { kind: "number", key: "barWidthIncrement", label: "Breite pro Level", min: 0, max: 500, suffix: "px" },
      { kind: "number", key: "spacingBetweenLevels", label: "Abstand zwischen Levels", min: 0, max: 100, suffix: "px" },

      { kind: "group", label: "Rahmen & Form" },
      { kind: "number", key: "barBorderRadius", label: "Eckenradius", min: 0, max: 100, suffix: "px" },
      { kind: "number", key: "activeBarOutlineWidth", label: "Aktiv-Rahmen Breite", min: 0, max: 20, suffix: "px" },
      { kind: "color", key: "activeOutlineColor", label: "Aktiv-Rahmen Farbe" },
      { kind: "color", key: "inactiveBarColor", label: "Inaktiv-Balken (Fallback)" },

      { kind: "group", label: "Innen-Abstand" },
      { kind: "number", key: "barPaddingTop", label: "Oben", min: 0, max: 100, suffix: "px" },
      { kind: "number", key: "barPaddingBottom", label: "Unten", min: 0, max: 100, suffix: "px" },
      { kind: "number", key: "barPaddingLeft", label: "Links", min: 0, max: 100, suffix: "px" },
      { kind: "number", key: "barPaddingRight", label: "Rechts", min: 0, max: 100, suffix: "px" },

      { kind: "group", label: "Geschenk-Icons (Simple-Modus)" },
      { kind: "number", key: "iconSize", label: "Icon-Größe", min: 5, max: 200, suffix: "px" },
    ],
  },
  "ladder.text": {
    id: "ladder.text",
    label: "Leiter · Level-Text",
    fields: [
      { kind: "number", key: "levelTextSize", label: "Schriftgröße", min: 6, max: 200, suffix: "px" },
      { kind: "color", key: "textColor", label: "Textfarbe" },

      { kind: "group", label: "Schatten" },
      { kind: "toggle", key: "textShadowEnabled", label: "Schatten aktiv" },
      { kind: "color", key: "textShadowColor", label: "Schatten-Farbe" },
      { kind: "number", key: "textShadowOffsetX", label: "Offset X", min: -50, max: 50, suffix: "px" },
      { kind: "number", key: "textShadowOffsetY", label: "Offset Y", min: -50, max: 50, suffix: "px" },

      { kind: "group", label: "Umrandung" },
      { kind: "toggle", key: "textOutlineEnabled", label: "Outline aktiv" },
      { kind: "color", key: "textOutlineColor", label: "Outline-Farbe" },
      { kind: "number", key: "textOutlineSize", label: "Outline-Stärke", min: 0, max: 20, suffix: "px" },
    ],
  },
  "ladder.timer": {
    id: "ladder.timer",
    label: "Leiter · Timer-Text",
    fields: [
      { kind: "number", key: "timerTextSize", label: "Schriftgröße", min: 6, max: 200, suffix: "px" },
      { kind: "color", key: "timerColor", label: "Textfarbe" },
    ],
  },

  // ===== Tacho =====
  // Der Tacho hat technisch innen viele bewegliche Teile (Segmente, Nadel,
  // Labels). UX-mäßig ist ein einziges Klick-Ziel für „den Tacho" am
  // pragmatischsten — alle relevanten Style-Optionen liegen in einem Panel.
  "tacho.dial": {
    id: "tacho.dial",
    label: "Tacho",
    fields: [
      { kind: "number", key: "tachoThickness", label: "Bogen-Dicke", min: 4, max: 80, suffix: "px" },
      { kind: "number", key: "tachoArcDegrees", label: "Bogen-Winkel", min: 120, max: 300, suffix: "°", hint: "180 = Halbkreis, 270 = Auto-Tacho." },
      { kind: "color", key: "tachoDialBgColor", label: "Nabe-Hintergrund" },
      { kind: "color", key: "tachoNeedleColor", label: "Nadel" },
      { kind: "toggle", key: "tachoShowLabels", label: "Labels (1..12) anzeigen" },
      { kind: "toggle", key: "tachoShowCenterValue", label: "Mittiges KMH anzeigen" },
    ],
  },

  // ===== Skill-Leiste =====
  "skill.slot": {
    id: "skill.slot",
    label: "Skill-Leiste · Slot",
    fields: [
      {
        kind: "select",
        key: "skillBarStyle",
        label: "Darstellung",
        options: [
          { value: "framed", label: "Framed (mit Kasten)" },
          { value: "clean", label: "Clean (nur Icon + Text)" },
        ],
      },
      { kind: "number", key: "skillBarGap", label: "Abstand zwischen Slots", min: 0, max: 60, suffix: "px" },
      { kind: "toggle", key: "skillMiniWheelEnabled", label: "Mini-Rad in Chance-Pille zeigen" },
    ],
  },
  "skill.valueText": {
    id: "skill.valueText",
    label: "Skill · Status-Effekt-Text",
    fields: [
      { kind: "toggle", key: "skillValueText.enabled", label: "Anzeigen" },
      { kind: "number", key: "skillValueText.fontSize", label: "Schriftgröße", min: 6, max: 120, suffix: "px" },
      { kind: "number", key: "skillValueText.weight", label: "Schriftgewicht", min: 100, max: 900, step: 100 },
      { kind: "color", key: "skillValueText.color", label: "Farbe" },

      { kind: "group", label: "Position im Slot (0 = oben/links, 1 = unten/rechts)" },
      { kind: "number", key: "skillValueText.offsetX", label: "X", min: -0.5, max: 1.5, step: 0.05 },
      { kind: "number", key: "skillValueText.offsetY", label: "Y", min: -0.5, max: 2, step: 0.05 },

      { kind: "group", label: "Umrandung" },
      { kind: "color", key: "skillValueText.outlineColor", label: "Farbe" },
      { kind: "number", key: "skillValueText.outlineSize", label: "Stärke", min: 0, max: 6, step: 0.5, suffix: "px" },

      { kind: "group", label: "Schatten" },
      { kind: "color", key: "skillValueText.shadowColor", label: "Farbe" },
      { kind: "number", key: "skillValueText.shadowSize", label: "Blur", min: 0, max: 16, step: 0.5, suffix: "px" },
    ],
  },
  "skill.chanceText": {
    id: "skill.chanceText",
    label: "Skill · Chance-Pille",
    fields: [
      { kind: "toggle", key: "skillChanceText.enabled", label: "Anzeigen" },
      { kind: "number", key: "skillChanceText.fontSize", label: "Schriftgröße", min: 6, max: 64, suffix: "px" },
      { kind: "number", key: "skillChanceText.weight", label: "Schriftgewicht", min: 100, max: 900, step: 100 },
      { kind: "color", key: "skillChanceText.color", label: "Farbe" },

      { kind: "group", label: "Position im Slot (0 = oben/links, 1 = unten/rechts)" },
      { kind: "number", key: "skillChanceText.offsetX", label: "X", min: -0.5, max: 1.5, step: 0.05 },
      { kind: "number", key: "skillChanceText.offsetY", label: "Y", min: -0.5, max: 2, step: 0.05 },

      { kind: "group", label: "Umrandung" },
      { kind: "color", key: "skillChanceText.outlineColor", label: "Farbe" },
      { kind: "number", key: "skillChanceText.outlineSize", label: "Stärke", min: 0, max: 6, step: 0.5, suffix: "px" },

      { kind: "group", label: "Schatten" },
      { kind: "color", key: "skillChanceText.shadowColor", label: "Farbe" },
      { kind: "number", key: "skillChanceText.shadowSize", label: "Blur", min: 0, max: 16, step: 0.5, suffix: "px" },
    ],
  },
};

// Hilfs-Typ-Guard: ist ein Wert ein RGBA?
export function isRgba(v: unknown): v is RGBA {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as RGBA).r === "number" &&
    typeof (v as RGBA).g === "number" &&
    typeof (v as RGBA).b === "number" &&
    typeof (v as RGBA).a === "number"
  );
}
