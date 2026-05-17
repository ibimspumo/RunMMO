<script lang="ts">
  import type { AppSettings } from "../../types";
  import { defaultSettings } from "../../defaults";
  import { Button, Callout, Card, SectionHeader } from "../../ui";

  export let cfg: AppSettings;

  let confirming = false;

  function startReset() {
    confirming = true;
  }

  function cancelReset() {
    confirming = false;
  }

  function applyReset() {
    cfg = defaultSettings();
    confirming = false;
  }
</script>

<SectionHeader
  title="Zurücksetzen"
  description="Setzt alle Einstellungen — Inhalte, Positionen (Edit-Modus) und Stile (Design-Modus) — auf die Standardwerte zurück."
/>

<Card>
  <Callout variant="warn">
    <strong>Achtung:</strong> Damit gehen <em>alle</em> Anpassungen verloren —
    Level-Assets, Sounds, Webhook-Port, Modus, Positionen, Farben und das
    komplette Design. Die Änderung wird erst nach <strong>„Speichern"</strong>
    übernommen, du kannst sie vorher noch mit <strong>„Verwerfen"</strong>
    abbrechen.
  </Callout>

  {#if !confirming}
    <Button variant="danger" on:click={startReset}>
      Auf Standard zurücksetzen
    </Button>
  {:else}
    <Callout variant="error">
      <strong>Wirklich zurücksetzen?</strong>
      <div class="confirm-hint">
        Alle Einstellungen werden in den Standardzustand versetzt.
      </div>
    </Callout>
    <div class="button-row">
      <Button variant="danger" on:click={applyReset}>
        Ja, zurücksetzen
      </Button>
      <Button variant="ghost" on:click={cancelReset}>
        Abbrechen
      </Button>
    </div>
  {/if}
</Card>

<style>
  .confirm-hint {
    margin-top: var(--sp-1);
    font-size: var(--fs-xs);
    opacity: 0.85;
  }
  .button-row {
    display: flex;
    gap: var(--sp-2);
  }
</style>
