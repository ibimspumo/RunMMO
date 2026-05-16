<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import type { AppSettings } from "../../types";
  import { DEFAULT_DOWN_SOUND_URL } from "../../defaults";
  import {
    Callout,
    Card,
    ColorField,
    Field,
    FilePicker,
    NumberInput,
    SectionHeader,
    Toggle,
  } from "../../ui";
  import { previewAudio } from "../../ui/audio-preview";

  export let cfg: AppSettings;

  const audioFilters = [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] }];

  function playDeath() {
    const url = cfg.streamHpDeathSoundPath
      ? convertFileSrc(cfg.streamHpDeathSoundPath)
      : DEFAULT_DOWN_SOUND_URL;
    previewAudio(url, cfg.volumeDb);
  }
  function playHeal() {
    if (!cfg.streamHpHealSoundPath) return;
    previewAudio(convertFileSrc(cfg.streamHpHealSoundPath), cfg.volumeDb);
  }
  function playDamage() {
    if (!cfg.streamHpDamageSoundPath) return;
    previewAudio(convertFileSrc(cfg.streamHpDamageSoundPath), cfg.volumeDb);
  }

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
  <Field label="Sound-Datei">
    <FilePicker
      bind:value={cfg.streamHpDeathSoundPath}
      placeholder="Default (down.mp3)"
      filters={audioFilters}
      onPlay={playDeath}
    />
  </Field>
</Card>

<Card
  title="Heal & Damage (Webhooks)"
  hint="Trigger via GET /heal?amount=X bzw. /damage?amount=X. Ohne amount = 10. Sounds optional — nur abgespielt, wenn eine Datei gewählt ist."
>
  <Field label="Heal-Sound (+HP)">
    <FilePicker
      bind:value={cfg.streamHpHealSoundPath}
      placeholder="Kein Sound"
      filters={audioFilters}
      onPlay={playHeal}
    />
  </Field>

  <Field label="Damage-Sound (−HP)">
    <FilePicker
      bind:value={cfg.streamHpDamageSoundPath}
      placeholder="Kein Sound"
      filters={audioFilters}
      onPlay={playDamage}
    />
  </Field>
</Card>

<Card title="Aussehen">
  <Field
    label="Eckenradius (px)"
    hint="0 = eckig, hoch = Pille. Wird automatisch auf die halbe Höhe begrenzt."
  >
    <NumberInput
      bind:value={cfg.streamHpBorderRadius}
      min={0}
      max={120}
      suffix="px"
    />
  </Field>

  <Field>
    <Toggle bind:checked={cfg.streamHpShowNumbers} label="HP-Zahlen anzeigen" />
  </Field>

  <Callout variant="info">
    Position und Größe der HP-Leiste werden im <strong>Edit-Modus</strong>
    (Taste <code>E</code>) direkt im Overlay eingestellt.
  </Callout>
</Card>

<Card title="Farben">
  <Field label="Füllung" inline>
    <ColorField bind:value={cfg.streamHpFillColor} withAlpha={false} />
  </Field>
  <Field label="Hintergrund" inline>
    <ColorField bind:value={cfg.streamHpBgColor} />
  </Field>
  <Field label="Rand" inline>
    <ColorField bind:value={cfg.streamHpBorderColor} />
  </Field>
  <Field label="HP-Text" inline>
    <ColorField bind:value={cfg.streamHpTextColor} withAlpha={false} />
  </Field>
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
