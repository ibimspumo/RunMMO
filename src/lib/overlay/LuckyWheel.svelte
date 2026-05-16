<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import type { AppSettings } from "../types";
  import { wheelSpin, emitSkillFire } from "../stores";

  export let cfg: AppSettings;
  export let editMode = false;
  export let showInEditMode = false;

  let rootEl: HTMLDivElement;
  export function getElement(): HTMLDivElement | undefined {
    return rootEl;
  }

  const REFERENCE_WIDTH = 450;
  let windowWidth = REFERENCE_WIDTH;
  function updateSize() {
    windowWidth = window.innerWidth || REFERENCE_WIDTH;
  }
  onMount(() => {
    updateSize();
    window.addEventListener("resize", updateSize);
  });

  type SpinState =
    | { phase: "idle" }
    | {
        phase: "spinning";
        chance: number;
        success: boolean;
        skillId: number;
        effects: import("../types").SkillEffect[];
      }
    | {
        phase: "result";
        success: boolean;
        chance: number;
      };
  let spin: SpinState = { phase: "idle" };
  // Rotation und Transition-Dauer werden getrennt verwaltet — wir brauchen
  // einen "Snap zurück auf 0" ohne Transition, bevor wir auf das Ziel
  // animieren. Sonst hat der Browser keinen Anfangszustand für das CSS-
  // transition und der Wechsel ist sofort sichtbar (kein Spin).
  let rotation = 0;
  let transitionMs = 0;

  const FULL_TURNS = 5;

  function pickTargetRotation(chance: number, success: boolean): number {
    const greenDeg = Math.max(2, Math.min(358, chance * 3.6));
    let x: number;
    if (success) {
      x = greenDeg * (0.15 + Math.random() * 0.7);
    } else {
      const redStart = greenDeg;
      const redSize = 360 - greenDeg;
      x = redStart + redSize * (0.15 + Math.random() * 0.7);
    }
    return FULL_TURNS * 360 + (360 - x);
  }

  let resultClearTimeout: number | null = null;
  let spinEndTimeout: number | null = null;

  async function startSpin(
    skillId: number,
    chance: number,
    success: boolean,
    effects: import("../types").SkillEffect[],
  ) {
    // Phase 1: Snap zurück auf 0 ohne Transition.
    transitionMs = 0;
    rotation = 0;
    await tick();
    // Ein zusätzlicher rAF, damit der Browser die transition: 0ms Regel
    // wirklich anwendet, bevor wir das Ziel setzen.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    // Phase 2: Ziel-Rotation mit voller Spin-Dauer.
    transitionMs = cfg.wheelSpinDurationMs;
    rotation = pickTargetRotation(chance, success);
    spin = { phase: "spinning", chance, success, skillId, effects };

    spinEndTimeout = window.setTimeout(() => {
      if (spin.phase !== "spinning") return;
      if (spin.success) emitSkillFire(spin.skillId, spin.effects);
      spin = { phase: "result", success: spin.success, chance: spin.chance };
      wheelSpin.set(null);
      resultClearTimeout = window.setTimeout(() => {
        spin = { phase: "idle" };
      }, 1400);
    }, cfg.wheelSpinDurationMs);
  }

  const unsubWheel = wheelSpin.subscribe((req) => {
    if (!req) return;
    if (spin.phase === "spinning") return;
    if (resultClearTimeout !== null) {
      clearTimeout(resultClearTimeout);
      resultClearTimeout = null;
    }
    if (spinEndTimeout !== null) {
      clearTimeout(spinEndTimeout);
      spinEndTimeout = null;
    }
    startSpin(req.skillId, req.chance, req.success, req.effects);
  });

  onDestroy(() => {
    unsubWheel();
    window.removeEventListener("resize", updateSize);
    if (resultClearTimeout !== null) clearTimeout(resultClearTimeout);
    if (spinEndTimeout !== null) clearTimeout(spinEndTimeout);
  });

  $: autoScale = windowWidth / REFERENCE_WIDTH;
  $: sizePx = Math.round(cfg.wheelSize * autoScale);
  $: leftPx = Math.round(cfg.wheelX * autoScale);
  $: topPx = Math.round(cfg.wheelY * autoScale);

  // Sichtbarkeit: Wheel-Wrap wird IMMER gerendert (für CSS-Transitionen),
  // aber per opacity verborgen, wenn weder Spin noch Edit-Vorschau aktiv.
  $: showFully =
    spin.phase !== "idle" || (editMode && showInEditMode);

  $: previewChance =
    spin.phase === "spinning"
      ? spin.chance
      : spin.phase === "result"
        ? spin.chance
        : 70;
  $: greenDeg = Math.max(2, Math.min(358, previewChance * 3.6));

  $: wheelStyle = `
    width: ${sizePx}px;
    height: ${sizePx}px;
    background: conic-gradient(
      from 0deg,
      #22c55e 0deg,
      #16a34a ${greenDeg * 0.5}deg,
      #22c55e ${greenDeg}deg,
      #ef4444 ${greenDeg}deg,
      #b91c1c ${greenDeg + (360 - greenDeg) * 0.5}deg,
      #ef4444 360deg
    );
    transform: rotate(${rotation}deg);
    transition: transform ${transitionMs}ms cubic-bezier(0.18, 0.95, 0.22, 1);
  `;

  $: resultBannerStyle = `
    font-size: ${Math.max(18, sizePx * 0.13)}px;
  `;
</script>

<div
  class="wheel-wrap"
  class:hidden={!showFully}
  bind:this={rootEl}
  style="
    left: {leftPx}px;
    top: {topPx}px;
    width: {sizePx}px;
    height: {sizePx + 80}px;
  "
>
  <div class="wheel-frame" style="width: {sizePx}px; height: {sizePx}px;">
    <div class="wheel" style={wheelStyle}>
      {#each Array(24) as _, i}
        <div class="spoke" style="transform: rotate({i * 15}deg);"></div>
      {/each}
    </div>
    <div class="wheel-rim"></div>
    <div class="wheel-hub">
      <span class="hub-text" style="font-size: {Math.max(11, sizePx * 0.08)}px;">
        {previewChance}%
      </span>
    </div>
    <div class="pointer"></div>
  </div>

  {#if spin.phase === "result"}
    <div class="result-banner {spin.success ? 'win' : 'lose'}" style={resultBannerStyle}>
      {spin.success ? "TREFFER" : "DANEBEN"}
    </div>
  {:else if spin.phase === "spinning"}
    <div class="result-banner spinning" style={resultBannerStyle}>
      ...
    </div>
  {:else if editMode && showInEditMode}
    <div class="result-banner edit" style={resultBannerStyle}>
      Glücksrad · {previewChance}% Vorschau
    </div>
  {/if}
</div>

<style>
  .wheel-wrap {
    position: absolute;
    pointer-events: none;
    z-index: 8;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: opacity 220ms ease-out;
  }
  .wheel-wrap.hidden {
    opacity: 0;
    pointer-events: none;
  }
  .wheel-frame {
    position: relative;
    flex-shrink: 0;
  }
  .wheel {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    will-change: transform;
    box-shadow:
      inset 0 0 30px rgba(0, 0, 0, 0.5),
      0 12px 28px rgba(0, 0, 0, 0.5);
  }
  .spoke {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 1px;
    height: 50%;
    transform-origin: top center;
    background: rgba(255, 255, 255, 0.16);
    margin-left: -0.5px;
  }
  .wheel-rim {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    pointer-events: none;
    border: 6px solid #facc15;
    box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.6),
      inset 0 0 0 2px rgba(0, 0, 0, 0.4),
      0 0 18px rgba(250, 204, 21, 0.45);
  }
  .wheel-hub {
    position: absolute;
    width: 20%;
    height: 20%;
    left: 40%;
    top: 40%;
    border-radius: 50%;
    background:
      radial-gradient(circle at 35% 30%, #fde68a 0%, #f59e0b 50%, #b45309 100%);
    border: 3px solid #1f2937;
    box-shadow:
      0 4px 10px rgba(0, 0, 0, 0.55),
      inset 0 1px 2px rgba(255, 255, 255, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hub-text {
    font-family: "LuckiestGuy", var(--font-display, system-ui), sans-serif;
    color: #1f2937;
    font-weight: 800;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
    line-height: 1;
  }
  .pointer {
    position: absolute;
    top: -6px;
    left: 50%;
    width: 0;
    height: 0;
    border-left: 14px solid transparent;
    border-right: 14px solid transparent;
    border-top: 26px solid #facc15;
    transform: translateX(-50%);
    filter: drop-shadow(0 4px 4px rgba(0, 0, 0, 0.6));
    z-index: 2;
  }
  .pointer::after {
    content: "";
    position: absolute;
    top: -28px;
    left: -3px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #b45309;
    box-shadow: 0 0 0 2px #facc15;
  }
  .result-banner {
    margin-top: 14px;
    padding: 6px 14px;
    border-radius: 8px;
    font-family: "LuckiestGuy", var(--font-display, system-ui), sans-serif;
    font-weight: 900;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    background: rgba(15, 23, 42, 0.85);
    color: white;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
    border: 2px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
  }
  .result-banner.win {
    background: linear-gradient(180deg, #22c55e 0%, #15803d 100%);
    border-color: #bbf7d0;
    animation: pop 220ms ease-out;
  }
  .result-banner.lose {
    background: linear-gradient(180deg, #ef4444 0%, #991b1b 100%);
    border-color: #fecaca;
    animation: pop 220ms ease-out;
  }
  .result-banner.spinning {
    background: rgba(15, 23, 42, 0.75);
    border-color: rgba(255, 255, 255, 0.25);
    color: #fde68a;
  }
  .result-banner.edit {
    background: rgba(56, 189, 248, 0.18);
    border-color: rgba(56, 189, 248, 0.6);
    color: #e0f2fe;
    font-size: 12px !important;
    letter-spacing: 0.3px;
    text-transform: none;
  }
  @keyframes pop {
    0% {
      transform: scale(0.6);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
