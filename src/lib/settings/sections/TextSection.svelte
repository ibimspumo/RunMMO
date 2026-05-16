<script lang="ts">
  import type { AppSettings } from "../../types";
  import { Card, ColorField, Field, NumberInput, SectionHeader, Toggle } from "../../ui";

  export let cfg: AppSettings;
</script>

<SectionHeader
  title="Text-Styling"
  description="Schriftgrößen und Effekte (Schatten / Outline) für Level- und Timer-Anzeige."
/>

<Card title="Schriftgrößen">
  <div class="grid">
    <Field label="Level-Text">
      <NumberInput bind:value={cfg.levelTextSize} min={6} max={200} suffix="px" />
    </Field>
    <Field label="Timer-Text">
      <NumberInput bind:value={cfg.timerTextSize} min={6} max={200} suffix="px" />
    </Field>
  </div>
</Card>

<Card title="Schatten">
  <Field>
    <Toggle bind:checked={cfg.textShadowEnabled} label="Text-Schatten aktiv" />
  </Field>
  <Field label="Farbe">
    <ColorField bind:value={cfg.textShadowColor} />
  </Field>
  <div class="grid">
    <Field label="Offset X">
      <NumberInput bind:value={cfg.textShadowOffsetX} min={-50} max={50} suffix="px" />
    </Field>
    <Field label="Offset Y">
      <NumberInput bind:value={cfg.textShadowOffsetY} min={-50} max={50} suffix="px" />
    </Field>
  </div>
</Card>

<Card title="Outline">
  <Field>
    <Toggle bind:checked={cfg.textOutlineEnabled} label="Text-Outline aktiv" />
  </Field>
  <Field label="Farbe">
    <ColorField bind:value={cfg.textOutlineColor} />
  </Field>
  <Field label="Stärke">
    <NumberInput bind:value={cfg.textOutlineSize} min={0} max={20} suffix="px" />
  </Field>
</Card>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-4);
  }
</style>
