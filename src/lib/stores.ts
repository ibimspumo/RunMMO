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
  SkillEffectKind,
  SkillRule,
  SoundRef,
  WheelSegment,
} from "./types";
import {
  defaultSettings,
  DEFAULT_GIFT_URLS,
  DEFAULT_UP_SOUND_URL,
  DEFAULT_DOWN_SOUND_URL,
} from "./defaults";
import { resolveDefaultIcon } from "./skill-icons";
import { resolveGiftIcon } from "./gift-icons";
import { resolveSoundUrl } from "./sound-library";
import { playPooled, type AudioCategory } from "./audio-pool";

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
  const u = resolveSoundUrl(cfg, cfg.streamHpDeathSoundPath);
  return u ?? DEFAULT_DOWN_SOUND_URL;
}

// Revive-Sound URL für Extraleben: optional, kein Fallback.
export function streamHpReviveSoundUrl(cfg: AppSettings): string | null {
  return resolveSoundUrl(cfg, cfg.streamHpExtraLifeReviveSoundPath);
}

// ===== Extraleben (Runtime, nicht persistiert) =====
// Wird durch den `extraLife`-Skill-Effekt aufgebaut; bei HP=0 verbraucht der
// Watch in App.svelte ein Leben und füllt HP auf `extraLifeReviveHpPct` Prozent.
// Reset (R / resetLevel) leert den Stack. Das letzte gesetzte Revive-Prozent
// gewinnt — pro Leben merken wir uns nichts (Settings-Antwort des Users).
export const extraLives: Writable<number> = writable(0);
export const extraLifeReviveHpPct: Writable<number> = writable(50);

export function grantExtraLife(opts: {
  count: number;
  reviveHpPct: number;
}): void {
  const cfg = get(settings);
  const cap = Math.max(0, Math.floor(cfg.streamHpExtraLivesMax));
  if (cap <= 0) return;
  const add = Math.max(0, Math.floor(opts.count));
  if (add <= 0) return;
  extraLives.update((n) => Math.min(cap, n + add));
  if (Number.isFinite(opts.reviveHpPct)) {
    extraLifeReviveHpPct.set(Math.max(1, Math.min(100, opts.reviveHpPct)));
  }
}

// Verbraucht ein Leben (falls vorhanden) und liefert die HP-Menge, auf die
// der Caller die Bar zurücksetzen soll. -1 = nichts zu verbrauchen.
export function consumeExtraLife(): number {
  const cur = get(extraLives);
  if (cur <= 0) return -1;
  extraLives.set(cur - 1);
  const cfg = get(settings);
  const pct = Math.max(1, Math.min(100, get(extraLifeReviveHpPct)));
  return Math.max(1, Math.round((cfg.streamHpMax * pct) / 100));
}

export function resetExtraLives(): void {
  extraLives.set(0);
}

// Skill-Effekt: Extraleben vom Stack entfernen, ohne HP anzufassen. Wenn
// weniger Leben vorhanden sind als angefordert, werden nur so viele entfernt
// wie da sind (kein-op, wenn 0). Liefert die tatsächlich entfernte Anzahl.
export function removeExtraLives(count: number): number {
  const n = Math.max(0, Math.floor(count));
  if (n <= 0) return 0;
  const cur = get(extraLives);
  const take = Math.min(cur, n);
  if (take <= 0) return 0;
  extraLives.set(cur - take);
  return take;
}

export const settingsOpen: Writable<boolean> = writable(false);

// Fake-Modus (nur Runtime, nicht persistiert): HP kann nicht unter den Floor
// fallen, und ein Scheduler in App.svelte hilft mit stillen Random-Heals
// nach. Floor = 1% von Max (mind. 1 HP), damit der Balken sichtbar bleibt
// und der Death-Sound nicht triggert.
export const fakeMode: Writable<boolean> = writable(false);

export function getHpFloor(cfg: AppSettings): number {
  if (!get(fakeMode)) return 0;
  return Math.max(1, Math.round(cfg.streamHpMax * 0.01));
}

// Hilfsfunktionen: Asset-Pfade in URLs umwandeln.
// imagePath-Format: null = Default | "gift:<key>" = Bibliothek | sonst = User-Pfad
export function imageUrlForLevel(
  level0: number,
  cfg: AppSettings,
): string | null {
  const slot = cfg.levels[level0];
  if (slot?.imagePath) {
    if (slot.imagePath.startsWith("gift:")) return resolveGiftIcon(slot.imagePath);
    return convertFileSrc(slot.imagePath);
  }
  return DEFAULT_GIFT_URLS[level0] ?? null;
}

// Liefert für einen Level-Sound die URL UND den effektiven dB-Wert
// (Master + Quellen-Offset). Quellenwahl in Reihenfolge:
//   1. Slot-Sound (mit Slot-Offset)
//   2. Fallback Up/Down (mit Fallback-Offset)
//   3. Bundled Default-Asset (kein Offset, nur Master)
export function soundUrlForLevel(
  level0: number,
  cfg: AppSettings,
  direction: "up" | "down",
): { url: string | null; volumeDb: number } {
  const slot = cfg.levels[level0];
  const slotUrl = resolveSoundUrl(cfg, slot?.soundPath ?? null);
  if (slotUrl) {
    return { url: slotUrl, volumeDb: cfg.volumeDb + (slot?.soundVolumeDb ?? 0) };
  }
  if (direction === "up") {
    const fbUrl = resolveSoundUrl(cfg, cfg.fallbackUpSoundPath);
    if (fbUrl) return { url: fbUrl, volumeDb: cfg.volumeDb + cfg.fallbackUpSoundVolumeDb };
    return { url: DEFAULT_UP_SOUND_URL, volumeDb: cfg.volumeDb };
  } else {
    const fbUrl = resolveSoundUrl(cfg, cfg.fallbackDownSoundPath);
    if (fbUrl) return { url: fbUrl, volumeDb: cfg.volumeDb + cfg.fallbackDownSoundVolumeDb };
    return { url: DEFAULT_DOWN_SOUND_URL, volumeDb: cfg.volumeDb };
  }
}

function migrateSoundRef(v: unknown): SoundRef {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function migrateVolumeDb(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// Migration: alte gespeicherte Effekte können nur `kind` + `amount` haben.
// Fülle alle neuen Pflichtfelder mit Defaults auf — rekursiv auch in
// Wheel-Segmenten.
function migrateEffect(e: SkillEffect): SkillEffect {
  const out: SkillEffect = {
    kind: (e?.kind as SkillEffectKind) ?? "heal",
    amount: typeof e?.amount === "number" ? e.amount : 0,
    level: typeof e?.level === "number" ? e.level : 1,
    durationSec: typeof e?.durationSec === "number" ? e.durationSec : 0,
    factor: typeof e?.factor === "number" ? e.factor : 1,
    multipliedKinds: Array.isArray(e?.multipliedKinds)
      ? (e.multipliedKinds as SkillEffectKind[])
      : [],
    segments: Array.isArray(e?.segments)
      ? e.segments.map((s) => ({
          label: typeof s?.label === "string" ? s.label : "",
          color:
            s?.color && typeof s.color === "object"
              ? s.color
              : { r: 0.5, g: 0.5, b: 0.5, a: 1 },
          weight: typeof s?.weight === "number" ? s.weight : 1,
          effects: Array.isArray(s?.effects) ? s.effects.map(migrateEffect) : [],
          soundPath: migrateSoundRef((s as { soundPath?: unknown })?.soundPath),
          soundVolumeDb: migrateVolumeDb(
            (s as { soundVolumeDb?: unknown })?.soundVolumeDb,
          ),
        }))
      : [],
    label: typeof e?.label === "string" ? e.label : "",
    soundPath: migrateSoundRef((e as { soundPath?: unknown })?.soundPath),
    soundVolumeDb: migrateVolumeDb(
      (e as { soundVolumeDb?: unknown })?.soundVolumeDb,
    ),
  };
  return out;
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

    // Migration: alte Skills haben kein giftIconPath-Feld. Wird für beide
    // Listen (mmo + simple) angewendet — die Simple-Liste ist neu und kann
    // in alten Configs fehlen, dann legen wir sie leer an.
    const migrateSkillList = (list: unknown): Skill[] => {
      if (!Array.isArray(list)) return [];
      return list.map((s) => ({
        ...s,
        giftIconPath: s.giftIconPath ?? null,
        valueTextOverride: s.valueTextOverride ?? "",
        soundPath: migrateSoundRef((s as { soundPath?: unknown }).soundPath),
        soundVolumeDb: migrateVolumeDb(
          (s as { soundVolumeDb?: unknown }).soundVolumeDb,
        ),
        rules: Array.isArray(s.rules)
          ? s.rules.map((r: SkillRule) => ({
              ...r,
              effects: Array.isArray(r.effects) ? r.effects.map(migrateEffect) : [],
              successSoundPath: migrateSoundRef(
                (r as { successSoundPath?: unknown }).successSoundPath,
              ),
              successSoundVolumeDb: migrateVolumeDb(
                (r as { successSoundVolumeDb?: unknown }).successSoundVolumeDb,
              ),
              failureSoundPath: migrateSoundRef(
                (r as { failureSoundPath?: unknown }).failureSoundPath,
              ),
              failureSoundVolumeDb: migrateVolumeDb(
                (r as { failureSoundVolumeDb?: unknown }).failureSoundVolumeDb,
              ),
            }))
          : [],
      })) as Skill[];
    };
    merged.skills = migrateSkillList(merged.skills);
    merged.skillsSimple = migrateSkillList(merged.skillsSimple);
    // Sound-Bibliothek: Default leer; alte Configs ohne das Feld werden hier
    // korrigiert. Außerdem alle SoundRef-Felder normalisieren (leere Strings
    // → null) und parallele VolumeDb-Felder auffüllen.
    if (!Array.isArray(merged.soundLibrary)) merged.soundLibrary = [];
    merged.fallbackUpSoundPath = migrateSoundRef(merged.fallbackUpSoundPath);
    merged.fallbackUpSoundVolumeDb = migrateVolumeDb(merged.fallbackUpSoundVolumeDb);
    merged.fallbackDownSoundPath = migrateSoundRef(merged.fallbackDownSoundPath);
    merged.fallbackDownSoundVolumeDb = migrateVolumeDb(merged.fallbackDownSoundVolumeDb);
    merged.streamHpDeathSoundPath = migrateSoundRef(merged.streamHpDeathSoundPath);
    merged.streamHpDeathSoundVolumeDb = migrateVolumeDb(merged.streamHpDeathSoundVolumeDb);
    merged.streamHpHealSoundPath = migrateSoundRef(merged.streamHpHealSoundPath);
    merged.streamHpHealSoundVolumeDb = migrateVolumeDb(merged.streamHpHealSoundVolumeDb);
    merged.streamHpDamageSoundPath = migrateSoundRef(merged.streamHpDamageSoundPath);
    merged.streamHpDamageSoundVolumeDb = migrateVolumeDb(merged.streamHpDamageSoundVolumeDb);
    merged.streamHpExtraLifeReviveSoundPath = migrateSoundRef(
      merged.streamHpExtraLifeReviveSoundPath,
    );
    merged.streamHpExtraLifeReviveSoundVolumeDb = migrateVolumeDb(
      merged.streamHpExtraLifeReviveSoundVolumeDb,
    );
    if (Array.isArray(merged.levels)) {
      merged.levels = merged.levels.map((lv) => ({
        ...lv,
        soundPath: migrateSoundRef(lv?.soundPath),
        soundVolumeDb: migrateVolumeDb((lv as { soundVolumeDb?: unknown })?.soundVolumeDb),
      }));
    }
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

// ============== Webhook-Dispatcher (Immediate vs. Queue) ==============
//
// up/down/reset/status laufen IMMER sofort. gift/heal/damage/skill können
// optional in eine FIFO geparkt werden (Settings → webhookProcessingMode).
// Bei „queued" wird einer pro `webhookQueueIntervalMs` rausgepoppt. Die FIFO
// ist hart begrenzt (MAX_QUEUE) — bei Überlauf wird das älteste Event
// verworfen mit Console-Warn, damit der Speicher nie hochläuft.

type EffectJob =
  | { kind: "gift"; level: number }
  | { kind: "heal"; amount: number }
  | { kind: "damage"; amount: number }
  | { kind: "skill"; id: number };

const MAX_QUEUE = 1000;
const effectQueue: EffectJob[] = [];
let queueTimer: number | null = null;
let queueExecutor: ((j: EffectJob) => void) | null = null;
let queueDropCount = 0;
let queueDropLastWarn = 0;

function scheduleQueuePop() {
  if (queueTimer !== null) return;
  const ms = Math.max(10, get(settings).webhookQueueIntervalMs);
  queueTimer = window.setTimeout(() => {
    queueTimer = null;
    const job = effectQueue.shift();
    if (job && queueExecutor) queueExecutor(job);
    if (effectQueue.length > 0) scheduleQueuePop();
  }, ms);
}

function enqueueEffect(job: EffectJob) {
  if (effectQueue.length >= MAX_QUEUE) {
    effectQueue.shift();
    queueDropCount++;
    const now = Date.now();
    if (now - queueDropLastWarn > 1000) {
      console.warn(
        `[webhook-queue] Backlog voll (${MAX_QUEUE}). ${queueDropCount} älteste Events verworfen.`,
      );
      queueDropLastWarn = now;
      queueDropCount = 0;
    }
  }
  effectQueue.push(job);
  scheduleQueuePop();
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
  queueExecutor = (j) => {
    switch (j.kind) {
      case "gift":
        onGift(j.level);
        break;
      case "heal":
        onHeal(j.amount);
        break;
      case "damage":
        onDamage(j.amount);
        break;
      case "skill":
        onSkill(j.id);
        break;
    }
  };

  await listen<{
    kind: string;
    level?: number;
    amount?: number;
    replyId?: string;
    id?: number;
  }>("webhook", (event) => {
    const p = event.payload;
    // Sofort-Befehle (kein Queue, immer direkt).
    switch (p.kind) {
      case "up":
        onUp();
        return;
      case "down":
        onDown();
        return;
      case "reset":
        onReset();
        return;
      case "status":
        if (p.replyId) onStatusRequest(p.replyId);
        return;
      case "fake": {
        const c = get(settings);
        if (c.mode === "mmo" && c.streamHpEnabled) {
          fakeMode.update((v) => {
            const next = !v;
            console.log(`[fake-mode] ${next ? "ON" : "OFF"} (webhook)`);
            return next;
          });
        }
        return;
      }
    }
    // Effekt-Befehle: ggf. in Queue, sonst sofort.
    const queued = get(settings).webhookProcessingMode === "queued";
    switch (p.kind) {
      case "gift":
        if (typeof p.level !== "number") return;
        if (queued) enqueueEffect({ kind: "gift", level: p.level });
        else onGift(p.level);
        break;
      case "heal":
        if (typeof p.amount !== "number") return;
        if (queued) enqueueEffect({ kind: "heal", amount: p.amount });
        else onHeal(p.amount);
        break;
      case "damage":
        if (typeof p.amount !== "number") return;
        if (queued) enqueueEffect({ kind: "damage", amount: p.amount });
        else onDamage(p.amount);
        break;
      case "skill":
        if (typeof p.id !== "number") return;
        if (queued) enqueueEffect({ kind: "skill", id: p.id });
        else onSkill(p.id);
        break;
    }
  });
}

/** Für Debug-/Status-Anzeige in den Settings. */
export function getWebhookQueueLength(): number {
  return effectQueue.length;
}

// Sound-URLs für Heal/Damage (kein Fallback — wenn nicht gesetzt, kein Sound)
export function streamHpHealSoundUrl(cfg: AppSettings): string | null {
  return resolveSoundUrl(cfg, cfg.streamHpHealSoundPath);
}

export function streamHpDamageSoundUrl(cfg: AppSettings): string | null {
  return resolveSoundUrl(cfg, cfg.streamHpDamageSoundPath);
}

// Pulse-Signal für die HP-Leiste, um Heal/Damage visuell zu zeigen.
// `seq` macht jeden Pulse eindeutig.
//
// Wichtig: Bei Bursts (40-200 Events/s) emittieren wir NICHT pro Event einen
// Pulse — das würde HpBar überfluten. Stattdessen akkumulieren wir per
// requestAnimationFrame und feuern max. einen Pulse pro Frame pro Kind. Die
// HP-Math (ladderState.update) passiert weiterhin SOFORT pro Event, damit
// /heal und /damage immer in der eingegangenen Reihenfolge auf das Leben
// wirken (sonst könnten Effekte „in der falschen Reihenfolge sterben").
export type HpPulse = { kind: "heal" | "damage"; amount: number; seq: number };
export const hpPulse: Writable<HpPulse | null> = writable(null);

let pulseSeq = 0;
let pendingHeal = 0;
let pendingDamage = 0;
let pulseRafHandle: number | null = null;

function flushPendingPulses() {
  pulseRafHandle = null;
  if (pendingHeal > 0) {
    pulseSeq += 1;
    hpPulse.set({ kind: "heal", amount: pendingHeal, seq: pulseSeq });
    pendingHeal = 0;
  }
  if (pendingDamage > 0) {
    pulseSeq += 1;
    hpPulse.set({ kind: "damage", amount: pendingDamage, seq: pulseSeq });
    pendingDamage = 0;
  }
}

function emitPulse(kind: "heal" | "damage", amount: number) {
  if (kind === "heal") pendingHeal += amount;
  else pendingDamage += amount;
  if (pulseRafHandle === null) {
    pulseRafHandle = requestAnimationFrame(flushPendingPulses);
  }
}

// Stiller Heal: HP rauf + visueller Pulse, ohne Sound. Für Fake-Modus.
export function silentHeal(amount: number): void {
  const cfg = get(settings);
  if (cfg.mode !== "mmo" || !cfg.streamHpEnabled) return;
  if (!Number.isFinite(amount) || amount <= 0) return;
  ladderState.update((s) => ({
    ...s,
    hp: Math.min(cfg.streamHpMax, s.hp + amount),
  }));
  emitPulse("heal", amount);
}

// Sounds laufen über den Audio-Pool — siehe lib/audio-pool.ts. Kategorie-Cap
// stoppt die älteste Stimme, wenn zu viele gleichzeitig laufen.
function playHpSound(url: string | null, volumeDb: number, cat: AudioCategory) {
  playPooled(url, volumeDb, cat);
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
  playHpSound(
    streamHpHealSoundUrl(cfg),
    cfg.volumeDb + cfg.streamHpHealSoundVolumeDb,
    "heal",
  );
  emitPulse("heal", amount);
}

export function triggerDamage(amount: number): void {
  const cfg = get(settings);
  if (cfg.mode !== "mmo" || !cfg.streamHpEnabled) return;
  if (!Number.isFinite(amount) || amount <= 0) return;
  const floor = getHpFloor(cfg);
  ladderState.update((s) => ({
    ...s,
    hp: Math.max(floor, s.hp - amount),
  }));
  playHpSound(
    streamHpDamageSoundUrl(cfg),
    cfg.volumeDb + cfg.streamHpDamageSoundVolumeDb,
    "damage",
  );
  emitPulse("damage", amount);
}

// =================== Skill-Engine ===================

// Icon-URL für einen Skill:
//  - null → kein Icon
//  - "default:<key>" oder "default:fluent:<key>" → gebündeltes Default-Icon.
//    Der Stil ist im iconPath kodiert; die globale iconStyle-Einstellung wird
//    nicht mehr ausgewertet (jede Variante hat einen eigenen iconPath).
//  - sonst → User-Pfad via convertFileSrc
export function skillIconUrl(skill: Skill): string | null {
  if (!skill.iconPath) return null;
  if (skill.iconPath.startsWith("default:")) {
    return resolveDefaultIcon(skill.iconPath);
  }
  return convertFileSrc(skill.iconPath);
}

// Gift-Overlay-URL für einen Skill:
//  - null → kein Gift
//  - "gift:<key>" → TikTok-Gift aus der Bibliothek (gift-icons.ts)
//  - sonst → User-Pfad via convertFileSrc
export function skillGiftUrl(skill: Skill): string | null {
  if (!skill.giftIconPath) return null;
  if (skill.giftIconPath.startsWith("gift:")) {
    return resolveGiftIcon(skill.giftIconPath);
  }
  return convertFileSrc(skill.giftIconPath);
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

// Bedingungs-Matching. Felder mit null/undefined werden ignoriert (alte
// gespeicherte Configs haben extraLives-Felder noch nicht).
function conditionGroupMatches(
  c: import("./types").ConditionGroup,
  level1Based: number,
  hpPct: number,
  extraLivesCount: number,
): boolean {
  if (c.minKmh != null && level1Based < c.minKmh) return false;
  if (c.maxKmh != null && level1Based > c.maxKmh) return false;
  if (c.minHpPct != null && hpPct < c.minHpPct) return false;
  if (c.maxHpPct != null && hpPct > c.maxHpPct) return false;
  if (c.minExtraLives != null && extraLivesCount < c.minExtraLives) return false;
  if (c.maxExtraLives != null && extraLivesCount > c.maxExtraLives) return false;
  return true;
}

export function ruleMatches(
  r: SkillRule,
  level1Based: number,
  hpPct: number,
  extraLivesCount: number,
): boolean {
  if (r.conditions.length === 0) return true;
  return r.conditions.some((c) =>
    conditionGroupMatches(c, level1Based, hpPct, extraLivesCount),
  );
}

export function findMatchingRule(
  skill: Skill,
  level1Based: number,
  hpPct: number,
  extraLivesCount: number,
): SkillRule | null {
  for (const r of skill.rules) {
    if (ruleMatches(r, level1Based, hpPct, extraLivesCount)) return r;
  }
  return null;
}

// Wheel-Anforderung: wird vom Skill-Trigger oder einer Wheel-Action gesetzt,
// vom LuckyWheel konsumiert. Zwei Modi:
//  - "chance":   klassisches 2-Sektor-Rad (Erfolg/Fehlschlag) für die regel-
//                interne Wahrscheinlichkeit. Erfolg ist vorbestimmt.
//  - "segments": Action-Glücksrad mit beliebig vielen Sektoren à eigene
//                Wahrscheinlichkeit + eigene Folge-Effekte. Sieger-Index ist
//                vorbestimmt.
export type WheelSpinRequest =
  | {
      mode: "chance";
      skillId: number;
      chance: number;          // 0..100
      success: boolean;
      effects: SkillEffect[];
      // Optional: Rule-Level-Sound, der genau einmal beim Spin-Ende abhängig
      // vom Ergebnis gespielt wird (parallel zur Effekt-Kaskade).
      successSoundPath: SoundRef;
      successSoundVolumeDb: number;
      failureSoundPath: SoundRef;
      failureSoundVolumeDb: number;
    }
  | {
      mode: "segments";
      skillId: number;
      segments: WheelSegment[];
      winningIndex: number;
    };
// `wheelSpin` ist der aktuell laufende Spin (null = Rad idle).
export const wheelSpin: Writable<WheelSpinRequest | null> = writable(null);

// `wheelQueue` ist die Warteschlange aller pending Spins. Werden vom Wheel
// strikt sequentiell abgearbeitet — Effekte feuern erst, wenn der zugehörige
// Spin durch ist. Hartes Limit verhindert Memory-Blowup bei Burst-Triggern.
export const wheelQueue: Writable<WheelSpinRequest[]> = writable([]);
const MAX_WHEEL_QUEUE = 50;
let wheelQueueDropCount = 0;
let wheelQueueDropLastWarn = 0;

export function enqueueWheelSpin(req: WheelSpinRequest): void {
  wheelQueue.update((q) => {
    if (q.length >= MAX_WHEEL_QUEUE) {
      q.shift();
      wheelQueueDropCount++;
      const now = Date.now();
      if (now - wheelQueueDropLastWarn > 1000) {
        console.warn(
          `[wheel-queue] Backlog voll (${MAX_WHEEL_QUEUE}). ${wheelQueueDropCount} älteste Spins verworfen.`,
        );
        wheelQueueDropLastWarn = now;
        wheelQueueDropCount = 0;
      }
    }
    return [...q, req];
  });
  maybeStartNextSpin();
}

// Wenn das Rad idle ist und etwas wartet → ersten Eintrag rausnehmen + starten.
// Wird sowohl beim Enqueue als auch nach Spin-Ende aufgerufen.
export function maybeStartNextSpin(): void {
  if (get(wheelSpin)) return; // läuft schon
  const q = get(wheelQueue);
  if (q.length === 0) return;
  const [next, ...rest] = q;
  wheelQueue.set(rest);
  wheelSpin.set(next);
}

// Skill-Fire-Event: einmaliger Puls mit anzuwendenden Effekten + Skill-ID.
// App.svelte hört darauf und mappt die Effekte auf die lokalen Aktionen
// (heal/damage über stores, levelUp/Down/Reset über lokale Funktionen).
//
// `segmentSoundPath` ist gesetzt, wenn die Effekte aus einem Wheel-Segment
// stammen — dann tritt die mittlere Stufe der Kaskade in Kraft
// (effect > segment > skill). Bei Top-Level-Effekten ist es null.
export type SkillFire = {
  skillId: number;
  effects: SkillEffect[];
  segmentSoundPath: SoundRef;
  segmentSoundVolumeDb: number;
  seq: number;
};
export const skillFire: Writable<SkillFire | null> = writable(null);

let fireSeq = 0;
export function emitSkillFire(
  skillId: number,
  effects: SkillEffect[],
  segmentSoundPath: SoundRef = null,
  segmentSoundVolumeDb: number = 0,
): void {
  fireSeq += 1;
  skillFire.set({
    skillId,
    effects,
    segmentSoundPath,
    segmentSoundVolumeDb,
    seq: fireSeq,
  });
}

// Berechnet aktuelle Lebenspunkte in Prozent für Bedingungs-Matching.
function currentHpPct(cfg: AppSettings, state: LadderState): number {
  if (!cfg.streamHpEnabled) return 100;
  return (Math.max(0, state.hp) / Math.max(1, cfg.streamHpMax)) * 100;
}

// Liefert die Skill-Liste, die im aktuellen Modus aktiv ist. MMO nutzt
// `skills`, Simple nutzt `skillsSimple` — beide haben dieselbe Struktur,
// aber inhaltlich getrennt (sodass der User pro Modus eigene Slots
// konfigurieren kann).
export function activeSkillsFor(cfg: AppSettings): Skill[] {
  return cfg.mode === "simple" ? cfg.skillsSimple : cfg.skills;
}

// Skill-Trigger (vom Webhook /skill?id=N aufgerufen).
// Liefert einen kurzen Status-String zurück (für Debug-Logs).
export function triggerSkill(id: number): string {
  const cfg = get(settings);
  const state = get(ladderState);
  const list = activeSkillsFor(cfg);
  const skill = list.find((s) => s.id === id);
  if (!skill) return `skill #${id} not found`;
  if (isSkillOnCooldown(id)) return `skill #${id} on cooldown`;

  const level1 = state.currentLevel + 1;
  const hpPct = currentHpPct(cfg, state);
  const rule = findMatchingRule(skill, level1, hpPct, get(extraLives));
  if (!rule) return `skill #${id} no matching rule`;

  // Cooldown sofort setzen (auch bei probabilistischem Fehlschlag).
  const until = Date.now() + Math.max(0, skill.cooldownSec) * 1000;
  skillRuntime.update((r) => ({ ...r, [id]: { cooldownUntilMs: until } }));

  if (rule.probability >= 100) {
    emitSkillFire(id, rule.effects);
    return `skill #${id} fired (100%)`;
  }
  // Probability < 100: Würfel rollen, Rad zeigt animiert das Ergebnis.
  // Mehrere parallele Trigger werden in die Wheel-Queue eingereiht und der
  // Reihe nach abgespielt — Effekte feuern erst bei Spin-Ende.
  const success = Math.random() * 100 < Math.max(0, Math.min(100, rule.probability));
  enqueueWheelSpin({
    mode: "chance",
    skillId: id,
    chance: rule.probability,
    success,
    effects: rule.effects,
    successSoundPath: rule.successSoundPath ?? null,
    successSoundVolumeDb: rule.successSoundVolumeDb ?? 0,
    failureSoundPath: rule.failureSoundPath ?? null,
    failureSoundVolumeDb: rule.failureSoundVolumeDb ?? 0,
  });
  return `skill #${id} queued (${rule.probability}%, predetermined=${success})`;
}

// =================== Status-Effekt-State (Buffs) ===================
//
// Aktive temporäre Effekte: Multiplikatoren und Level-Override. Werden von
// einem Tick in App.svelte abgelaufen — die Stores hier sind nur Datenhalter
// + reine Hilfsfunktionen.

export interface ActiveMultiplier {
  id: string;
  factor: number;
  multipliedKinds: SkillEffectKind[];
  expiresAtMs: number;
  sourceSkillId?: number;
  label?: string;
}

export interface ActiveLevelOverride {
  // 0-basiert (wie state.currentLevel). visibleLevel0 ist das, was gerade
  // gerendert wird; underlyingLevel0 das, wohin nach Ablauf gewechselt wird.
  visibleLevel0: number;
  underlyingLevel0: number;
  expiresAtMs: number;
  sourceSkillId?: number;
}

export const activeMultipliers: Writable<ActiveMultiplier[]> = writable([]);
export const activeLevelOverride: Writable<ActiveLevelOverride | null> = writable(null);

// HP-Freeze: solange mindestens einer aktiv ist, läuft der Decay nicht.
// Mehrere können sich überlappen — der späteste expiresAtMs gewinnt.
export interface ActiveHpFreeze {
  id: string;
  expiresAtMs: number;
  startedAtMs: number;
  durationMs: number;
  sourceSkillId?: number;
}
export const activeHpFreezes: Writable<ActiveHpFreeze[]> = writable([]);

// Heal-/Damage-over-Time: HP-Mutation pro Frame über die App.svelte-Tick-Loop.
// `amountPerSec` ist immer positiv; Vorzeichen ergibt sich aus `kind`.
export interface ActiveHpDot {
  id: string;
  kind: "healOverTime" | "damageOverTime";
  amountPerSec: number;
  expiresAtMs: number;
  startedAtMs: number;
  durationMs: number;
  sourceSkillId?: number;
}
export const activeHpDots: Writable<ActiveHpDot[]> = writable([]);

export function registerHpFreeze(opts: {
  durationSec: number;
  sourceSkillId?: number;
}): void {
  if (!Number.isFinite(opts.durationSec) || opts.durationSec <= 0) return;
  const now = Date.now();
  const durationMs = opts.durationSec * 1000;
  const id = `freeze:${opts.sourceSkillId ?? "x"}`;
  activeHpFreezes.update((list) => {
    const filtered = list.filter((f) => f.id !== id);
    filtered.push({
      id,
      expiresAtMs: now + durationMs,
      startedAtMs: now,
      durationMs,
      sourceSkillId: opts.sourceSkillId,
    });
    return filtered;
  });
}

export function registerHpDot(opts: {
  kind: "healOverTime" | "damageOverTime";
  amountPerSec: number;
  durationSec: number;
  sourceSkillId?: number;
}): void {
  if (!Number.isFinite(opts.amountPerSec) || opts.amountPerSec <= 0) return;
  if (!Number.isFinite(opts.durationSec) || opts.durationSec <= 0) return;
  const now = Date.now();
  const durationMs = opts.durationSec * 1000;
  const id = `${opts.kind}:${opts.sourceSkillId ?? "x"}`;
  activeHpDots.update((list) => {
    const filtered = list.filter((d) => d.id !== id);
    filtered.push({
      id,
      kind: opts.kind,
      amountPerSec: opts.amountPerSec,
      expiresAtMs: now + durationMs,
      startedAtMs: now,
      durationMs,
      sourceSkillId: opts.sourceSkillId,
    });
    return filtered;
  });
}

export function isHpFrozen(nowMs?: number): boolean {
  const now = nowMs ?? Date.now();
  for (const f of get(activeHpFreezes)) {
    if (f.expiresAtMs > now) return true;
  }
  return false;
}

// Multiplikator registrieren. Es gibt global nur **einen** aktiven Slot:
// der bessere Faktor gewinnt. Ein neuer Trigger mit ≥ bestehendem Faktor
// ersetzt den Slot komplett (inkl. frischer Restzeit + neuen Kinds). Ein
// schwächerer Trigger wird verworfen — der laufende, bessere Buff läuft
// ungestört weiter. So entsteht kein multiplikatives Stacking mehr.
export function registerMultiplier(opts: {
  factor: number;
  durationSec: number;
  multipliedKinds: SkillEffectKind[];
  sourceSkillId?: number;
  label?: string;
}): void {
  if (!Number.isFinite(opts.factor) || opts.factor <= 0) return;
  if (!Number.isFinite(opts.durationSec) || opts.durationSec <= 0) return;
  const expiresAtMs = Date.now() + opts.durationSec * 1000;
  const id = `mult:${opts.sourceSkillId ?? "x"}:${opts.factor}`;
  const entry: ActiveMultiplier = {
    id,
    factor: opts.factor,
    multipliedKinds: opts.multipliedKinds ?? [],
    expiresAtMs,
    sourceSkillId: opts.sourceSkillId,
    label: opts.label,
  };
  activeMultipliers.update((list) => {
    const current = list[0];
    if (!current || opts.factor >= current.factor) return [entry];
    return list;
  });
}

// Multiplier-Produkt für ein Effekt-Kind. Liefert 1, wenn nichts greift.
export function multiplierFactorFor(kind: SkillEffectKind, nowMs?: number): number {
  const now = nowMs ?? Date.now();
  let f = 1;
  for (const m of get(activeMultipliers)) {
    if (m.expiresAtMs <= now) continue;
    if (m.multipliedKinds.includes(kind)) f *= m.factor;
  }
  return f;
}

// Abgelaufene Buffs entfernen. Wird vom Game-Loop in App.svelte einmal pro
// Frame aufgerufen. Liefert true, wenn ein Override gerade abgelaufen ist
// (App.svelte muss dann den visible-Level auf underlying zurücksetzen).
export function expireBuffsTick(nowMs?: number): { overrideExpired: ActiveLevelOverride | null } {
  const now = nowMs ?? Date.now();
  activeMultipliers.update((list) => list.filter((m) => m.expiresAtMs > now));
  activeHpFreezes.update((list) => list.filter((f) => f.expiresAtMs > now));
  activeHpDots.update((list) => list.filter((d) => d.expiresAtMs > now));
  const ov = get(activeLevelOverride);
  if (ov && ov.expiresAtMs <= now) {
    activeLevelOverride.set(null);
    return { overrideExpired: ov };
  }
  return { overrideExpired: null };
}

// Level-Override setzen. Ohne durationSec: gar kein Override-State — der
// Caller setzt den Level direkt (über state.currentLevel). Mit durationSec:
// vom aktuellen Visible das Underlying übernehmen (oder das bestehende
// Underlying weiterführen, wenn schon ein Override läuft).
export function setLevelOverride(
  targetLevel1Based: number,
  durationSec: number,
  currentVisibleLevel0: number,
  sourceSkillId?: number,
): void {
  const clamped = Math.max(1, Math.min(12, Math.round(targetLevel1Based)));
  const visible0 = clamped - 1;
  const existing = get(activeLevelOverride);
  const underlying0 = existing ? existing.underlyingLevel0 : currentVisibleLevel0;
  activeLevelOverride.set({
    visibleLevel0: visible0,
    underlyingLevel0: underlying0,
    expiresAtMs: Date.now() + Math.max(0, durationSec) * 1000,
    sourceSkillId,
  });
}

// Underlying-Level updaten — wird von App.svelte aufgerufen, wenn ein
// moveUp/moveDown während eines aktiven Overrides reinkommt.
export function bumpOverrideUnderlying(delta: number): boolean {
  const ov = get(activeLevelOverride);
  if (!ov) return false;
  const next = Math.max(0, Math.min(11, ov.underlyingLevel0 + delta));
  if (next === ov.underlyingLevel0) return true; // override aktiv, aber clamp
  activeLevelOverride.set({ ...ov, underlyingLevel0: next });
  return true;
}

// Underlying-Level explizit setzen (für levelReset während Override).
export function setOverrideUnderlying(level0: number): boolean {
  const ov = get(activeLevelOverride);
  if (!ov) return false;
  activeLevelOverride.set({
    ...ov,
    underlyingLevel0: Math.max(0, Math.min(11, level0)),
  });
  return true;
}

// Override beenden, ohne den Visible zu ändern (z.B. bei Reset/Death-Reset
// rufen wir das nach setzen des neuen state.currentLevel auf).
export function clearOverride(): void {
  activeLevelOverride.set(null);
}

// Hilfs-Getter: ein Sektor wird per gewichtetem Random ausgewürfelt. Negative
// oder NaN-Weights werden als 0 behandelt; bei summen=0 fällt es auf den
// ersten Sektor zurück.
export function pickWheelSegmentIndex(segments: WheelSegment[]): number {
  if (segments.length === 0) return -1;
  const weights = segments.map((s) =>
    Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0,
  );
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// Liste aller Skill-Effekt-Kinds, die ohne HP-Leiste keinen Sinn ergeben.
// Wird im Simple-Modus zur Filterung in der Skill-Editor-UI verwendet und
// als Sicherheitsnetz beim Anwenden von Effekten (still ignoriert).
export const HP_EFFECT_KINDS: ReadonlyArray<SkillEffectKind> = [
  "heal",
  "damage",
  "healOverTime",
  "damageOverTime",
  "freezeHp",
  "extraLife",
  "consumeExtraLife",
];

export function isHpEffectKind(kind: SkillEffectKind): boolean {
  return HP_EFFECT_KINDS.includes(kind);
}

// Hilfsfunktion für SkillBar: liefert für einen Skill die aktuell "scheinbar"
// passende Regel (für Vorschau der Werte/Chance-Text-Overlays).
export function previewRule(skill: Skill): SkillRule | null {
  const cfg = get(settings);
  const state = get(ladderState);
  const level1 = state.currentLevel + 1;
  const hpPct = currentHpPct(cfg, state);
  return findMatchingRule(skill, level1, hpPct, get(extraLives));
}
