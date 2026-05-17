<script lang="ts">
  import type { AppSettings } from "../../types";
  import {
    Callout,
    Card,
    Field,
    NumberInput,
    SectionHeader,
    SoundPicker,
    Toggle,
  } from "../../ui";

  export let cfg: AppSettings;

  function formatDecay(s: number): string {
    if (!s || !isFinite(s) || s <= 0) return "";
    if (s <= 1) {
      const hpPerSec = 1 / s;
      const f = hpPerSec >= 10 ? hpPerSec.toFixed(0) : hpPerSec.toFixed(1).replace(/\.0$/, "");
      return `−${f} HP/s`;
    }
    const f = s >= 10 ? s.toFixed(0) : s.toFixed(1).replace(/\.0$/, "");
    return `−1 HP / ${f}s`;
  }
</script>

<SectionHeader
  title="Stream-HP"
  description="MMO-Lebensbalken für den Stream. Drainen mit Geschwindigkeit abhängig vom aktuellen KMH-Level: Je höher das Level, desto schneller verliert der Stream HP. Bei 0 HP wird ein Death-Sound ausgelöst. Reset (R / /reset) füllt den Balken wieder auf."
/>

{#if cfg.mode !== "mmo"}
  <Callout variant="warn">
    Die HP-Leiste ist nur im <strong>MMO-Modus</strong> aktiv. Im aktuellen Modus
    werden diese Einstellungen ignoriert.
  </Callout>
{/if}

<Card>
  <Field>
    <Toggle bind:checked={cfg.streamHpEnabled} label="Stream-HP anzeigen" />
  </Field>
</Card>

<Card title="HP & Drain">
  <Field label="Max HP" hint="Start- und Reset-Wert der Lebensleiste.">
    <NumberInput bind:value={cfg.streamHpMax} min={1} max={100000} suffix="HP" />
  </Field>

  <Field>
    <Toggle bind:checked={cfg.streamHpShowDecayRate} label="Aktuelle Drain-Rate unter dem Balken anzeigen" />
  </Field>
</Card>

<Card
  title="Drain-Rate pro KMH-Level"
  hint={`Sekunden für -1 HP je Level. Kleinere Werte = schnellerer Verlust. Anzeige wechselt smart zwischen „HP/s" (schnell) und „1 HP / Xs" (langsam).`}
>
  {#each cfg.streamHpSecondsPerHpByLevel as _, i}
    <div class="decay-row">
      <span class="decay-label">{i + 1} KMH</span>
      <NumberInput
        bind:value={cfg.streamHpSecondsPerHpByLevel[i]}
        min={0.05}
        max={600}
        step={0.05}
        suffix="s/HP"
      />
      <span class="decay-preview">{formatDecay(cfg.streamHpSecondsPerHpByLevel[i])}</span>
    </div>
  {/each}
</Card>

<Card title="Death-Sound" hint="Wird einmal ausgelöst, wenn HP auf 0 fällt. Re-trigger nach Reset / Heilung.">
  <Field label="Sound">
    <SoundPicker
      value={cfg.streamHpDeathSoundPath}
      placeholder="Default (down.mp3)"
      on:change={(e) => (cfg.streamHpDeathSoundPath = e.detail)}
    />
  </Field>
</Card>

<Card
  title="Heal & Damage (Webhooks)"
  hint="Trigger via GET /heal?amount=X bzw. /damage?amount=X. Ohne amount = 100. Sounds optional — nur abgespielt, wenn ein Sound gewählt ist."
>
  <Field label="Heal-Sound (+HP)">
    <SoundPicker
      value={cfg.streamHpHealSoundPath}
      placeholder="Kein Sound"
      on:change={(e) => (cfg.streamHpHealSoundPath = e.detail)}
    />
  </Field>

  <Field label="Damage-Sound (−HP)">
    <SoundPicker
      value={cfg.streamHpDamageSoundPath}
      placeholder="Kein Sound"
      on:change={(e) => (cfg.streamHpDamageSoundPath = e.detail)}
    />
  </Field>

  <Callout variant="info">
    Tasten zum Testen im Overlay (nicht im Settings-Panel):
    <code>P</code> = +100 HP, <code>M</code> = −100 HP.
  </Callout>
</Card>

<Card
  title="Extraleben"
  hint="Wenn die HP auf 0 fallen, wird ein Extraleben eingelöst und die Bar auf das im Skill konfigurierte Revive-Prozent zurückgesetzt (statt Death-Sound). Skills fügen Leben über den Effekt-Typ „Extraleben“ hinzu — bis zu diesem Cap."
>
  <Field
    label="Maximale aktive Leben"
    hint="Cap für den Stack. 0 = Feature aus."
  >
    <NumberInput
      bind:value={cfg.streamHpExtraLivesMax}
      min={0}
      max={20}
      step={1}
      suffix="❤"
    />
  </Field>

  <Field label="Revive-Sound (optional)" hint="Spielt beim Einlösen eines Lebens statt des Death-Sounds.">
    <SoundPicker
      value={cfg.streamHpExtraLifeReviveSoundPath}
      placeholder="Kein Sound"
      on:change={(e) => (cfg.streamHpExtraLifeReviveSoundPath = e.detail)}
    />
  </Field>

  <Callout variant="info">
    Position der Herzen folgt der HP-Leiste (rechtsbündig darüber). Herzfarbe,
    Größe und Abstand stellst du im <strong>Design-Modus</strong> (Taste
    <code>D</code>) ein — Klick direkt auf eines der Herzen.
  </Callout>
</Card>

<Card title="Aussehen & Position">
  <Callout variant="info">
    Position und Größe der HP-Leiste stellst du im <strong>Edit-Modus</strong>
    (Taste <code>E</code>) ein. Eckenradius, Farben, HP-Zahl-Toggle und Text-Farbe
    findest du im <strong>Design-Modus</strong> (Taste <code>D</code>) — dort
    klickst du direkt auf den Balken oder den HP-Text.
  </Callout>
</Card>

<style>
  .decay-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-width: 0;
  }
  .decay-label {
    font-size: var(--fs-sm);
    color: var(--c-text);
    width: 70px;
    flex-shrink: 0;
  }
  .decay-preview {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    min-width: 88px;
    text-align: right;
    flex-shrink: 0;
  }
</style>
