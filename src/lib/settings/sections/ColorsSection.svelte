<script lang="ts">
  import type { AppSettings, RGBA } from "../../types";
  import { hexToRgba, rgbaToHex } from "../../defaults";

  export let cfg: AppSettings;

  function bindColor(get: () => RGBA, set: (v: RGBA) => void) {
    return {
      get hex() {
        return rgbaToHex(get());
      },
      setHex(h: string) {
        set({ ...hexToRgba(h), a: get().a });
      },
      get alpha() {
        return get().a;
      },
      setAlpha(a: number) {
        set({ ...get(), a });
      },
    };
  }

  function setLevelColor(i: number, h: string) {
    cfg.levelColors[i] = { ...hexToRgba(h), a: cfg.levelColors[i].a };
    cfg = cfg;
  }
  function setLevelAlpha(i: number, a: number) {
    cfg.levelColors[i] = { ...cfg.levelColors[i], a };
    cfg = cfg;
  }
</script>

<h2>Balken-Farben (12 Levels)</h2>
<div class="grid">
  {#each cfg.levelColors as col, i}
    <div class="color-row">
      <span class="label">{i + 1}KMH</span>
      <input
        type="color"
        value={rgbaToHex(col)}
        on:input={(e) => setLevelColor(i, e.currentTarget.value)}
      />
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={col.a}
        on:input={(e) => setLevelAlpha(i, parseFloat(e.currentTarget.value))}
      />
      <span class="alpha">{col.a.toFixed(2)}</span>
    </div>
  {/each}
</div>

<h2>Weitere Farben</h2>
<div class="grid">
  <div class="color-row">
    <span class="label">Inaktiv</span>
    <input
      type="color"
      value={rgbaToHex(cfg.inactiveBarColor)}
      on:input={(e) =>
        (cfg.inactiveBarColor = { ...hexToRgba(e.currentTarget.value), a: cfg.inactiveBarColor.a })}
    />
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      bind:value={cfg.inactiveBarColor.a}
    />
    <span class="alpha">{cfg.inactiveBarColor.a.toFixed(2)}</span>
  </div>

  <div class="color-row">
    <span class="label">Aktiv-Rahmen</span>
    <input
      type="color"
      value={rgbaToHex(cfg.activeOutlineColor)}
      on:input={(e) =>
        (cfg.activeOutlineColor = { ...hexToRgba(e.currentTarget.value), a: cfg.activeOutlineColor.a })}
    />
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      bind:value={cfg.activeOutlineColor.a}
    />
    <span class="alpha">{cfg.activeOutlineColor.a.toFixed(2)}</span>
  </div>

  <div class="color-row">
    <span class="label">Level-Text</span>
    <input
      type="color"
      value={rgbaToHex(cfg.textColor)}
      on:input={(e) =>
        (cfg.textColor = { ...hexToRgba(e.currentTarget.value), a: cfg.textColor.a })}
    />
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      bind:value={cfg.textColor.a}
    />
    <span class="alpha">{cfg.textColor.a.toFixed(2)}</span>
  </div>

  <div class="color-row">
    <span class="label">Timer-Text</span>
    <input
      type="color"
      value={rgbaToHex(cfg.timerColor)}
      on:input={(e) =>
        (cfg.timerColor = { ...hexToRgba(e.currentTarget.value), a: cfg.timerColor.a })}
    />
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      bind:value={cfg.timerColor.a}
    />
    <span class="alpha">{cfg.timerColor.a.toFixed(2)}</span>
  </div>
</div>

<style>
  h2 {
    font-size: 14px;
    margin: 8px 0 8px;
    font-family: system-ui, sans-serif;
  }
  .grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .color-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 6px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 3px;
  }
  .label {
    font-size: 11px;
    color: #ddd;
    width: 90px;
    flex-shrink: 0;
  }
  input[type="color"] {
    width: 32px;
    height: 24px;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
  }
  input[type="range"] {
    flex: 1;
  }
  .alpha {
    font-size: 10px;
    color: #999;
    width: 32px;
    text-align: right;
  }
</style>
