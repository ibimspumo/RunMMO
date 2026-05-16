import { writable, type Writable } from "svelte/store";
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
});

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
    settings.set({ ...defaultSettings(), ...raw });
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
): Promise<void> {
  await listen<{ kind: string; level?: number; replyId?: string }>(
    "webhook",
    (event) => {
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
        case "status":
          if (p.replyId) onStatusRequest(p.replyId);
          break;
      }
    },
  );
}
