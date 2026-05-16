<script lang="ts">
  import type { AppSettings } from "../../types";
  import { Card, Field, NumberInput, SectionHeader, Toggle } from "../../ui";

  export let cfg: AppSettings;
</script>

<SectionHeader
  title="Timer"
  description="Nur im Simple-Modus aktiv. Läuft der Timer ab, fällt das Level um eins."
/>

<Card>
  <Field
    label="Level-Dauer"
    hint="Wie lange ein Level hält, bevor automatisch ein Level runter geht."
  >
    <NumberInput
      bind:value={cfg.levelDurationSeconds}
      min={1}
      max={3600}
      suffix="s"
    />
  </Field>

  <Field>
    <Toggle bind:checked={cfg.showTimer} label="Timer beim aktiven Level anzeigen" />
  </Field>
</Card>
