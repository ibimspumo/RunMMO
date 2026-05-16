<script lang="ts">
  import type { AppSettings } from "../../types";
  import { hexToRgba, rgbaToHex } from "../../defaults";

  export let cfg: AppSettings;
</script>

<h2>Text-Styling</h2>

<div class="field">
  <label>Level-Text Größe</label>
  <input type="number" min="6" max="200" bind:value={cfg.levelTextSize} />
</div>

<div class="field">
  <label>Timer-Text Größe</label>
  <input type="number" min="6" max="200" bind:value={cfg.timerTextSize} />
</div>

<h3>Schatten</h3>
<div class="field">
  <label>
    <input type="checkbox" bind:checked={cfg.textShadowEnabled} />
    Text-Schatten aktiv
  </label>
</div>
<div class="field-row">
  <div class="field">
    <label>Schatten-Farbe</label>
    <input
      type="color"
      value={rgbaToHex(cfg.textShadowColor)}
      on:input={(e) =>
        (cfg.textShadowColor = { ...hexToRgba(e.currentTarget.value), a: cfg.textShadowColor.a })}
    />
  </div>
  <div class="field">
    <label>Alpha</label>
    <input type="range" min="0" max="1" step="0.01" bind:value={cfg.textShadowColor.a} />
    <span class="value">{cfg.textShadowColor.a.toFixed(2)}</span>
  </div>
</div>
<div class="field-row">
  <div class="field">
    <label>Offset X</label>
    <input type="number" min="-50" max="50" bind:value={cfg.textShadowOffsetX} />
  </div>
  <div class="field">
    <label>Offset Y</label>
    <input type="number" min="-50" max="50" bind:value={cfg.textShadowOffsetY} />
  </div>
</div>

<h3>Outline</h3>
<div class="field">
  <label>
    <input type="checkbox" bind:checked={cfg.textOutlineEnabled} />
    Text-Outline aktiv
  </label>
</div>
<div class="field-row">
  <div class="field">
    <label>Outline-Farbe</label>
    <input
      type="color"
      value={rgbaToHex(cfg.textOutlineColor)}
      on:input={(e) =>
        (cfg.textOutlineColor = { ...hexToRgba(e.currentTarget.value), a: cfg.textOutlineColor.a })}
    />
  </div>
  <div class="field">
    <label>Outline-Stärke (px)</label>
    <input type="number" min="0" max="20" bind:value={cfg.textOutlineSize} />
  </div>
</div>

<style>
  h2 {
    font-size: 14px;
    margin-bottom: 12px;
    font-family: system-ui, sans-serif;
  }
  h3 {
    font-size: 12px;
    margin: 16px 0 8px;
    color: #ddd;
    font-family: system-ui, sans-serif;
    border-top: 1px solid #333;
    padding-top: 10px;
  }
  .field {
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
  }
  .field-row {
    display: flex;
    gap: 16px;
  }
  .field-row .field {
    flex: 1;
  }
  label {
    font-size: 11px;
    color: #ddd;
    margin-bottom: 4px;
  }
  input[type="number"] {
    background: #1a1a20;
    color: #eee;
    border: 1px solid #333;
    border-radius: 3px;
    padding: 4px 8px;
    width: 100px;
  }
  input[type="color"] {
    width: 50px;
    height: 28px;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
  }
  input[type="checkbox"] {
    margin-right: 6px;
    vertical-align: middle;
  }
  .value {
    font-size: 11px;
    color: #999;
  }
</style>
