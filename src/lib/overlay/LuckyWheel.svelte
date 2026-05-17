<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import type { AppSettings, SkillEffect, WheelSegment } from "../types";
  import { rgbaToCss } from "../defaults";
  import {
    wheelSpin,
    wheelQueue,
    maybeStartNextSpin,
    emitSkillFire,
  } from "../stores";

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

  // Aktueller Spin-Zustand. Drei Phasen:
  //  - idle: nichts läuft
  //  - spinning: Rad dreht sich auf das (bereits feststehende) Ziel zu
  //  - result: Banner wird kurz angezeigt, dann zurück nach idle
  type ChanceSpin = {
    mode: "chance";
    chance: number;
    success: boolean;
    skillId: number;
    effects: SkillEffect[];
  };
  type SegmentSpin = {
    mode: "segments";
    segments: WheelSegment[];
    winningIndex: number;
    skillId: number;
  };
  type ActiveSpin = ChanceSpin | SegmentSpin;
  type Phase =
    | { kind: "idle" }
    | { kind: "spinning"; spin: ActiveSpin }
    | { kind: "result"; spin: ActiveSpin; resultLabel: string; success: boolean };

  let phase: Phase = { kind: "idle" };

  // Rotation und Transition-Dauer werden getrennt verwaltet — wir brauchen
  // einen "Snap zurück auf 0" ohne Transition, bevor wir auf das Ziel
  // animieren. Sonst hat der Browser keinen Anfangszustand für das CSS-
  // transition und der Wechsel ist sofort sichtbar (kein Spin).
  let rotation = 0;
  let transitionMs = 0;

  const FULL_TURNS = 5;

  // Ziel-Rotation für den 2-Sektor-Chancen-Spin (grün/rot).
  function pickChanceTargetRotation(chance: number, success: boolean): number {
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

  // Ziel-Rotation für den Multi-Segment-Spin. winningIndex = Sektor, in dem
  // der Pointer (oben, 0°) landen soll. Wir nehmen einen leicht zufälligen
  // Punkt innerhalb des Sektors, damit nicht immer exakt die Mitte trifft.
  function pickSegmentTargetRotation(
    segments: WheelSegment[],
    winningIndex: number,
  ): number {
    const total = segments.reduce(
      (a, s) => a + (Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0),
      0,
    );
    if (total <= 0) return FULL_TURNS * 360;
    let acc = 0;
    for (let i = 0; i < segments.length; i++) {
      const w = Number.isFinite(segments[i].weight) && segments[i].weight > 0
        ? segments[i].weight
        : 0;
      const start = (acc / total) * 360;
      const end = ((acc + w) / total) * 360;
      if (i === winningIndex) {
        const span = end - start;
        const x = start + span * (0.2 + Math.random() * 0.6);
        return FULL_TURNS * 360 + (360 - x);
      }
      acc += w;
    }
    return FULL_TURNS * 360;
  }

  let resultClearTimeout: number | null = null;
  let spinEndTimeout: number | null = null;

  function applyResultEffects(spin: ActiveSpin) {
    if (spin.mode === "chance") {
      if (spin.success) emitSkillFire(spin.skillId, spin.effects);
    } else {
      const seg = spin.segments[spin.winningIndex];
      if (seg && seg.effects.length > 0) {
        emitSkillFire(spin.skillId, seg.effects);
      }
    }
  }

  function resultLabelOf(spin: ActiveSpin): { label: string; success: boolean } {
    if (spin.mode === "chance") {
      return { label: spin.success ? "TREFFER" : "DANEBEN", success: spin.success };
    }
    const seg = spin.segments[spin.winningIndex];
    const win = seg ? seg.effects.length > 0 : false;
    return { label: seg?.label?.slice(0, 24) || (win ? "TREFFER" : "NIETE"), success: win };
  }

  async function startSpin(spin: ActiveSpin) {
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
    rotation =
      spin.mode === "chance"
        ? pickChanceTargetRotation(spin.chance, spin.success)
        : pickSegmentTargetRotation(spin.segments, spin.winningIndex);
    phase = { kind: "spinning", spin };

    spinEndTimeout = window.setTimeout(() => {
      if (phase.kind !== "spinning") return;
      const cur = phase.spin;
      applyResultEffects(cur);
      const r = resultLabelOf(cur);
      phase = { kind: "result", spin: cur, resultLabel: r.label, success: r.success };
      // Aktueller Spin ist durch — Slot freigeben, danach Queue weiterschieben.
      wheelSpin.set(null);
      resultClearTimeout = window.setTimeout(() => {
        phase = { kind: "idle" };
        // Queue prüfen (Race-frei nachdem der Banner weg ist).
        maybeStartNextSpin();
      }, 1400);
    }, cfg.wheelSpinDurationMs);
  }

  const unsubWheel = wheelSpin.subscribe((req) => {
    if (!req) return;
    if (phase.kind === "spinning") return;
    if (resultClearTimeout !== null) {
      clearTimeout(resultClearTimeout);
      resultClearTimeout = null;
    }
    if (spinEndTimeout !== null) {
      clearTimeout(spinEndTimeout);
      spinEndTimeout = null;
    }
    if (req.mode === "chance") {
      startSpin({
        mode: "chance",
        chance: req.chance,
        success: req.success,
        skillId: req.skillId,
        effects: req.effects,
      });
    } else {
      startSpin({
        mode: "segments",
        segments: req.segments,
        winningIndex: req.winningIndex,
        skillId: req.skillId,
      });
    }
  });

  // Falls neue Items in die Queue kommen während das Rad idle ist, sicher-
  // stellen, dass der nächste Spin angeschoben wird. (Im Normalfall macht
  // das schon enqueueWheelSpin selbst, aber wenn das Rad gerade idle wird
  // ist diese Subscription die Belt-and-Suspenders-Variante.)
  const unsubQueue = wheelQueue.subscribe((q) => {
    if (q.length > 0 && phase.kind === "idle") {
      maybeStartNextSpin();
    }
  });

  onDestroy(() => {
    unsubWheel();
    unsubQueue();
    window.removeEventListener("resize", updateSize);
    if (resultClearTimeout !== null) clearTimeout(resultClearTimeout);
    if (spinEndTimeout !== null) clearTimeout(spinEndTimeout);
  });

  $: autoScale = windowWidth / REFERENCE_WIDTH;
  $: sizePx = Math.round(cfg.wheelSize * autoScale);
  $: leftPx = Math.round(cfg.wheelX * autoScale);
  $: topPx = Math.round(cfg.wheelY * autoScale);

  // Aktive Spin-Daten für die Rendering-Helfer (Preview/Live).
  $: activeSpin =
    phase.kind === "spinning" || phase.kind === "result" ? phase.spin : null;

  // Preview-Daten im Idle-/Edit-Mode (rein optisch — kein State-Effekt).
  // Wir zeigen ein 2-Sektor-Rad mit 70% als Default.
  $: previewChance =
    activeSpin && activeSpin.mode === "chance" ? activeSpin.chance : 70;
  $: greenDeg = Math.max(2, Math.min(358, previewChance * 3.6));

  // Queue-Anzeige (Badge unten links auf dem Wheel-Banner).
  $: pendingCount = $wheelQueue.length;

  // Sichtbarkeit: Wheel-Wrap wird IMMER gerendert (für CSS-Transitionen),
  // aber per opacity verborgen, wenn weder Spin noch Edit-Vorschau aktiv.
  $: showFully = phase.kind !== "idle" || (editMode && showInEditMode);

  // Conic-Gradient-CSS für das Rad — abhängig vom Modus.
  function buildSegmentGradient(segments: WheelSegment[]): string {
    const total = segments.reduce(
      (a, s) => a + (Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0),
      0,
    );
    if (total <= 0) return "background: #1f2937;";
    let acc = 0;
    const stops: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const w =
        Number.isFinite(segments[i].weight) && segments[i].weight > 0
          ? segments[i].weight
          : 0;
      const start = (acc / total) * 360;
      const end = ((acc + w) / total) * 360;
      const col = rgbaToCss(segments[i].color);
      stops.push(`${col} ${start}deg ${end}deg`);
      acc += w;
    }
    return `background: conic-gradient(from 0deg, ${stops.join(", ")});`;
  }

  function chanceGradient(greenDegArg: number): string {
    return `background: conic-gradient(
      from 0deg,
      #22c55e 0deg,
      #16a34a ${greenDegArg * 0.5}deg,
      #22c55e ${greenDegArg}deg,
      #ef4444 ${greenDegArg}deg,
      #b91c1c ${greenDegArg + (360 - greenDegArg) * 0.5}deg,
      #ef4444 360deg
    );`;
  }

  $: wheelBgCss =
    activeSpin && activeSpin.mode === "segments"
      ? buildSegmentGradient(activeSpin.segments)
      : chanceGradient(greenDeg);

  $: wheelStyle = `
    width: ${sizePx}px;
    height: ${sizePx}px;
    ${wheelBgCss}
    transform: rotate(${rotation}deg);
    transition: transform ${transitionMs}ms cubic-bezier(0.18, 0.95, 0.22, 1);
  `;

  $: resultBannerStyle = `
    font-size: ${Math.max(18, sizePx * 0.13)}px;
  `;

  // Segment-Label-Positionen berechnen (rotiert + nach außen geschoben).
  function segmentLabels(segments: WheelSegment[], size: number) {
    const total = segments.reduce(
      (a, s) => a + (Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0),
      0,
    );
    if (total <= 0) return [];
    let acc = 0;
    const r = size / 2;
    const out: {
      label: string;
      angle: number;
      fontSize: number;
      radius: number;
    }[] = [];
    for (let i = 0; i < segments.length; i++) {
      const w =
        Number.isFinite(segments[i].weight) && segments[i].weight > 0
          ? segments[i].weight
          : 0;
      const start = (acc / total) * 360;
      const end = ((acc + w) / total) * 360;
      const center = (start + end) / 2;
      out.push({
        label: (segments[i].label || "").slice(0, 16),
        angle: center,
        fontSize: Math.max(8, Math.min(20, size * 0.045)),
        radius: r * 0.62,
      });
      acc += w;
    }
    return out;
  }

  $: labels =
    activeSpin && activeSpin.mode === "segments"
      ? segmentLabels(activeSpin.segments, sizePx)
      : [];
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
      {#if activeSpin && activeSpin.mode === "segments"}
        <!-- Segment-Trenner -->
        {#each activeSpin.segments as _seg, i}
          {@const total = activeSpin.segments.reduce(
            (a, s) => a + (Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0),
            0,
          )}
          {@const acc = activeSpin.segments
            .slice(0, i)
            .reduce(
              (a, s) => a + (Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0),
              0,
            )}
          <div
            class="divider"
            style="transform: rotate({total > 0 ? (acc / total) * 360 + 180 : 180}deg);"
          ></div>
        {/each}
        <!-- Segment-Labels -->
        {#each labels as l}
          <div
            class="seg-label"
            style="
              transform: translate(-50%, -50%) rotate({l.angle}deg) translateY(-{l.radius}px);
              font-size: {l.fontSize}px;
            "
          >
            <span style="transform: rotate({-l.angle}deg); display:inline-block;">
              {l.label}
            </span>
          </div>
        {/each}
      {:else}
        {#each Array(24) as _, i}
          <div class="spoke" style="transform: rotate({i * 15}deg);"></div>
        {/each}
      {/if}
    </div>
    <div class="wheel-rim"></div>
    <div class="wheel-hub">
      <span
        class="hub-text"
        style="font-size: {Math.max(11, sizePx * 0.08)}px;"
      >
        {#if activeSpin && activeSpin.mode === "segments"}
          ?
        {:else}
          {previewChance}%
        {/if}
      </span>
    </div>
    <div class="pointer"></div>
  </div>

  {#if phase.kind === "result"}
    <div class="result-banner {phase.success ? 'win' : 'lose'}" style={resultBannerStyle}>
      {phase.resultLabel}
    </div>
  {:else if phase.kind === "spinning"}
    <div class="result-banner spinning" style={resultBannerStyle}>
      ...
    </div>
  {:else if editMode && showInEditMode}
    <div class="result-banner edit" style={resultBannerStyle}>
      Glücksrad · Vorschau
    </div>
  {/if}

  {#if pendingCount > 0 && phase.kind !== "idle"}
    <div class="queue-badge">+{pendingCount}</div>
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
  .divider {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 2px;
    height: 50%;
    transform-origin: top center;
    background: rgba(0, 0, 0, 0.45);
    margin-left: -1px;
  }
  .seg-label {
    position: absolute;
    left: 50%;
    top: 50%;
    font-family: "LuckiestGuy", var(--font-display, system-ui), sans-serif;
    color: #fff;
    text-shadow:
      0 0 4px rgba(0, 0, 0, 0.9),
      1px 1px 0 rgba(0, 0, 0, 0.8);
    -webkit-text-stroke: 1px rgba(0, 0, 0, 0.7);
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
    line-height: 1;
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
  .queue-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 22px;
    height: 22px;
    padding: 0 7px;
    border-radius: 11px;
    background: rgba(15, 23, 42, 0.9);
    color: #fde68a;
    font-size: 12px;
    font-weight: 800;
    font-family: var(--font-mono, monospace);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #facc15;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
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
