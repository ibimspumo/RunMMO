<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { PhysicalSize } from "@tauri-apps/api/dpi";
  import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

  import Ladder from "./lib/overlay/Ladder.svelte";
  import Tacho from "./lib/overlay/Tacho.svelte";
  import HpBar from "./lib/overlay/HpBar.svelte";
  import SkillBar from "./lib/overlay/SkillBar.svelte";
  import LuckyWheel from "./lib/overlay/LuckyWheel.svelte";
  import Settings from "./lib/settings/Settings.svelte";
  import Editor, { type EditTarget } from "./lib/editor/Editor.svelte";
  import Design from "./lib/design/Design.svelte";

  import type { AppSettings, LadderState, SkillEffect } from "./lib/types";
  import { defaultSettings } from "./lib/defaults";
  import {
    settings,
    ladderState,
    settingsOpen,
    loadSettings,
    saveSettings,
    bindBackendEvents,
    soundUrlForLevel,
    streamHpDeathSoundUrl,
    triggerHeal,
    triggerDamage,
    triggerSkill,
    skillFire,
  } from "./lib/stores";

  let cfg: AppSettings = defaultSettings();
  let state: LadderState = { currentLevel: 0, timeLeft: 0, isRunning: false, hp: 100 };
  let panelOpen = false;
  let editMode = false;
  let designMode = false;
  let deathSoundFired = false;

  // Refs auf die Overlay-Komponenten (für Editor-Bbox-Messung).
  let ladderRef: Ladder | undefined;
  let tachoRef: Tacho | undefined;
  let hpRef: HpBar | undefined;
  let skillBarRef: SkillBar | undefined;
  let wheelRef: LuckyWheel | undefined;

  // Edit-Modus: Toggle für temporäre Elemente (Glücksrad), damit man es
  // im Editor verschieben/skalieren kann, obwohl es zur Laufzeit nur
  // beim Spin sichtbar ist.
  let showTemporaryInEdit = false;

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
      if (cfg.mode === "mmo" && cfg.streamHpEnabled && state.hp > 0) {
        const rate = hpDrainRatePerSec(cfg, state.currentLevel + 1);
        if (rate > 0) {
          ladderState.update((s) => ({
            ...s,
            hp: Math.max(0, s.hp - rate * dt),
          }));
        }
      }
      tickHandle = requestAnimationFrame(tick);
    };
    tickHandle = requestAnimationFrame(tick);
  }

  // HP-Drain: Sekunden pro -1 HP für das aktuelle 1-basierte Level (1..12) aus Array lesen.
  function hpSecondsPerHp(cfg: AppSettings, level1Based: number): number {
    const idx = Math.max(0, Math.min(11, level1Based - 1));
    const v = cfg.streamHpSecondsPerHpByLevel?.[idx];
    return typeof v === "number" && v > 0 ? v : 1;
  }
  function hpDrainRatePerSec(cfg: AppSettings, level1Based: number): number {
    return 1 / Math.max(0.01, hpSecondsPerHp(cfg, level1Based));
  }

  function playDeathSound() {
    playUrl(streamHpDeathSoundUrl(cfg), "death");
  }
  function playUrl(url: string | null, label: string) {
    if (!url) return;
    const a = new Audio(url);
    a.volume = Math.max(0, Math.min(1, Math.pow(10, cfg.volumeDb / 20)));
    a.play().catch((err) => console.warn(`${label} sound failed`, err));
  }

  // Heal/Damage liegen in stores.ts, damit Webhooks und die Test-Buttons
  // im Settings-Panel exakt denselben Code ausführen (inkl. Pulse für Effekte).

  // HP=0 → Death-Sound einmal abspielen. Re-Trigger nach Heilung > 0.
  $: if (cfg.mode === "mmo" && cfg.streamHpEnabled && state.hp <= 0 && !deathSoundFired) {
    deathSoundFired = true;
    playDeathSound();
  }
  $: if (state.hp > 0 && deathSoundFired) {
    deathSoundFired = false;
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
      hp: cfg.streamHpMax,
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

  function printHelp() {
    console.log(
      "Steuerung:\n  W/↑: Level hoch\n  S/↓: Level runter\n  R: Reset\n  T: Timer start/stop\n  P: +100 HP (Heal-Test)\n  M: −100 HP (Damage-Test)\n  H: Hilfe\n  E: Edit-Modus (Position/Skalierung)\n  D: Design-Modus (Stil)\n  ESC: Einstellungen",
    );
  }

  // Standard-Menge für die Heal/Damage-Test-Tasten (entspricht dem Webhook-Default
  // = 10% des Default-Max-HP).
  const HP_TEST_AMOUNT = 100;

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
      (amount) => triggerHeal(amount),
      (amount) => triggerDamage(amount),
      (id) => {
        const status = triggerSkill(id);
        console.log("[skill]", status);
      },
    );
  }

  // Effekte vom Skill-Fire-Pulse anwenden. Heal/Damage gehen über die
  // bestehenden trigger-Helfer (inkl. Sound + Pulse), Level-Effekte über
  // die lokalen move-Funktionen (inkl. Level-Sound).
  function applySkillEffect(eff: SkillEffect) {
    switch (eff.kind) {
      case "heal":
        triggerHeal(eff.amount);
        break;
      case "damage":
        triggerDamage(eff.amount);
        break;
      case "levelUp":
        moveUp();
        break;
      case "levelDown":
        moveDown();
        break;
      case "levelReset":
        resetLevel();
        break;
    }
  }
  // Subscribe global — feuert für jedes Pulse-Update mit neuer seq.
  let lastSkillFireSeq = 0;
  const unsubSkillFire = skillFire.subscribe((fire) => {
    if (!fire || fire.seq === lastSkillFireSeq) return;
    lastSkillFireSeq = fire.seq;
    for (const eff of fire.effects) applySkillEffect(eff);
  });

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
      hp: cfg.streamHpMax,
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
    unsubSkillFire();
    unlistenResize?.();
    window.removeEventListener("keydown", onKeyDown);
  });

  function onKeyDown(e: KeyboardEvent) {
    // ESC: schließt vorrangig Edit- oder Design-Modus, sonst togglet Settings.
    if (e.key === "Escape") {
      if (editMode) {
        exitEditMode();
      } else if (designMode) {
        exitDesignMode();
      } else {
        settingsOpen.update((v) => !v);
      }
      e.preventDefault();
      return;
    }
    // "E" togglet Edit-Modus (nur wenn Settings zu, und Design nicht offen).
    if (!panelOpen && !designMode && (e.key === "e" || e.key === "E")) {
      if (editMode) exitEditMode();
      else enterEditMode();
      e.preventDefault();
      return;
    }
    // "D" togglet Design-Modus (nur wenn Settings zu, und Edit nicht offen).
    if (!panelOpen && !editMode && (e.key === "d" || e.key === "D")) {
      if (designMode) exitDesignMode();
      else enterDesignMode();
      e.preventDefault();
      return;
    }
    // Andere Shortcuts nur wenn Settings & Editor & Design nicht offen.
    if (panelOpen || editMode || designMode) return;
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
        triggerHeal(HP_TEST_AMOUNT);
        break;
      case "m":
        triggerDamage(HP_TEST_AMOUNT);
        break;
      case "h":
        printHelp();
        break;
    }
  }

  // === Edit-Modus ===
  function enterEditMode() {
    editMode = true;
  }
  async function exitEditMode() {
    editMode = false;
    // Layout-Änderungen sind direkt in cfg geschrieben — beim Verlassen persistieren.
    await saveSettings(cfg).catch((e) => console.warn("save failed", e));
  }

  // === Design-Modus ===
  function enterDesignMode() {
    designMode = true;
  }
  async function exitDesignMode() {
    designMode = false;
    // Style-Änderungen sind direkt in cfg geschrieben — beim Verlassen persistieren.
    await saveSettings(cfg).catch((e) => console.warn("save failed", e));
  }

  // showTemporaryInEdit muss als Argument durchgereicht werden, damit das
  // reaktive Statement neu evaluiert wird, wenn der Toggle wechselt.
  $: editTargets = buildEditTargets(cfg, showTemporaryInEdit);

  function buildEditTargets(c: AppSettings, showTemp: boolean): EditTarget[] {
    const ts: EditTarget[] = [];
    const showTacho = c.mode === "mmo" && c.overlayStyle === "tacho";
    const mainLabel = showTacho ? "Tacho" : "Leiter";
    if (showTacho) {
      ts.push({
        id: "tacho",
        label: mainLabel,
        kind: "uniform",
        getElement: () => tachoRef?.getElement(),
        getLayout: () => ({ x: cfg.tachoX, y: cfg.tachoY }),
        move: (x, y) => settings.update((s) => ({ ...s, tachoX: x, tachoY: y })),
        getScale: () => cfg.tachoScale,
        setScale: (sc) => settings.update((s) => ({ ...s, tachoScale: sc })),
      });
    } else {
      ts.push({
        id: "ladder",
        label: mainLabel,
        kind: "uniform",
        getElement: () => ladderRef?.getElement(),
        getLayout: () => ({ x: cfg.ladderX, y: cfg.ladderY }),
        move: (x, y) => settings.update((s) => ({ ...s, ladderX: x, ladderY: y })),
        getScale: () => cfg.ladderScale,
        setScale: (sc) => settings.update((s) => ({ ...s, ladderScale: sc })),
      });
    }
    if (c.mode === "mmo" && c.streamHpEnabled) {
      ts.push({
        id: "hp",
        label: "HP-Leiste",
        kind: "wh",
        getElement: () => hpRef?.getElement(),
        getLayout: () => ({ x: cfg.hpX, y: cfg.hpY }),
        move: (x, y) => settings.update((s) => ({ ...s, hpX: x, hpY: y })),
        getSize: () => ({ w: cfg.hpWidth, h: cfg.hpHeight }),
        setSize: (w, h) => settings.update((s) => ({ ...s, hpWidth: w, hpHeight: h })),
      });
    }
    if (c.mode === "mmo") {
      // Skill-Leiste — kind "wh" mit dem Slot-Quadrat als Resize-Größe.
      // skillBarSlotSize ist die einzige effektiv resize-bare Dimension
      // (Breite = n*slotSize + (n-1)*gap), wir mappen W = H = slotSize.
      ts.push({
        id: "skillbar",
        label: "Skill-Leiste",
        kind: "wh",
        getElement: () => skillBarRef?.getElement(),
        getLayout: () => ({ x: cfg.skillBarX, y: cfg.skillBarY }),
        move: (x, y) =>
          settings.update((s) => ({ ...s, skillBarX: x, skillBarY: y })),
        getSize: () => ({ w: cfg.skillBarSlotSize, h: cfg.skillBarSlotSize }),
        // Slot ist quadratisch — wir nehmen den Mittelwert der vom Editor
        // gemeldeten W/H, damit die Slot-Größe einheitlich bleibt.
        setSize: (w, h) =>
          settings.update((s) => ({
            ...s,
            skillBarSlotSize: Math.max(20, Math.min(200, (w + h) / 2)),
          })),
      });
    }
    if (c.mode === "mmo" && showTemp) {
      ts.push({
        id: "wheel",
        label: "Glücksrad",
        kind: "wh",
        getElement: () => wheelRef?.getElement(),
        getLayout: () => ({ x: cfg.wheelX, y: cfg.wheelY }),
        move: (x, y) =>
          settings.update((s) => ({ ...s, wheelX: x, wheelY: y })),
        // Rad ist rund; nimm Mittelwert wie bei der Skill-Leiste.
        getSize: () => ({ w: cfg.wheelSize, h: cfg.wheelSize }),
        setSize: (w, h) =>
          settings.update((s) => ({
            ...s,
            wheelSize: Math.max(80, Math.min(800, (w + h) / 2)),
          })),
      });
    }
    return ts;
  }

  async function onSave(ev: CustomEvent<AppSettings>) {
    const next = ev.detail;
    settings.set(next);
    await saveSettings(next);
    // Panel offen lassen — User schließt explizit mit ESC oder X
  }
</script>

<main>
  {#if cfg.mode === "mmo" && cfg.overlayStyle === "tacho"}
    <Tacho bind:this={tachoRef} {cfg} {state} {editMode} {designMode} />
  {:else}
    <Ladder bind:this={ladderRef} {cfg} {state} {editMode} {designMode} />
  {/if}

  {#if cfg.mode === "mmo" && cfg.streamHpEnabled}
    <HpBar bind:this={hpRef} {cfg} {state} {designMode} />
  {/if}

  {#if cfg.mode === "mmo"}
    <SkillBar bind:this={skillBarRef} {cfg} {state} {editMode} {designMode} />
    <LuckyWheel
      bind:this={wheelRef}
      {cfg}
      {editMode}
      showInEditMode={showTemporaryInEdit}
    />
  {/if}

  {#if editMode}
    <Editor
      targets={editTargets}
      bind:showTemporary={showTemporaryInEdit}
      on:done={exitEditMode}
    />
  {/if}

  {#if designMode}
    <Design {cfg} on:done={exitDesignMode} />
  {/if}

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
