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
    timerTextSize: 40,
    textShadowEnabled: true,
    textShadowColor: c(0, 0, 0, 0.8),
    textShadowOffsetX: 2,
    textShadowOffsetY: 2,
    textOutlineEnabled: true,
    textOutlineColor: c(0, 0, 0, 1),
    textOutlineSize: 4,

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

    overlayScale: 0.6,
    overlayOffsetLeft: 30,
    overlayOffsetTop: 60,
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
