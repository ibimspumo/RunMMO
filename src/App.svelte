<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { PhysicalSize } from "@tauri-apps/api/dpi";
  import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

  import Ladder from "./lib/overlay/Ladder.svelte";
  import Settings from "./lib/settings/Settings.svelte";

  import type { AppSettings, LadderState } from "./lib/types";
  import { defaultSettings } from "./lib/defaults";
  import {
    settings,
    ladderState,
    settingsOpen,
    loadSettings,
    saveSettings,
    bindBackendEvents,
    soundUrlForLevel,
  } from "./lib/stores";

  let cfg: AppSettings = defaultSettings();
  let state: LadderState = { currentLevel: 0, timeLeft: 0, isRunning: false };
  let panelOpen = false;

  // Reaktive Bindings auf Stores
  const unsubSettings = settings.subscribe((v) => (cfg = v));
  const unsubState = ladderState.subscribe((v) => (state = v));
  const unsubPanel = settingsOpen.subscribe((v) => (panelOpen = v));

  // Timer-Loop (Frontend rendert die Restzeit, Backend hat die Wahrheit)
  let tickHandle: number | null = null;
  let lastTickMs = 0;

  function startTickLoop() {
    if (tickHandle !== null) return;
    lastTickMs = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTickMs) / 1000;
      lastTickMs = now;
      if (state.isRunning && state.timeLeft > 0) {
        ladderState.update((s) => ({
          ...s,
          timeLeft: Math.max(0, s.timeLeft - dt),
        }));
      }
      tickHandle = requestAnimationFrame(tick);
    };
    tickHandle = requestAnimationFrame(tick);
  }

  function stopTickLoop() {
    if (tickHandle !== null) {
      cancelAnimationFrame(tickHandle);
      tickHandle = null;
    }
  }

  // === Game Logic ===
  function startLevelTimer(durationSec: number) {
    ladderState.update((s) => ({ ...s, timeLeft: durationSec, isRunning: true }));
  }
  function stopLevelTimer() {
    ladderState.update((s) => ({ ...s, isRunning: false }));
  }
  function toggleTimer() {
    if (cfg.mode !== "simple") return;
    if (state.isRunning) stopLevelTimer();
    else startLevelTimer(cfg.levelDurationSeconds);
  }

  function playLevelSound(level0: number, direction: "up" | "down") {
    const url = soundUrlForLevel(level0, cfg, direction);
    if (!url) return;
    const a = new Audio(url);
    a.volume = Math.max(0, Math.min(1, Math.pow(10, cfg.volumeDb / 20)));
    a.play().catch((err) => console.warn("audio play failed", err));
  }

  function moveUp(): boolean {
    if (state.currentLevel >= 11) return false;
    const newLevel = state.currentLevel + 1;
    const useTimer = cfg.mode === "simple";
    ladderState.update((s) => ({
      ...s,
      currentLevel: newLevel,
      timeLeft: useTimer ? cfg.levelDurationSeconds : 0,
      isRunning: useTimer,
    }));
    playLevelSound(newLevel, "up");
    return true;
  }

  function moveDown(): boolean {
    if (state.currentLevel <= 0) return false;
    const newLevel = state.currentLevel - 1;
    const useTimer = cfg.mode === "simple";
    ladderState.update((s) => ({
      ...s,
      currentLevel: newLevel,
      timeLeft: useTimer ? cfg.levelDurationSeconds : 0,
      isRunning: useTimer,
    }));
    playLevelSound(newLevel, "down");
    return true;
  }

  function resetLevel() {
    const useTimer = cfg.mode === "simple";
    ladderState.update((s) => ({
      ...s,
      currentLevel: 0,
      isRunning: false,
      timeLeft: useTimer ? cfg.levelDurationSeconds : 0,
    }));
  }

  function restartTimer() {
    if (cfg.mode !== "simple") return;
    ladderState.update((s) => ({
      ...s,
      timeLeft: cfg.levelDurationSeconds,
      isRunning: true,
    }));
  }

  function applyGift(target1Based: number) {
    if (target1Based < 1 || target1Based > 12) return;
    const current1Based = state.currentLevel + 1;
    const diff = target1Based - current1Based;
    if (diff === 0) restartTimer();
    else if (diff === 1) moveUp();
    else if (diff === -1) moveDown();
  }

  function printStatus() {
    console.log("Status:", {
      level: state.currentLevel + 1,
      timeLeft: state.timeLeft.toFixed(2),
      isRunning: state.isRunning,
    });
  }

  function printHelp() {
    console.log(
      "Steuerung:\n  W/↑: Level hoch\n  S/↓: Level runter\n  R: Reset\n  T: Timer start/stop\n  P: Status\n  H: Hilfe\n  ESC: Einstellungen",
    );
  }

  // Timer-Ablauf (nur im Simple-Modus): wenn timeLeft = 0 und running → move_down auslösen
  $: if (cfg.mode === "simple" && state.isRunning && state.timeLeft <= 0) {
    stopLevelTimer();
    queueMicrotask(() => moveDown());
  }

  // Modus-Wechsel zur Laufzeit (nach Save in Settings): State an neuen Modus anpassen
  let lastMode = cfg.mode;
  $: if (cfg.mode !== lastMode) {
    lastMode = cfg.mode;
    if (cfg.mode === "mmo") {
      ladderState.update((s) => ({ ...s, isRunning: false, timeLeft: 0 }));
    } else {
      ladderState.update((s) => ({
        ...s,
        timeLeft: cfg.levelDurationSeconds,
        isRunning: true,
      }));
    }
  }

  // === Backend Events ===
  async function setupBackend() {
    await bindBackendEvents(
      () => moveUp(),
      () => moveDown(),
      (level) => applyGift(level),
      () => resetLevel(),
      async (replyId) => {
        await invoke("status_reply", {
          replyId,
          status: {
            current_level: state.currentLevel + 1,
            time_left: state.timeLeft,
            is_running: state.isRunning,
            max_level: 12,
          },
        });
      },
    );
  }

  // === Aspect Ratio Lock (9:16) ===
  const ASPECT_W = 9;
  const ASPECT_H = 16;
  let lastEnforcedW = 0;
  let lastEnforcedH = 0;
  let unlistenResize: (() => void) | null = null;

  async function setupAspectLock() {
    const win = getCurrentWebviewWindow();
    const sf = await win.scaleFactor();
    unlistenResize = await win.onResized(async ({ payload }) => {
      const w = payload.width;
      const h = payload.height;
      // Ignore the resize that we just triggered ourselves
      if (w === lastEnforcedW && h === lastEnforcedH) return;

      // Compute target height from width (9:16). User-driven width wins,
      // we adjust the height to match.
      const targetH = Math.round((w * ASPECT_H) / ASPECT_W);
      if (Math.abs(h - targetH) <= 1) return;

      lastEnforcedW = w;
      lastEnforcedH = targetH;
      try {
        // PhysicalSize expects physical pixels — payload is already physical
        await win.setSize(new PhysicalSize(w, targetH));
      } catch (e) {
        console.warn("aspect snap failed", e);
      }
      // Hint to satisfy unused var on some toolchains
      void sf;
    });
  }

  // === Lifecycle ===
  onMount(async () => {
    await loadSettings();
    // Push initial settings into backend (für Webhook-Server)
    await saveSettings(cfg).catch(() => {});
    // Initialer Zustand
    const startWithTimer = cfg.mode === "simple";
    ladderState.set({
      currentLevel: 0,
      timeLeft: startWithTimer ? cfg.levelDurationSeconds : 0,
      isRunning: startWithTimer,
    });
    startTickLoop();
    await setupBackend();
    await setupAspectLock();

    window.addEventListener("keydown", onKeyDown);
  });

  onDestroy(() => {
    stopTickLoop();
    unsubSettings();
    unsubState();
    unsubPanel();
    unlistenResize?.();
    window.removeEventListener("keydown", onKeyDown);
  });

  function onKeyDown(e: KeyboardEvent) {
    // ESC immer behandeln (auch im Settings-Panel zum Schließen)
    if (e.key === "Escape") {
      settingsOpen.update((v) => !v);
      e.preventDefault();
      return;
    }
    // Andere Shortcuts nur wenn Settings nicht offen
    if (panelOpen) return;
    switch (e.key.toLowerCase()) {
      case "w":
      case "arrowup":
        moveUp();
        break;
      case "s":
      case "arrowdown":
        moveDown();
        break;
      case "r":
        resetLevel();
        break;
      case "t":
        toggleTimer();
        break;
      case "p":
        printStatus();
        break;
      case "h":
        printHelp();
        break;
    }
  }

  async function onSave(ev: CustomEvent<AppSettings>) {
    const next = ev.detail;
    settings.set(next);
    await saveSettings(next);
    settingsOpen.set(false);
  }
</script>

<main>
  <Ladder {cfg} {state} />

  {#if panelOpen}
    <Settings {cfg} on:save={onSave} on:close={() => settingsOpen.set(false)} />
  {/if}
</main>

<style>
  main {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>
