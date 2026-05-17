<script lang="ts">
  // Buff-Leiste: zeigt aktive temporäre Status-Effekte als Pills/Badges.
  //  - Level-Override: "→7 KMH  0:18"
  //  - HP-Freeze:      "❄ Freeze  0:18"
  //  - HoT/DoT:        "+5/s  0:18" bzw. "−5/s  0:18"
  // Multiplikatoren laufen über das eigene Widget `MultiplierDisplay` und
  // erscheinen hier *nicht* mehr als Pill. Wird nur gerendert, wenn
  // mindestens ein Effekt aktiv ist (oder im Edit-Modus mit "Temp"-Toggle
  // für Positionierung).

  import { onMount, onDestroy } from "svelte";
  import type { AppSettings } from "../types";
  import { rgbaToCss } from "../defaults";
  import {
    activeLevelOverride,
    activeHpFreezes,
    activeHpDots,
  } from "../stores";

  export let cfg: AppSettings;
  export let editMode = false;
  export let designMode = false;
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

  // Hochfrequentes Re-Render für Countdown-Sekunden.
  let nowMs = Date.now();
  let rafHandle: number | null = null;
  function tick() {
    nowMs = Date.now();
    rafHandle = requestAnimationFrame(tick);
  }

  onMount(() => {
    updateSize();
    window.addEventListener("resize", updateSize);
    rafHandle = requestAnimationFrame(tick);
  });
  onDestroy(() => {
    window.removeEventListener("resize", updateSize);
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
  });

  function formatMs(ms: number): string {
    const s = Math.max(0, Math.ceil(ms / 1000));
    if (s < 60) return `0:${String(s).padStart(2, "0")}`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, "0")}`;
  }

  $: autoScale = windowWidth / REFERENCE_WIDTH;
  $: leftPx = Math.round(cfg.buffBarX * autoScale);
  $: topPx = Math.round(cfg.buffBarY * autoScale);
  $: heightPx = Math.round(cfg.buffBarSize * autoScale);
  $: gapPx = Math.round(cfg.buffBarGap * autoScale);
  // Text-Größe: explizit aus Settings, oder 0 = auto aus Pill-Höhe.
  $: fontPx =
    cfg.buffBarTextSize > 0
      ? Math.max(6, Math.round(cfg.buffBarTextSize * autoScale))
      : Math.max(10, Math.round(heightPx * 0.52));

  // Text-Schatten + Outline
  $: pillTextShadow = cfg.buffBarTextShadowEnabled
    ? `${cfg.buffBarTextShadowOffsetX}px ${cfg.buffBarTextShadowOffsetY}px ${cfg.buffBarTextShadowBlur}px ${rgbaToCss(cfg.buffBarTextShadowColor)}`
    : "none";
  $: pillTextStroke = cfg.buffBarTextOutlineEnabled
    ? `${cfg.buffBarTextOutlineSize}px ${rgbaToCss(cfg.buffBarTextOutlineColor)}`
    : "0 transparent";

  // Container-Schatten + Umrandung
  $: pillBoxShadow = cfg.buffBarShadowEnabled
    ? `${cfg.buffBarShadowOffsetX}px ${cfg.buffBarShadowOffsetY}px ${cfg.buffBarShadowBlur}px ${rgbaToCss(cfg.buffBarShadowColor)}`
    : "none";
  $: pillBorderWidthPx = cfg.buffBarBorderEnabled
    ? Math.max(0, cfg.buffBarBorderWidth)
    : 0;

  // Auto-tick zwingt $: pills bei jedem Frame neu zu evaluieren (für Countdown).
  $: pills = (() => {
    void nowMs; // dependency
    const list: { key: string; icon: string; text: string; tone: "buff" | "info" }[] = [];
    const ov = $activeLevelOverride;
    if (ov) {
      const left = ov.expiresAtMs - nowMs;
      list.push({
        key: "lvl-override",
        icon: "→",
        text: `${ov.visibleLevel0 + 1} KMH  ${formatMs(left)}`,
        tone: "info",
      });
    }
    for (const f of $activeHpFreezes) {
      const left = f.expiresAtMs - nowMs;
      if (left <= 0) continue;
      list.push({
        key: f.id,
        icon: "❄",
        text: `Freeze  ${formatMs(left)}`,
        tone: "info",
      });
    }
    for (const d of $activeHpDots) {
      const left = d.expiresAtMs - nowMs;
      if (left <= 0) continue;
      const sign = d.kind === "healOverTime" ? "+" : "−";
      list.push({
        key: d.id,
        icon: sign,
        text: `${sign}${d.amountPerSec}/s  ${formatMs(left)}`,
        tone: "buff",
      });
    }
    return list;
  })();

  // Sichtbarkeit
  $: showFully = pills.length > 0 || (editMode && showInEditMode);

  $: bgCss = rgbaToCss(cfg.buffBarBgColor);
  $: textCss = rgbaToCss(cfg.buffBarTextColor);
  $: borderCss = rgbaToCss(cfg.buffBarBorderColor);
</script>

<div
  class="buffbar"
  class:hidden={!showFully}
  bind:this={rootEl}
  data-tauri-drag-region={editMode || designMode ? null : true}
  style="
    left: {leftPx}px;
    top: {topPx}px;
    gap: {gapPx}px;
    --pill-h: {heightPx}px;
    --pill-fs: {fontPx}px;
    --pill-bg: {bgCss};
    --pill-fg: {textCss};
    --pill-border: {borderCss};
    --pill-border-w: {pillBorderWidthPx}px;
    --pill-shadow: {pillBoxShadow};
    --pill-text-shadow: {pillTextShadow};
    --pill-text-stroke: {pillTextStroke};
  "
>
  {#if pills.length === 0 && editMode && showInEditMode}
    <div class="pill placeholder" data-design-target={designMode ? "buffbar.pill" : null}>
      <span class="pill-text">Buff-Leiste</span>
    </div>
  {/if}

  {#each pills as p (p.key)}
    <div
      class="pill"
      class:buff={p.tone === "buff"}
      class:info={p.tone === "info"}
      data-design-target={designMode ? "buffbar.pill" : null}
    >
      {#if cfg.buffBarShowIcon}
        <span class="pill-icon">{p.icon}</span>
      {/if}
      <span class="pill-text">{p.text}</span>
    </div>
  {/each}
</div>

<style>
  .buffbar {
    position: absolute;
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    pointer-events: none;
    z-index: 7;
    transition: opacity 220ms ease-out;
  }
  .buffbar.hidden {
    opacity: 0;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: var(--pill-h);
    padding: 0 calc(var(--pill-h) * 0.45);
    border-radius: 999px;
    background: var(--pill-bg);
    color: var(--pill-fg);
    border-style: solid;
    border-width: var(--pill-border-w);
    border-color: var(--pill-border);
    font-family: "LuckiestGuy", var(--font-display, system-ui), sans-serif;
    font-size: var(--pill-fs);
    line-height: 1;
    box-shadow: var(--pill-shadow);
    text-shadow: var(--pill-text-shadow);
    -webkit-text-stroke: var(--pill-text-stroke);
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
  }
  .pill.placeholder {
    background: rgba(56, 189, 248, 0.15);
    border-color: rgba(56, 189, 248, 0.55);
    color: #e0f2fe;
  }
  .pill-icon {
    font-size: calc(var(--pill-fs) * 1.05);
  }
  .pill-text {
    letter-spacing: 0.4px;
  }
</style>
