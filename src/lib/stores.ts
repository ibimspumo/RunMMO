import { get, writable, type Writable } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Store } from "@tauri-apps/plugin-store";
import { convertFileSrc } from "@tauri-apps/api/core";

import type { AppSettings, LadderState } from "./types";
import {
  defaultSettings,
  DEFAULT_GIFT_URLS,
  DEFAULT_UP_SOUND_URL,
  DEFAULT_DOWN_SOUND_URL,
} from "./defaults";

const SETTINGS_FILE = "settings.json";
const SETTINGS_KEY = "settings";

export const settings: Writable<AppSettings> = writable(defaultSettings());

export const ladderState: Writable<LadderState> = writable({
  currentLevel: 0,
  timeLeft: 0,
  isRunning: false,
  hp: 100,
});

// Death-Sound URL: Custom Pfad oder Fallback auf bundled down.mp3
export function streamHpDeathSoundUrl(cfg: AppSettings): string {
  if (cfg.streamHpDeathSoundPath) return convertFileSrc(cfg.streamHpDeathSoundPath);
  return DEFAULT_DOWN_SOUND_URL;
}

export const settingsOpen: Writable<boolean> = writable(false);

// Hilfsfunktionen: Asset-Pfade in URLs umwandeln
export function imageUrlForLevel(
  level0: number,
  cfg: AppSettings,
): string | null {
  const slot = cfg.levels[level0];
  if (slot?.imagePath) return convertFileSrc(slot.imagePath);
  return DEFAULT_GIFT_URLS[level0] ?? null;
}

export function soundUrlForLevel(
  level0: number,
  cfg: AppSettings,
  direction: "up" | "down",
): string | null {
  const slot = cfg.levels[level0];
  if (slot?.soundPath) return convertFileSrc(slot.soundPath);
  if (direction === "up") {
    return cfg.fallbackUpSoundPath
      ? convertFileSrc(cfg.fallbackUpSoundPath)
      : DEFAULT_UP_SOUND_URL;
  } else {
    return cfg.fallbackDownSoundPath
      ? convertFileSrc(cfg.fallbackDownSoundPath)
      : DEFAULT_DOWN_SOUND_URL;
  }
}

let store: Awaited<ReturnType<typeof Store.load>> | null = null;

export async function loadSettings(): Promise<void> {
  store = await Store.load(SETTINGS_FILE);
  const raw = await store.get<AppSettings>(SETTINGS_KEY);
  if (raw) {
    // Mit Defaults mergen, falls neue Felder hinzukommen
    const merged = { ...defaultSettings(), ...raw };
    // Migration alter Decay-Felder → Array (linear zwischen Min/Max interpoliert).
    const legacy = raw as unknown as {
      streamHpSecondsPerHpAtLevel1?: number;
      streamHpSecondsPerHpAtLevel12?: number;
      streamHpSecondsPerHpByLevel?: number[];
    };
    if (
      !Array.isArray(legacy.streamHpSecondsPerHpByLevel) &&
      typeof legacy.streamHpSecondsPerHpAtLevel1 === "number" &&
      typeof legacy.streamHpSecondsPerHpAtLevel12 === "number"
    ) {
      const s1 = legacy.streamHpSecondsPerHpAtLevel1;
      const s12 = legacy.streamHpSecondsPerHpAtLevel12;
      merged.streamHpSecondsPerHpByLevel = Array.from({ length: 12 }, (_, i) => {
        const t = i / 11;
        return Number((s1 + (s12 - s1) * t).toFixed(2));
      });
    }
    // Array auf 12 Elemente padden/trimmen.
    const fallback = defaultSettings().streamHpSecondsPerHpByLevel;
    const arr = merged.streamHpSecondsPerHpByLevel.slice(0, 12);
    while (arr.length < 12) arr.push(fallback[arr.length]);
    merged.streamHpSecondsPerHpByLevel = arr;
    settings.set(merged);
  }
}

export async function saveSettings(cfg: AppSettings): Promise<void> {
  if (!store) store = await Store.load(SETTINGS_FILE);
  await store.set(SETTINGS_KEY, cfg);
  await store.save();
  // Backend über Webhook-Änderungen informieren
  await invoke("apply_settings", {
    port: cfg.webhookPort,
    enabled: cfg.webhookEnabled,
    bindAll: cfg.webhookBindAllInterfaces,
    durationSeconds: cfg.levelDurationSeconds,
  }).catch(console.error);
}

export async function bindBackendEvents(
  onUp: () => void,
  onDown: () => void,
  onGift: (level: number) => void,
  onReset: () => void,
  onStatusRequest: (replyId: string) => void,
  onHeal: (amount: number) => void,
  onDamage: (amount: number) => void,
): Promise<void> {
  await listen<{
    kind: string;
    level?: number;
    amount?: number;
    replyId?: string;
  }>("webhook", (event) => {
    const p = event.payload;
    switch (p.kind) {
      case "up":
        onUp();
        break;
      case "down":
        onDown();
        break;
      case "gift":
        if (typeof p.level === "number") onGift(p.level);
        break;
      case "reset":
        onReset();
        break;
      case "heal":
        if (typeof p.amount === "number") onHeal(p.amount);
        break;
      case "damage":
        if (typeof p.amount === "number") onDamage(p.amount);
        break;
      case "status":
        if (p.replyId) onStatusRequest(p.replyId);
        break;
    }
  });
}

// Sound-URLs für Heal/Damage (kein Fallback — wenn nicht gesetzt, kein Sound)
export function streamHpHealSoundUrl(cfg: AppSettings): string | null {
  return cfg.streamHpHealSoundPath
    ? convertFileSrc(cfg.streamHpHealSoundPath)
    : null;
}

export function streamHpDamageSoundUrl(cfg: AppSettings): string | null {
  return cfg.streamHpDamageSoundPath
    ? convertFileSrc(cfg.streamHpDamageSoundPath)
    : null;
}

// Pulse-Signal für die HP-Leiste, um Heal/Damage visuell zu zeigen.
// `seq` macht jeden Pulse eindeutig, damit identische {kind, amount} nicht
// vom Subscriber als Duplikat verschluckt werden.
export type HpPulse = { kind: "heal" | "damage"; amount: number; seq: number };
export const hpPulse: Writable<HpPulse | null> = writable(null);

let pulseSeq = 0;
function emitPulse(kind: "heal" | "damage", amount: number) {
  pulseSeq += 1;
  hpPulse.set({ kind, amount, seq: pulseSeq });
}

function playUrl(url: string | null, volumeDb: number) {
  if (!url) return;
  const a = new Audio(url);
  a.volume = Math.max(0, Math.min(1, Math.pow(10, volumeDb / 20)));
  a.play().catch((err) => console.warn("hp sound failed", err));
}

// Gemeinsame Heal/Damage-Logik. Wird sowohl von Webhook-Events als auch
// von den Test-Buttons im Settings-Panel benutzt — gleiche Effekte überall.
export function triggerHeal(amount: number): void {
  const cfg = get(settings);
  if (cfg.mode !== "mmo" || !cfg.streamHpEnabled) return;
  if (!Number.isFinite(amount) || amount <= 0) return;
  ladderState.update((s) => ({
    ...s,
    hp: Math.min(cfg.streamHpMax, s.hp + amount),
  }));
  playUrl(streamHpHealSoundUrl(cfg), cfg.volumeDb);
  emitPulse("heal", amount);
}

export function triggerDamage(amount: number): void {
  const cfg = get(settings);
  if (cfg.mode !== "mmo" || !cfg.streamHpEnabled) return;
  if (!Number.isFinite(amount) || amount <= 0) return;
  ladderState.update((s) => ({
    ...s,
    hp: Math.max(0, s.hp - amount),
  }));
  playUrl(streamHpDamageSoundUrl(cfg), cfg.volumeDb);
  emitPulse("damage", amount);
}
