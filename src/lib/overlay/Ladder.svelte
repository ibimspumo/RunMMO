<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import LevelBar from "./LevelBar.svelte";
  import type { AppSettings, LadderState } from "../types";

  export let cfg: AppSettings;
  export let state: LadderState;

  // Anzeige von oben nach unten: 12KMH oben, 1KMH unten
  $: rows = Array.from({ length: 12 }, (_, i) => 12 - i);
  $: currentLevel1Based = state.currentLevel + 1;

  // Auto-Skalierung: bezogen auf Default-Fenster (450px breit = 1.0).
  // Bei größerem Fenster wachsen alle Inhalte proportional mit.
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
  $: effectiveScale = cfg.overlayScale * autoScale;
  $: effectiveOffsetLeft = cfg.overlayOffsetLeft * autoScale;
  $: effectiveOffsetTop = cfg.overlayOffsetTop * autoScale;
</script>

<div class="ladder-wrap" data-tauri-drag-region>
  <div
    class="ladder"
    data-tauri-drag-region
    style="
      gap: {cfg.spacingBetweenLevels}px;
      transform: translate({effectiveOffsetLeft}px, {effectiveOffsetTop}px) scale({effectiveScale});
    "
  >
    {#each rows as level (level)}
      {@const isActive = level === currentLevel1Based}
      {@const isAdjacentUp = level === currentLevel1Based + 1}
      {@const isAdjacentDown = level === currentLevel1Based - 1}
      <LevelBar
        {cfg}
        {level}
        {isActive}
        showGift={isAdjacentUp || isAdjacentDown}
        showTimerHere={isActive}
        timeLeft={state.timeLeft}
        isRunning={state.isRunning}
      />
    {/each}
  </div>
</div>

<style>
  .ladder-wrap {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .ladder {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    transform-origin: top left;
    width: max-content;
  }
</style>
