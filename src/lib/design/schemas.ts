// Design-Modus: Schema-System für floatende Style-Panels.
//
// Ein Schema beschreibt, welche Settings-Felder zu einem klickbaren Sub-Target
// eines Overlay-Elements gehören. Beim Klick öffnet der Design-Modus ein Panel,
// das die hier definierten Felder rendert und direkt in den Settings-Store
// schreibt (analog zum Edit-Modus: Live-Preview, persistiert beim Verlassen).
//
// Konvention: `key` ist der Pfad in AppSettings — flach (z.B. "streamHpBgColor")
// oder mit Punkt für verschachtelte Objekte (z.B. "skillValueText.color").
//
// **Number-Felder sind bewusst ohne min/max** — der User soll frei eintippen
// können (z.B. Blur 32, Outline 50). Limits stören beim Experimentieren.

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

// === Wiederverwendbare Block-Helfer ===
//
// Damit jedes Text-Element exakt dieselben Felder mit denselben Labels
// bekommt. Argumente sind die Settings-Keys — gleiche Struktur, gleiche
// Reihenfolge, gleiche Beschriftungen in jedem Panel.

interface TextKeys {
  size: string;
  color: string;
}

interface ShadowKeys {
  enabled: string;
  color: string;
  offsetX: string;
  offsetY: string;
  blur: string;
}

interface OutlineKeys {
  enabled: string;
  color: string;
  size: string;
}

function textBaseFields(k: TextKeys, opts?: { sizeHint?: string }): FieldDef[] {
  const fields: FieldDef[] = [
    { kind: "number", key: k.size, label: "Schriftgröße", suffix: "px", hint: opts?.sizeHint },
    { kind: "color", key: k.color, label: "Textfarbe" },
  ];
  return fields;
}

function shadowFields(k: ShadowKeys): FieldDef[] {
  return [
    { kind: "group", label: "Schatten" },
    { kind: "toggle", key: k.enabled, label: "Schatten aktiv" },
    { kind: "color", key: k.color, label: "Schatten-Farbe" },
    { kind: "number", key: k.offsetX, label: "Offset X", suffix: "px" },
    { kind: "number", key: k.offsetY, label: "Offset Y", suffix: "px" },
    { kind: "number", key: k.blur, label: "Blur", suffix: "px" },
  ];
}

function outlineFields(k: OutlineKeys): FieldDef[] {
  return [
    { kind: "group", label: "Umrandung" },
    { kind: "toggle", key: k.enabled, label: "Umrandung aktiv" },
    { kind: "color", key: k.color, label: "Umrandungs-Farbe" },
    { kind: "number", key: k.size, label: "Stärke", suffix: "px" },
  ];
}

// === Schema-Registry ===

export const SCHEMAS: Record<string, DesignSchema> = {
  // ===== HP-Leiste — Balken =====
  "hp.bar": {
    id: "hp.bar",
    label: "HP-Leiste · Balken",
    fields: [
      {
        kind: "number",
        key: "streamHpBorderRadius",
        label: "Eckenradius",
        suffix: "px",
        hint: "0 = eckig, hoch = Pille. Wird auf halbe Höhe begrenzt.",
      },
      { kind: "color", key: "streamHpFillColor", label: "Füllung", withAlpha: false },
      { kind: "color", key: "streamHpBgColor", label: "Hintergrund" },
      // Show-Toggle bleibt am Container — sonst kein Wiedereinschalten möglich.
      { kind: "toggle", key: "streamHpShowNumbers", label: "HP-Zahlen anzeigen" },

      ...shadowFields({
        enabled: "streamHpShadowEnabled",
        color: "streamHpShadowColor",
        offsetX: "streamHpShadowOffsetX",
        offsetY: "streamHpShadowOffsetY",
        blur: "streamHpShadowBlur",
      }),

      { kind: "group", label: "Umrandung" },
      { kind: "toggle", key: "streamHpBorderEnabled", label: "Umrandung aktiv" },
      { kind: "color", key: "streamHpBorderColor", label: "Umrandungs-Farbe" },
      { kind: "number", key: "streamHpBorderWidth", label: "Stärke", suffix: "px" },
    ],
  },

  // ===== HP-Leiste — Text =====
  "hp.text": {
    id: "hp.text",
    label: "HP-Leiste · Text",
    fields: [
      ...textBaseFields(
        { size: "streamHpTextSize", color: "streamHpTextColor" },
        { sizeHint: "0 = automatisch aus Balkenhöhe" },
      ),
      ...shadowFields({
        enabled: "streamHpTextShadowEnabled",
        color: "streamHpTextShadowColor",
        offsetX: "streamHpTextShadowOffsetX",
        offsetY: "streamHpTextShadowOffsetY",
        blur: "streamHpTextShadowBlur",
      }),
      ...outlineFields({
        enabled: "streamHpTextOutlineEnabled",
        color: "streamHpTextOutlineColor",
        size: "streamHpTextOutlineSize",
      }),
    ],
  },

  // ===== HP-Leiste — Extraleben =====
  "hp.lives": {
    id: "hp.lives",
    label: "HP-Leiste · Extraleben",
    fields: [
      { kind: "color", key: "streamHpExtraLifeHeartColor", label: "Herzfarbe", withAlpha: false },
      { kind: "number", key: "streamHpExtraLifeHeartSize", label: "Herzgröße", suffix: "px" },
      { kind: "number", key: "streamHpExtraLifeHeartGap", label: "Abstand zwischen Herzen", suffix: "px" },
      { kind: "number", key: "streamHpExtraLifeHeartOffsetY", label: "Abstand zur HP-Leiste", suffix: "px" },
    ],
  },

  // ===== Leiter — Balken =====
  "ladder.bar": {
    id: "ladder.bar",
    label: "Leiter · Balken",
    fields: [
      { kind: "group", label: "Größe" },
      { kind: "number", key: "barHeight", label: "Höhe", suffix: "px" },
      { kind: "number", key: "barBaseWidth", label: "Basis-Breite (1 KMH)", suffix: "px" },
      { kind: "number", key: "barWidthIncrement", label: "Breite pro Level", suffix: "px" },
      { kind: "number", key: "spacingBetweenLevels", label: "Abstand zwischen Levels", suffix: "px" },

      { kind: "group", label: "Rahmen & Form" },
      { kind: "number", key: "barBorderRadius", label: "Eckenradius", suffix: "px" },
      { kind: "number", key: "activeBarOutlineWidth", label: "Aktiv-Rahmen Breite", suffix: "px" },
      { kind: "color", key: "activeOutlineColor", label: "Aktiv-Rahmen Farbe" },
      { kind: "color", key: "inactiveBarColor", label: "Inaktiv-Balken (Fallback)" },

      { kind: "group", label: "Innen-Abstand" },
      { kind: "number", key: "barPaddingTop", label: "Oben", suffix: "px" },
      { kind: "number", key: "barPaddingBottom", label: "Unten", suffix: "px" },
      { kind: "number", key: "barPaddingLeft", label: "Links", suffix: "px" },
      { kind: "number", key: "barPaddingRight", label: "Rechts", suffix: "px" },

      { kind: "group", label: "Geschenk-Icons (Simple-Modus)" },
      { kind: "number", key: "iconSize", label: "Icon-Größe", suffix: "px" },
    ],
  },

  // ===== Leiter — Level-Text =====
  "ladder.text": {
    id: "ladder.text",
    label: "Leiter · Level-Text",
    fields: [
      ...textBaseFields({ size: "levelTextSize", color: "textColor" }),
      ...shadowFields({
        enabled: "textShadowEnabled",
        color: "textShadowColor",
        offsetX: "textShadowOffsetX",
        offsetY: "textShadowOffsetY",
        blur: "textShadowBlur",
      }),
      ...outlineFields({
        enabled: "textOutlineEnabled",
        color: "textOutlineColor",
        size: "textOutlineSize",
      }),
    ],
  },

  // ===== Leiter — Timer-Text =====
  "ladder.timer": {
    id: "ladder.timer",
    label: "Leiter · Timer-Text",
    fields: [
      ...textBaseFields({ size: "timerTextSize", color: "timerColor" }),
      ...shadowFields({
        enabled: "timerShadowEnabled",
        color: "timerShadowColor",
        offsetX: "timerShadowOffsetX",
        offsetY: "timerShadowOffsetY",
        blur: "timerShadowBlur",
      }),
      ...outlineFields({
        enabled: "timerOutlineEnabled",
        color: "timerOutlineColor",
        size: "timerOutlineSize",
      }),
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
      { kind: "number", key: "tachoThickness", label: "Bogen-Dicke", suffix: "px" },
      { kind: "number", key: "tachoArcDegrees", label: "Bogen-Winkel", suffix: "°", hint: "180 = Halbkreis, 270 = Auto-Tacho." },
      { kind: "color", key: "tachoDialBgColor", label: "Nabe-Hintergrund" },
      { kind: "color", key: "tachoNeedleColor", label: "Nadel" },
      { kind: "toggle", key: "tachoShowLabels", label: "Labels (1..12) anzeigen" },
      { kind: "toggle", key: "tachoShowCenterValue", label: "Mittiges KMH anzeigen" },

      { kind: "group", label: "Inaktive Felder" },
      {
        kind: "number",
        key: "tachoInactiveSegmentOpacity",
        label: "Segment-Deckkraft",
        step: 0.05,
        hint: "0 = unsichtbar, 1 = volle Farbe.",
      },
      {
        kind: "number",
        key: "tachoInactiveLabelOpacity",
        label: "Zahlen-Deckkraft",
        step: 0.05,
        hint: "Betrifft Labels und Ticks inaktiver Levels.",
      },
    ],
  },

  // ===== Tacho — Mittiger Text =====
  "tacho.text": {
    id: "tacho.text",
    label: "Tacho · KMH-Text",
    fields: [
      ...textBaseFields(
        { size: "tachoTextSize", color: "tachoTextColor" },
        { sizeHint: "0 = automatisch aus Level-Textgröße" },
      ),
      ...shadowFields({
        enabled: "tachoTextShadowEnabled",
        color: "tachoTextShadowColor",
        offsetX: "tachoTextShadowOffsetX",
        offsetY: "tachoTextShadowOffsetY",
        blur: "tachoTextShadowBlur",
      }),
      ...outlineFields({
        enabled: "tachoTextOutlineEnabled",
        color: "tachoTextOutlineColor",
        size: "tachoTextOutlineSize",
      }),
    ],
  },

  // ===== Skill-Leiste — Slot =====
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
      { kind: "number", key: "skillBarGap", label: "Abstand zwischen Slots", suffix: "px" },
      { kind: "toggle", key: "skillMiniWheelEnabled", label: "Mini-Rad in Chance-Pille zeigen" },
    ],
  },

  // ===== Skill · Status-Effekt-Text =====
  "skill.valueText": {
    id: "skill.valueText",
    label: "Skill · Status-Effekt-Text",
    fields: [
      { kind: "toggle", key: "skillValueText.enabled", label: "Anzeigen" },
      ...textBaseFields({
        size: "skillValueText.fontSize",
        color: "skillValueText.color",
      }),
      { kind: "number", key: "skillValueText.weight", label: "Schriftgewicht", step: 100 },

      { kind: "group", label: "Position im Slot (0 = oben/links, 1 = unten/rechts)" },
      { kind: "number", key: "skillValueText.offsetX", label: "X", step: 0.05 },
      { kind: "number", key: "skillValueText.offsetY", label: "Y", step: 0.05 },

      ...shadowFields({
        enabled: "skillValueText.shadowEnabled",
        color: "skillValueText.shadowColor",
        offsetX: "skillValueText.shadowOffsetX",
        offsetY: "skillValueText.shadowOffsetY",
        blur: "skillValueText.shadowSize",
      }),
      ...outlineFields({
        enabled: "skillValueText.outlineEnabled",
        color: "skillValueText.outlineColor",
        size: "skillValueText.outlineSize",
      }),
    ],
  },

  // ===== Skill · Chance-Pille =====
  "skill.chanceText": {
    id: "skill.chanceText",
    label: "Skill · Chance-Pille",
    fields: [
      { kind: "toggle", key: "skillChanceText.enabled", label: "Anzeigen" },
      ...textBaseFields({
        size: "skillChanceText.fontSize",
        color: "skillChanceText.color",
      }),
      { kind: "number", key: "skillChanceText.weight", label: "Schriftgewicht", step: 100 },

      { kind: "group", label: "Position im Slot (0 = oben/links, 1 = unten/rechts)" },
      { kind: "number", key: "skillChanceText.offsetX", label: "X", step: 0.05 },
      { kind: "number", key: "skillChanceText.offsetY", label: "Y", step: 0.05 },

      ...shadowFields({
        enabled: "skillChanceText.shadowEnabled",
        color: "skillChanceText.shadowColor",
        offsetX: "skillChanceText.shadowOffsetX",
        offsetY: "skillChanceText.shadowOffsetY",
        blur: "skillChanceText.shadowSize",
      }),
      ...outlineFields({
        enabled: "skillChanceText.outlineEnabled",
        color: "skillChanceText.outlineColor",
        size: "skillChanceText.outlineSize",
      }),
    ],
  },

  // ===== Skill · Gift-Overlay (Bild, kein Text → keine Umrandung) =====
  "skill.gift": {
    id: "skill.gift",
    label: "Skill · Gift-Overlay",
    fields: [
      { kind: "toggle", key: "skillGiftStyle.enabled", label: "Anzeigen" },

      { kind: "group", label: "Größe & Position" },
      {
        kind: "number",
        key: "skillGiftStyle.sizeFrac",
        label: "Größe",
        step: 0.05,
        hint: "Anteil der Slot-Höhe (0.4 = 40%).",
      },
      { kind: "number", key: "skillGiftStyle.offsetX", label: "X im Slot", step: 0.05 },
      { kind: "number", key: "skillGiftStyle.offsetY", label: "Y im Slot", step: 0.05 },

      { kind: "group", label: "Optik" },
      { kind: "number", key: "skillGiftStyle.opacity", label: "Deckkraft", step: 0.05 },

      // Schatten — gleiche Felder wie überall, nur ohne Outline (Bilder haben keine).
      ...shadowFields({
        enabled: "skillGiftStyle.shadowEnabled",
        color: "skillGiftStyle.shadowColor",
        offsetX: "skillGiftStyle.shadowOffsetX",
        offsetY: "skillGiftStyle.shadowOffsetY",
        blur: "skillGiftStyle.shadowSize",
      }),
    ],
  },

  // ===== Buff-Leiste — Pill =====
  "buffbar.pill": {
    id: "buffbar.pill",
    label: "Buff-Leiste · Pill",
    fields: [
      { kind: "number", key: "buffBarSize", label: "Pill-Höhe", suffix: "px" },
      { kind: "number", key: "buffBarGap", label: "Abstand zwischen Pills", suffix: "px" },
      { kind: "color", key: "buffBarBgColor", label: "Hintergrund" },
      { kind: "toggle", key: "buffBarShowIcon", label: "Mini-Icon anzeigen" },

      { kind: "group", label: "Text" },
      { kind: "number", key: "buffBarTextSize", label: "Schriftgröße", suffix: "px", hint: "0 = automatisch aus Pill-Höhe" },
      { kind: "color", key: "buffBarTextColor", label: "Textfarbe", withAlpha: false },
      ...shadowFields({
        enabled: "buffBarTextShadowEnabled",
        color: "buffBarTextShadowColor",
        offsetX: "buffBarTextShadowOffsetX",
        offsetY: "buffBarTextShadowOffsetY",
        blur: "buffBarTextShadowBlur",
      }),
      ...outlineFields({
        enabled: "buffBarTextOutlineEnabled",
        color: "buffBarTextOutlineColor",
        size: "buffBarTextOutlineSize",
      }),

      // Container-Schatten / -Umrandung (am Ende, damit die Text-Sektion
      // direkt unter den Text-Feldern bleibt).
      ...shadowFields({
        enabled: "buffBarShadowEnabled",
        color: "buffBarShadowColor",
        offsetX: "buffBarShadowOffsetX",
        offsetY: "buffBarShadowOffsetY",
        blur: "buffBarShadowBlur",
      }),
      { kind: "group", label: "Umrandung" },
      { kind: "toggle", key: "buffBarBorderEnabled", label: "Umrandung aktiv" },
      { kind: "color", key: "buffBarBorderColor", label: "Umrandungs-Farbe" },
      { kind: "number", key: "buffBarBorderWidth", label: "Stärke", suffix: "px" },
    ],
  },

  // ===== Multiplikator-Anzeige · Faktor (X2) =====
  "multiplier.factor": {
    id: "multiplier.factor",
    label: "Multiplikator · Faktor",
    fields: [
      ...textBaseFields({
        size: "multiplierFactorText.fontSize",
        color: "multiplierFactorText.color",
      }),
      ...shadowFields({
        enabled: "multiplierFactorText.shadowEnabled",
        color: "multiplierFactorText.shadowColor",
        offsetX: "multiplierFactorText.shadowOffsetX",
        offsetY: "multiplierFactorText.shadowOffsetY",
        blur: "multiplierFactorText.shadowBlur",
      }),
      ...outlineFields({
        enabled: "multiplierFactorText.outlineEnabled",
        color: "multiplierFactorText.outlineColor",
        size: "multiplierFactorText.outlineSize",
      }),
    ],
  },

  // ===== Multiplikator-Anzeige · Restzeit =====
  "multiplier.timer": {
    id: "multiplier.timer",
    label: "Multiplikator · Restzeit",
    fields: [
      ...textBaseFields({
        size: "multiplierTimerText.fontSize",
        color: "multiplierTimerText.color",
      }),
      ...shadowFields({
        enabled: "multiplierTimerText.shadowEnabled",
        color: "multiplierTimerText.shadowColor",
        offsetX: "multiplierTimerText.shadowOffsetX",
        offsetY: "multiplierTimerText.shadowOffsetY",
        blur: "multiplierTimerText.shadowBlur",
      }),
      ...outlineFields({
        enabled: "multiplierTimerText.outlineEnabled",
        color: "multiplierTimerText.outlineColor",
        size: "multiplierTimerText.outlineSize",
      }),
    ],
  },

  // ===== Multiplikator-Anzeige · Wirkt auf =====
  "multiplier.targets": {
    id: "multiplier.targets",
    label: "Multiplikator · Wirkt auf",
    fields: [
      ...textBaseFields({
        size: "multiplierTargetsText.fontSize",
        color: "multiplierTargetsText.color",
      }),
      ...shadowFields({
        enabled: "multiplierTargetsText.shadowEnabled",
        color: "multiplierTargetsText.shadowColor",
        offsetX: "multiplierTargetsText.shadowOffsetX",
        offsetY: "multiplierTargetsText.shadowOffsetY",
        blur: "multiplierTargetsText.shadowBlur",
      }),
      ...outlineFields({
        enabled: "multiplierTargetsText.outlineEnabled",
        color: "multiplierTargetsText.outlineColor",
        size: "multiplierTargetsText.outlineSize",
      }),
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
