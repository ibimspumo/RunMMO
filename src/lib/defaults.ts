import type { AppSettings, RGBA } from "./types";

import gift1 from "../assets/defaults/graphics/gift_1.webp";
import gift2 from "../assets/defaults/graphics/gift_2.webp";
import gift3 from "../assets/defaults/graphics/gift_3.webp";
import gift4 from "../assets/defaults/graphics/gift_4.webp";
import gift5 from "../assets/defaults/graphics/gift_5.webp";
import gift6 from "../assets/defaults/graphics/gift_6.webp";
import gift7 from "../assets/defaults/graphics/gift_7.webp";

import upSound from "../assets/defaults/sounds/up.mp3";
import downSound from "../assets/defaults/sounds/down.mp3";

// Bundle-URLs der Default-Assets (von Vite resolved).
// Sentinel "default:" markiert ein gebündeltes Asset; die App löst das beim Rendern auf.
export const DEFAULT_GIFT_URLS: (string | null)[] = [
  gift1, gift2, gift3, gift4, gift5, gift6, gift7,
  null, null, null, null, null,
];

export const DEFAULT_UP_SOUND_URL = upSound;
export const DEFAULT_DOWN_SOUND_URL = downSound;

const c = (r: number, g: number, b: number, a = 1): RGBA => ({ r, g, b, a });

export function defaultSettings(): AppSettings {
  return {
    mode: "mmo",
    overlayStyle: "ladder",
    levels: Array.from({ length: 12 }, () => ({
      imagePath: null,
      soundPath: null,
    })),

    volumeDb: -20,
    fallbackUpSoundPath: null,
    fallbackDownSoundPath: null,

    levelDurationSeconds: 120,
    showTimer: true,

    webhookPort: 8080,
    webhookEnabled: true,
    webhookBindAllInterfaces: true,
    webhookProcessingMode: "immediate",
    webhookQueueIntervalMs: 250,

    levelColors: [
      c(0.8, 0.2, 0.2),
      c(0.9, 0.4, 0.2),
      c(1.0, 0.5, 0.0),
      c(1.0, 0.7, 0.0),
      c(1.0, 0.9, 0.0),
      c(0.8, 1.0, 0.0),
      c(0.5, 1.0, 0.0),
      c(0.0, 1.0, 0.5),
      c(0.0, 0.8, 1.0),
      c(0.0, 0.5, 1.0),
      c(0.4, 0.0, 1.0),
      c(0.8, 0.0, 1.0),
    ],

    levelTextSize: 35,
    textShadowEnabled: true,
    textShadowColor: c(0, 0, 0, 0.8),
    textShadowOffsetX: 2,
    textShadowOffsetY: 2,
    textShadowBlur: 0,
    textOutlineEnabled: true,
    textOutlineColor: c(0, 0, 0, 1),
    textOutlineSize: 4,

    timerTextSize: 40,
    timerShadowEnabled: true,
    timerShadowColor: c(0, 0, 0, 0.8),
    timerShadowOffsetX: 2,
    timerShadowOffsetY: 2,
    timerShadowBlur: 0,
    timerOutlineEnabled: true,
    timerOutlineColor: c(0, 0, 0, 1),
    timerOutlineSize: 4,

    inactiveBarColor: c(0.2, 0.2, 0.2),
    activeOutlineColor: c(1, 1, 1),
    textColor: c(1, 1, 1),
    timerColor: c(1, 1, 1),

    barBaseWidth: 130,
    barWidthIncrement: 5,
    barHeight: 40,
    barBorderRadius: 8,
    barPaddingTop: 10,
    barPaddingBottom: 10,
    barPaddingLeft: 15,
    barPaddingRight: 10,
    iconSize: 40,
    spacingBetweenLevels: 8,
    activeBarOutlineWidth: 3,

    // Editor-Layout (Werte in Referenz-450px-Raum).
    ladderX: 30,
    ladderY: 60,
    ladderScale: 0.6,
    tachoX: 30,
    tachoY: 60,
    tachoScale: 0.6,
    hpX: 55,
    hpY: 552,
    hpWidth: 340,
    hpHeight: 48,

    tachoArcDegrees: 220,
    tachoThickness: 28,
    tachoShowLabels: true,
    tachoShowCenterValue: true,
    tachoNeedleColor: c(1, 1, 1),
    tachoDialBgColor: c(0.08, 0.08, 0.08, 0.9),

    streamHpEnabled: true,
    streamHpMax: 1000,
    // 12 Werte: Sekunden pro -1 HP je KMH-Level (1..12).
    // Default: weich abfallende Kurve von 1s/HP @ 1KMH bis 0.1s/HP @ 12KMH
    // (= 1..10 HP/s). Größerer HP-Pool gibt mehr Spielraum für /heal- und
    // /damage-Werte.
    streamHpSecondsPerHpByLevel: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1],
    streamHpShowDecayRate: true,
    streamHpDeathSoundPath: null,
    streamHpHealSoundPath: null,
    streamHpDamageSoundPath: null,
    streamHpFillColor: c(0.15, 0.85, 0.25),
    streamHpBgColor: c(0.08, 0.08, 0.08, 0.85),
    streamHpBorderColor: c(0, 0, 0, 1),
    streamHpShowNumbers: true,
    streamHpBorderRadius: 24,

    streamHpBorderEnabled: true,
    streamHpBorderWidth: 2,
    streamHpShadowEnabled: true,
    streamHpShadowColor: c(0, 0, 0, 0.45),
    streamHpShadowOffsetX: 0,
    streamHpShadowOffsetY: 2,
    streamHpShadowBlur: 6,

    streamHpTextColor: c(1, 1, 1),
    streamHpTextSize: 0,  // 0 = auto aus Balkenhöhe
    streamHpTextShadowEnabled: true,
    streamHpTextShadowColor: c(0, 0, 0, 0.9),
    streamHpTextShadowOffsetX: 2,
    streamHpTextShadowOffsetY: 2,
    streamHpTextShadowBlur: 0,
    streamHpTextOutlineEnabled: true,
    streamHpTextOutlineColor: c(0, 0, 0, 0.85),
    streamHpTextOutlineSize: 1,

    skills: [exampleHealSkill()],

    skillBarX: 55,
    skillBarY: 470,
    skillBarSlotSize: 64,
    skillBarGap: 8,
    skillBarShowInactive: true,
    skillBarStyle: "framed",

    wheelX: 75,
    wheelY: 220,
    wheelSize: 300,
    wheelSpinDurationMs: 2200,

    skillValueText: {
      enabled: true,
      fontSize: 18,
      weight: 800,
      color: c(1, 1, 1),
      outlineEnabled: true,
      outlineColor: c(0, 0, 0),
      outlineSize: 2,
      shadowEnabled: true,
      shadowColor: c(0, 0, 0, 0.85),
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      shadowSize: 4,
      offsetX: 0.5,
      offsetY: 0.82,
    },
    skillChanceText: {
      enabled: true,
      fontSize: 12,
      weight: 700,
      color: c(1, 1, 1),
      outlineEnabled: true,
      outlineColor: c(0, 0, 0),
      outlineSize: 1,
      shadowEnabled: true,
      shadowColor: c(0, 0, 0, 0.85),
      shadowOffsetX: 1,
      shadowOffsetY: 1,
      shadowSize: 3,
      offsetX: 0.5,
      offsetY: 1.18,
    },
    skillMiniWheelEnabled: true,

    skillGiftStyle: {
      enabled: true,
      sizeFrac: 0.65,        // 65% der Slot-Höhe
      offsetX: 0.75,
      offsetY: 0.25,
      opacity: 1,
      shadowEnabled: true,
      shadowColor: c(0, 0, 0, 0.7),
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowSize: 4,
    },

    buffBarX: 75,
    buffBarY: 180,
    buffBarSize: 30,
    buffBarGap: 6,
    buffBarBgColor: c(0.06, 0.09, 0.16, 0.85),
    buffBarShowIcon: true,

    buffBarBorderColor: c(1, 1, 1, 0.18),
    buffBarBorderEnabled: true,
    buffBarBorderWidth: 1,
    buffBarShadowEnabled: true,
    buffBarShadowColor: c(0, 0, 0, 0.4),
    buffBarShadowOffsetX: 0,
    buffBarShadowOffsetY: 4,
    buffBarShadowBlur: 10,

    buffBarTextColor: c(1, 1, 1, 1),
    buffBarTextSize: 0,  // 0 = auto aus Pill-Höhe
    buffBarTextShadowEnabled: false,
    buffBarTextShadowColor: c(0, 0, 0, 0.85),
    buffBarTextShadowOffsetX: 1,
    buffBarTextShadowOffsetY: 1,
    buffBarTextShadowBlur: 0,
    buffBarTextOutlineEnabled: false,
    buffBarTextOutlineColor: c(0, 0, 0, 1),
    buffBarTextOutlineSize: 0,
  };
}

// Effekt-Skeleton mit allen Pflichtfeldern. Hilft, in Defaults konkrete
// Effekte konzis aufzubauen.
function effect(
  kind: import("./types").SkillEffectKind,
  patch: Partial<import("./types").SkillEffect> = {},
): import("./types").SkillEffect {
  return {
    kind,
    amount: 0,
    level: 1,
    durationSec: 0,
    factor: 1,
    multipliedKinds: [],
    segments: [],
    label: "",
    ...patch,
  };
}

// Beispiel-Heilungs-Skill für eine frische Installation. Demonstriert das
// Konzept: ein Skill, drei Regeln je nach KMH-Level mit unterschiedlichem
// Heal-Wert und Wahrscheinlichkeit. Trigger: /skill?id=1
export function exampleHealSkill(): import("./types").Skill {
  return {
    id: 1,
    name: "Heilung",
    iconPath: "default:heal",
    giftIconPath: null,
    cooldownSec: 5,
    valueTextOverride: "",
    rules: [
      {
        conditions: [{ minKmh: 1, maxKmh: 3, minHpPct: null, maxHpPct: null }],
        effects: [effect("heal", { amount: 250 })],
        probability: 100,
      },
      {
        conditions: [{ minKmh: 4, maxKmh: 7, minHpPct: null, maxHpPct: null }],
        effects: [effect("heal", { amount: 150 })],
        probability: 80,
      },
      {
        conditions: [{ minKmh: 8, maxKmh: 12, minHpPct: null, maxHpPct: null }],
        effects: [effect("heal", { amount: 75 })],
        probability: 50,
      },
    ],
  };
}

export function rgbaToCss(c: RGBA): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
}

export function rgbaToHex(c: RGBA): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

export function hexToRgba(hex: string, alpha = 1): RGBA {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16) / 255;
  const g = parseInt(m.substring(2, 4), 16) / 255;
  const b = parseInt(m.substring(4, 6), 16) / 255;
  return { r, g, b, a: alpha };
}
