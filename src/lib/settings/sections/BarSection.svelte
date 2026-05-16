<script lang="ts">
  import type { AppSettings } from "../../types";
  import { Callout, Card, Field, NumberInput, SectionHeader } from "../../ui";

  export let cfg: AppSettings;

  type Numeric = {
    [K in keyof AppSettings]: AppSettings[K] extends number ? K : never;
  }[keyof AppSettings];

  type FieldDef = {
    key: Numeric;
    label: string;
    min: number;
    max: number;
    step?: number;
    suffix?: string;
  };

  const sizeFields: FieldDef[] = [
    { key: "barBaseWidth", label: "Basis-Breite", min: 10, max: 1000, suffix: "px" },
    { key: "barWidthIncrement", label: "Breite pro Level", min: 0, max: 500, suffix: "px" },
    { key: "barHeight", label: "Höhe", min: 5, max: 300, suffix: "px" },
    { key: "barBorderRadius", label: "Border-Radius", min: 0, max: 100, suffix: "px" },
    { key: "iconSize", label: "Icon-Größe", min: 5, max: 200, suffix: "px" },
    { key: "spacingBetweenLevels", label: "Abstand zwischen Levels", min: 0, max: 100, suffix: "px" },
    { key: "activeBarOutlineWidth", label: "Aktiv-Rahmen Breite", min: 0, max: 20, suffix: "px" },
  ];

  const paddingFields: FieldDef[] = [
    { key: "barPaddingTop", label: "Oben", min: 0, max: 100, suffix: "px" },
    { key: "barPaddingBottom", label: "Unten", min: 0, max: 100, suffix: "px" },
    { key: "barPaddingLeft", label: "Links", min: 0, max: 100, suffix: "px" },
    { key: "barPaddingRight", label: "Rechts", min: 0, max: 100, suffix: "px" },
  ];
</script>

<SectionHeader
  title="Balken"
  description="Geometrie der einzelnen Level-Balken. Werte beziehen sich auf 450px Fensterbreite — bei größerem Fenster skaliert alles proportional mit."
/>

<Callout variant="info">
  Position und Gesamt-Skalierung der Overlays werden über den <strong>Edit-Modus</strong>
  (Taste <code>E</code>) eingestellt — direkt im Overlay per Drag & Drop.
</Callout>

<Card title="Balken-Größen">
  <div class="grid">
    {#each sizeFields as f}
      <Field label={f.label}>
        <NumberInput
          bind:value={cfg[f.key]}
          min={f.min}
          max={f.max}
          step={f.step ?? 1}
          suffix={f.suffix}
        />
      </Field>
    {/each}
  </div>
</Card>

<Card title="Balken-Padding">
  <div class="grid">
    {#each paddingFields as f}
      <Field label={f.label}>
        <NumberInput
          bind:value={cfg[f.key]}
          min={f.min}
          max={f.max}
          step={f.step ?? 1}
          suffix={f.suffix}
        />
      </Field>
    {/each}
  </div>
</Card>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--sp-3) var(--sp-4);
  }
  code {
    background: var(--c-bg-2);
    padding: 1px 5px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.9em;
  }
</style>
