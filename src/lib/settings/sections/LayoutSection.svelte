<script lang="ts">
  import type { AppSettings } from "../../types";
  export let cfg: AppSettings;

  const fields: { key: keyof AppSettings; label: string; min: number; max: number; step?: number }[] = [
    { key: "barBaseWidth", label: "Balken Basis-Breite (px)", min: 10, max: 1000 },
    { key: "barWidthIncrement", label: "Breite pro Level (px)", min: 0, max: 500 },
    { key: "barHeight", label: "Balken-Höhe (px)", min: 5, max: 300 },
    { key: "barBorderRadius", label: "Balken Border-Radius (px)", min: 0, max: 100 },
    { key: "barPaddingTop", label: "Padding oben", min: 0, max: 100 },
    { key: "barPaddingBottom", label: "Padding unten", min: 0, max: 100 },
    { key: "barPaddingLeft", label: "Padding links", min: 0, max: 100 },
    { key: "barPaddingRight", label: "Padding rechts", min: 0, max: 100 },
    { key: "iconSize", label: "Icon-Größe (px)", min: 5, max: 200 },
    { key: "spacingBetweenLevels", label: "Abstand zwischen Levels", min: 0, max: 100 },
    { key: "activeBarOutlineWidth", label: "Aktiv-Rahmen Breite", min: 0, max: 20 },
  ];

  const overlayFields: { key: keyof AppSettings; label: string; min: number; max: number; step: number }[] = [
    { key: "overlayScale", label: "Overlay Skalierung (1.0 = 100%)", min: 0.1, max: 2.0, step: 0.05 },
    { key: "overlayOffsetLeft", label: "Offset von links (px)", min: 0, max: 4000, step: 1 },
    { key: "overlayOffsetTop", label: "Offset von oben (px)", min: 0, max: 4000, step: 1 },
  ];
</script>

<h2>Overlay-Position</h2>
<p class="hint">
  Für Fullscreen-Overlay-Setup. Skaliert die komplette Leiter und positioniert sie
  vom oberen-linken Fensterrand aus. Die Werte sind als Referenz bei 450px
  Fensterbreite — bei größerem Fenster wachsen sie automatisch proportional mit.
</p>

{#each overlayFields as f}
  <div class="field">
    <label>{f.label}</label>
    <input
      type="number"
      min={f.min}
      max={f.max}
      step={f.step}
      bind:value={cfg[f.key]}
    />
  </div>
{/each}

<h2 style="margin-top: 18px;">Layout der Balken</h2>

{#each fields as f}
  <div class="field">
    <label>{f.label}</label>
    <input
      type="number"
      min={f.min}
      max={f.max}
      step={f.step ?? 1}
      bind:value={cfg[f.key]}
    />
  </div>
{/each}

<style>
  h2 {
    font-size: 14px;
    margin-bottom: 8px;
    font-family: system-ui, sans-serif;
  }
  .hint {
    font-size: 10px;
    color: #888;
    margin-bottom: 10px;
    line-height: 1.4;
  }
  .field {
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  label {
    font-size: 11px;
    color: #ddd;
    flex: 1;
  }
  input[type="number"] {
    background: #1a1a20;
    color: #eee;
    border: 1px solid #333;
    border-radius: 3px;
    padding: 4px 8px;
    width: 100px;
  }
</style>
