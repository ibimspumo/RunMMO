<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import LevelBar from "./LevelBar.svelte";
  import type { AppSettings, LadderState } from "../types";

  export let cfg: AppSettings;
  export let state: LadderState;
  export let editMode = false;

  // DOM-Ref des inneren .ladder-Elements (für Editor-Bbox-Messung).
  let innerEl: HTMLDivElement;
  export function getElement(): HTMLDivElement | undefined {
    return innerEl;
  }

  $: rows = Array.from({ length: 12 }, (_, i) => 12 - i);
  $: currentLevel1Based = state.currentLevel + 1;

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
  $: effectiveScale = cfg.ladderScale * autoScale;
  $: effectiveOffsetLeft = cfg.ladderX * autoScale;
  $: effectiveOffsetTop = cfg.ladderY * autoScale;
</script>

<div class="ladder-wrap" data-tauri-drag-region={editMode ? null : true}>
  <div
    class="ladder"
    bind:this={innerEl}
    data-tauri-drag-region={editMode ? null : true}
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
