import { get, writable, type Writable } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Store } from "@tauri-apps/plugin-store";
import { convertFileSrc } from "@tauri-apps/api/core";

import type {
  AppSettings,
  LadderState,
  Skill,
  SkillEffect,
  SkillRule,
} from "./types";
import {
  defaultSettings,
  DEFAULT_GIFT_URLS,
  DEFAULT_UP_SOUND_URL,
  DEFAULT_DOWN_SOUND_URL,
} from "./defaults";
import { resolveDefaultIcon } from "./skill-icons";

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
  onSkill: (id: number) => void,
): Promise<void> {
  await listen<{
    kind: string;
    level?: number;
    amount?: number;
    replyId?: string;
    id?: number;
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
      case "skill":
        if (typeof p.id === "number") onSkill(p.id);
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

// =================== Skill-Engine ===================

// Icon-URL für einen Skill:
//  - null → kein Icon
//  - "default:<key>" → gebündeltes Default-Icon (aus skill-icons.ts)
//  - sonst → User-Pfad via convertFileSrc
export function skillIconUrl(skill: Skill): string | null {
  if (!skill.iconPath) return null;
  if (skill.iconPath.startsWith("default:")) {
    return resolveDefaultIcon(skill.iconPath);
  }
  return convertFileSrc(skill.iconPath);
}

// Cooldown-Tracking pro Skill-ID. Wird zur Laufzeit gehalten — nicht persistiert.
export const skillRuntime: Writable<Record<number, { cooldownUntilMs: number }>> =
  writable({});

export function isSkillOnCooldown(id: number, nowMs?: number): boolean {
  const rt = get(skillRuntime)[id];
  if (!rt) return false;
  return rt.cooldownUntilMs > (nowMs ?? Date.now());
}

export function skillCooldownRemainingMs(id: number): number {
  const rt = get(skillRuntime)[id];
  if (!rt) return 0;
  return Math.max(0, rt.cooldownUntilMs - Date.now());
}

// Bedingungs-Matching. Felder mit null werden ignoriert.
function conditionGroupMatches(
  c: import("./types").ConditionGroup,
  level1Based: number,
  hpPct: number,
): boolean {
  if (c.minKmh != null && level1Based < c.minKmh) return false;
  if (c.maxKmh != null && level1Based > c.maxKmh) return false;
  if (c.minHpPct != null && hpPct < c.minHpPct) return false;
  if (c.maxHpPct != null && hpPct > c.maxHpPct) return false;
  return true;
}

export function ruleMatches(
  r: SkillRule,
  level1Based: number,
  hpPct: number,
): boolean {
  if (r.conditions.length === 0) return true;
  return r.conditions.some((c) => conditionGroupMatches(c, level1Based, hpPct));
}

export function findMatchingRule(
  skill: Skill,
  level1Based: number,
  hpPct: number,
): SkillRule | null {
  for (const r of skill.rules) {
    if (ruleMatches(r, level1Based, hpPct)) return r;
  }
  return null;
}

// Wheel-Anforderung: wird vom Skill-Trigger gesetzt, vom LuckyWheel konsumiert.
// `success` ist vorbestimmt — das Rad dreht sich nur visuell zur richtigen Seite.
export type WheelSpinRequest = {
  skillId: number;
  chance: number;       // 0..100
  success: boolean;
  effects: SkillEffect[];
};
export const wheelSpin: Writable<WheelSpinRequest | null> = writable(null);

// Skill-Fire-Event: einmaliger Puls mit anzuwendenden Effekten + Skill-ID.
// App.svelte hört darauf und mappt die Effekte auf die lokalen Aktionen
// (heal/damage über stores, levelUp/Down/Reset über lokale Funktionen).
export type SkillFire = {
  skillId: number;
  effects: SkillEffect[];
  seq: number;
};
export const skillFire: Writable<SkillFire | null> = writable(null);

let fireSeq = 0;
export function emitSkillFire(skillId: number, effects: SkillEffect[]): void {
  fireSeq += 1;
  skillFire.set({ skillId, effects, seq: fireSeq });
}

// Berechnet aktuelle Lebenspunkte in Prozent für Bedingungs-Matching.
function currentHpPct(cfg: AppSettings, state: LadderState): number {
  if (!cfg.streamHpEnabled) return 100;
  return (Math.max(0, state.hp) / Math.max(1, cfg.streamHpMax)) * 100;
}

// Skill-Trigger (vom Webhook /skill?id=N aufgerufen).
// Liefert einen kurzen Status-String zurück (für Debug-Logs).
export function triggerSkill(id: number): string {
  const cfg = get(settings);
  const state = get(ladderState);
  if (cfg.mode !== "mmo") return "skill ignored (not mmo mode)";
  const skill = cfg.skills.find((s) => s.id === id);
  if (!skill) return `skill #${id} not found`;
  if (isSkillOnCooldown(id)) return `skill #${id} on cooldown`;

  const level1 = state.currentLevel + 1;
  const hpPct = currentHpPct(cfg, state);
  const rule = findMatchingRule(skill, level1, hpPct);
  if (!rule) return `skill #${id} no matching rule`;

  // Cooldown sofort setzen (auch bei probabilistischem Fehlschlag).
  const until = Date.now() + Math.max(0, skill.cooldownSec) * 1000;
  skillRuntime.update((r) => ({ ...r, [id]: { cooldownUntilMs: until } }));

  if (rule.probability >= 100) {
    emitSkillFire(id, rule.effects);
    return `skill #${id} fired (100%)`;
  }
  // Probability < 100: Würfel rollen, Rad zeigt animiert das Ergebnis.
  const success = Math.random() * 100 < Math.max(0, Math.min(100, rule.probability));
  // Falls schon ein Spin läuft → kurzer Pass-through (kein Stacking).
  if (get(wheelSpin)) {
    if (success) emitSkillFire(id, rule.effects);
    return `skill #${id} ${success ? "fired" : "missed"} (wheel busy)`;
  }
  wheelSpin.set({
    skillId: id,
    chance: rule.probability,
    success,
    effects: rule.effects,
  });
  return `skill #${id} spinning (${rule.probability}%, predetermined=${success})`;
}

// Hilfsfunktion für SkillBar: liefert für einen Skill die aktuell "scheinbar"
// passende Regel (für Vorschau der Werte/Chance-Text-Overlays).
export function previewRule(skill: Skill): SkillRule | null {
  const cfg = get(settings);
  const state = get(ladderState);
  const level1 = state.currentLevel + 1;
  const hpPct = currentHpPct(cfg, state);
  return findMatchingRule(skill, level1, hpPct);
}
