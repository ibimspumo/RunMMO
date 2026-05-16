<script lang="ts">
  import type { AppSettings } from "../../types";
  import { Callout, Card, ColorField, SectionHeader } from "../../ui";

  export let cfg: AppSettings;
</script>

<SectionHeader
  title="Level-Farben"
  description="Eine Farbe pro KMH-Level. Definiert die inhaltliche Farbkodierung der Leiter — die rein dekorativen Style-Farben (Text-, Rand-, Hintergrund-Farben usw.) findest du im Design-Modus."
/>

<Card title="Level-Balken (12 Levels)">
  {#each cfg.levelColors as _, i}
    <div class="row">
      <span class="label">{i + 1} KMH</span>
      <ColorField bind:value={cfg.levelColors[i]} />
    </div>
  {/each}
</Card>

<Callout variant="info">
  Inaktiv-Balken, Aktiv-Rahmen, Text-/Timer-Farben, Schatten, Outline und alle anderen
  visuellen Stil-Einstellungen findest du im <strong>Design-Modus</strong>
  (Taste <code>D</code>) — direkt am Overlay-Element klicken.
</Callout>

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
  code {
    background: var(--c-bg-2);
    padding: 1px 5px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.9em;
  }
</style>
