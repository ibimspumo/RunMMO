<script lang="ts">
  import type { AppSettings } from "../../types";
  import { Card, ColorField, SectionHeader } from "../../ui";

  export let cfg: AppSettings;
</script>

<SectionHeader
  title="Farben"
  description="Farbtöne und Deckkraft für Balken, Rahmen und Texte."
/>

<Card title="Level-Balken (12 Levels)">
  {#each cfg.levelColors as _, i}
    <div class="row">
      <span class="label">{i + 1} KMH</span>
      <ColorField bind:value={cfg.levelColors[i]} />
    </div>
  {/each}
</Card>

<Card title="Weitere Farben">
  <div class="row">
    <span class="label">Inaktiv-Balken</span>
    <ColorField bind:value={cfg.inactiveBarColor} />
  </div>
  <div class="row">
    <span class="label">Aktiv-Rahmen</span>
    <ColorField bind:value={cfg.activeOutlineColor} />
  </div>
  <div class="row">
    <span class="label">Level-Text</span>
    <ColorField bind:value={cfg.textColor} />
  </div>
  <div class="row">
    <span class="label">Timer-Text</span>
    <ColorField bind:value={cfg.timerColor} />
  </div>
</Card>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-width: 0;
  }
  .label {
    font-size: var(--fs-sm);
    color: var(--c-text);
    width: 96px;
    flex-shrink: 0;
  }
</style>
