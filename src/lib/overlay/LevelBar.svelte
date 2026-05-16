<script lang="ts">
  import type { AppSettings } from "../types";
  import { rgbaToCss } from "../defaults";
  import { imageUrlForLevel } from "../stores";

  export let cfg: AppSettings;
  export let level: number; // 1..12 (1KMH..12KMH)
  export let isActive: boolean;
  export let showGift: boolean;
  export let showTimerHere: boolean;
  export let timeLeft: number;
  export let isRunning: boolean;

  $: barWidth = cfg.barBaseWidth + (level - 1) * cfg.barWidthIncrement;
  $: barColor = rgbaToCss(cfg.levelColors[level - 1]);
  $: outline = isActive
    ? `${cfg.activeBarOutlineWidth}px solid ${rgbaToCss(cfg.activeOutlineColor)}`
    : "none";
  $: textShadow = cfg.textShadowEnabled
    ? `${cfg.textShadowOffsetX}px ${cfg.textShadowOffsetY}px 0 ${rgbaToCss(cfg.textShadowColor)}`
    : "none";
  $: outlineStyle = cfg.textOutlineEnabled
    ? buildOutline(cfg.textOutlineSize, rgbaToCss(cfg.textOutlineColor))
    : "none";
  $: giftUrl = showGift ? imageUrlForLevel(level - 1, cfg) : null;
  $: timerText = !isRunning ? "STOP" : formatTime(timeLeft);

  function buildOutline(size: number, color: string): string {
    const out: string[] = [];
    for (let dx = -size; dx <= size; dx++) {
      for (let dy = -size; dy <= size; dy++) {
        if (dx === 0 && dy === 0) continue;
        out.push(`${dx}px ${dy}px 0 ${color}`);
      }
    }
    return out.join(", ");
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
</script>

<div class="level-row" data-tauri-drag-region style="height: {cfg.barHeight + 10}px;">
  {#if cfg.mode === "simple"}
    <div
      class="label-slot"
      style="min-width: {Math.max(cfg.iconSize, 90)}px;"
    >
      {#if showTimerHere && cfg.showTimer}
        <div
          class="timer-label"
          style="
            font-size: {cfg.timerTextSize}px;
            color: {rgbaToCss(cfg.timerColor)};
            text-shadow: {textShadow}, {outlineStyle};
          "
        >
          {timerText}
        </div>
      {:else if showGift && giftUrl}
        <img
          class="gift-icon"
          style="width: {cfg.iconSize}px; height: {cfg.iconSize}px;"
          src={giftUrl}
          alt="gift {level}"
        />
      {/if}
    </div>
  {/if}

  <div
    class="bar"
    style="
      width: {barWidth}px;
      height: {cfg.barHeight}px;
      background: {barColor};
      border-radius: {cfg.barBorderRadius}px;
      outline: {outline};
      outline-offset: -{cfg.activeBarOutlineWidth}px;
      padding: {cfg.barPaddingTop}px {cfg.barPaddingRight}px {cfg.barPaddingBottom}px {cfg.barPaddingLeft}px;
    "
  >
    <div
      class="level-text"
      style="
        font-size: {cfg.levelTextSize}px;
        color: {rgbaToCss(cfg.textColor)};
        text-shadow: {textShadow}, {outlineStyle};
      "
    >
      {level}KMH
    </div>
  </div>
</div>

<style>
  .level-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .label-slot {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
  }
  .gift-icon {
    object-fit: contain;
    display: block;
  }
  .timer-label {
    line-height: 1;
    white-space: nowrap;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .level-text {
    line-height: 1;
    text-align: center;
    white-space: nowrap;
  }
</style>
