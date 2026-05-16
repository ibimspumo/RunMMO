<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { AppSettings, LadderState } from "../types";
  import { rgbaToCss } from "../defaults";

  export let cfg: AppSettings;
  export let state: LadderState;

  // DOM-Ref für Editor-Bbox.
  let innerEl: HTMLDivElement;
  export function getElement(): HTMLDivElement | undefined {
    return innerEl;
  }

  // Auto-Skalierung analog zur Ladder (Referenz 450px breit = 1.0)
  const REFERENCE_WIDTH = 450;
  let windowWidth = REFERENCE_WIDTH;

  function updateSize() {
    windowWidth = window.innerWidth || REFERENCE_WIDTH;
  }

  onMount(() => {
    updateSize();
    window.addEventListener("resize", updateSize);
  });
  onDestroy(() => {
    window.removeEventListener("resize", updateSize);
  });

  $: autoScale = windowWidth / REFERENCE_WIDTH;
  $: barWidth = cfg.hpWidth * autoScale;
  $: barHeight = cfg.hpHeight * autoScale;
  $: leftPx = Math.round(cfg.hpX * autoScale);
  $: topPx = Math.round(cfg.hpY * autoScale);
  // Radius mit autoScale skalieren, aber auf halbe Höhe begrenzen (sonst Render-Artefakte).
  $: radiusPx = Math.max(0, Math.min(barHeight / 2, cfg.streamHpBorderRadius * autoScale));
  // Innenradius leicht kleiner, damit Fill nicht über den Rand des Tracks ragt.
  $: innerRadius = Math.max(0, radiusPx - 2);

  $: maxHp = Math.max(1, cfg.streamHpMax);
  $: hpPct = Math.max(0, Math.min(1, state.hp / maxHp));
  $: fillPx = Math.max(0, barWidth * hpPct);

  $: fillBase = rgbaToCss(cfg.streamHpFillColor);
  // Sanftes Highlight (helleres Grün oben) für den MMO-Look
  $: fillGradient = `linear-gradient(to bottom,
      rgba(255,255,255,0.35) 0%,
      ${fillBase} 45%,
      ${fillBase} 100%)`;

  $: hpText = `${Math.ceil(state.hp)} / ${maxHp}`;
  $: textPx = Math.max(12, barHeight * 0.65);

  // Aktuelle Decay-Rate für das laufende Level — smart formatiert.
  $: currentLevel1Based = Math.max(1, Math.min(12, state.currentLevel + 1));
  $: secondsPerHp = (() => {
    const v = cfg.streamHpSecondsPerHpByLevel?.[currentLevel1Based - 1];
    return typeof v === "number" && v > 0 ? v : 0;
  })();
  $: decayText = formatDecay(secondsPerHp);
  $: decayPx = Math.max(10, barHeight * 0.38);

  function formatDecay(s: number): string {
    if (!s || !isFinite(s) || s <= 0) return "";
    if (s <= 1) {
      // Schnell: HP pro Sekunde
      const hpPerSec = 1 / s;
      const formatted = hpPerSec >= 10
        ? hpPerSec.toFixed(0)
        : hpPerSec.toFixed(1).replace(/\.0$/, "");
      return `−${formatted} HP/s`;
    }
    // Langsam: 1 HP pro X Sekunden
    const formatted = s >= 10 ? s.toFixed(0) : s.toFixed(1).replace(/\.0$/, "");
    return `−1 HP / ${formatted}s`;
  }
</script>

<div
  class="hp-wrap"
  bind:this={innerEl}
  style="
    left: {leftPx}px;
    top: {topPx}px;
    width: {barWidth}px;
  "
>
  <div
    class="hp-track"
    style="
      height: {barHeight}px;
      background: {rgbaToCss(cfg.streamHpBgColor)};
      border-color: {rgbaToCss(cfg.streamHpBorderColor)};
      border-radius: {radiusPx}px;
    "
  >
    <div
      class="hp-fill"
      style="
        width: {fillPx}px;
        background: {fillGradient};
        border-radius: {innerRadius}px;
      "
    ></div>
    {#if cfg.streamHpShowNumbers}
      <span
        class="hp-text"
        style="
          color: {rgbaToCss(cfg.streamHpTextColor)};
          font-size: {textPx}px;
        "
      >
        {hpText}
      </span>
    {/if}
  </div>

  {#if cfg.streamHpShowDecayRate && decayText}
    <span
      class="decay-text"
      style="
        color: {rgbaToCss(cfg.streamHpTextColor)};
        font-size: {decayPx}px;
      "
    >
      {decayText}
    </span>
  {/if}
</div>

<style>
  .hp-wrap {
    position: absolute;
    pointer-events: none;
    z-index: 5;
  }
  .hp-track {
    position: relative;
    width: 100%;
    border-style: solid;
    border-width: 2px;
    overflow: hidden;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
  }
  .hp-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    transition: width 120ms linear;
    box-shadow: inset 0 -2px 4px rgba(0, 0, 0, 0.25);
  }
  .hp-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "LuckiestGuy", var(--font-display, system-ui), sans-serif;
    letter-spacing: 1px;
    line-height: 1;
    text-shadow:
      2px 2px 0 rgba(0, 0, 0, 0.9),
      -1px -1px 0 rgba(0, 0, 0, 0.6),
      0 0 4px rgba(0, 0, 0, 0.5);
    -webkit-text-stroke: 1px rgba(0, 0, 0, 0.85);
    user-select: none;
  }
  .decay-text {
    display: block;
    margin-top: 6px;
    text-align: center;
    font-family: "LuckiestGuy", var(--font-display, system-ui), sans-serif;
    letter-spacing: 0.5px;
    line-height: 1;
    opacity: 0.92;
    text-shadow:
      1px 1px 0 rgba(0, 0, 0, 0.9),
      -1px -1px 0 rgba(0, 0, 0, 0.55),
      0 0 3px rgba(0, 0, 0, 0.5);
    -webkit-text-stroke: 1px rgba(0, 0, 0, 0.75);
    user-select: none;
  }
</style>
