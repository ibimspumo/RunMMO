<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import type { AppSettings } from "../../types";
  import { DEFAULT_UP_SOUND_URL, DEFAULT_DOWN_SOUND_URL } from "../../defaults";
  import { Button, Card, Field, FilePicker, SectionHeader, Slider } from "../../ui";
  import { previewAudio } from "../../ui/audio-preview";

  export let cfg: AppSettings;

  const audioFilters = [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] }];

  function playFile(path: string | null, fallbackUrl: string) {
    previewAudio(path ? convertFileSrc(path) : fallbackUrl, cfg.volumeDb);
  }
</script>

<SectionHeader
  title="Audio"
  description="Lautstärke und Fallback-Sounds. Fallback-Sounds spielen, wenn ein Level keinen eigenen Sound zugewiesen hat."
/>

<Card title="Lautstärke">
  <Field
    label="Master (dB)"
    hint="Beeinflusst alle Sounds. -80 = stumm, 0 = unverändert, +24 = maximal verstärkt."
  >
    <Slider
      bind:value={cfg.volumeDb}
      min={-80}
      max={24}
      step={0.5}
      format={(v) => `${v.toFixed(1)} dB`}
    />
  </Field>
  <Field hint="Testet UP- und DOWN-Sound mit der oben gewählten Lautstärke.">
    <div class="test-row">
      <Button size="sm" on:click={() => playFile(cfg.fallbackUpSoundPath, DEFAULT_UP_SOUND_URL)}>
        ▶ UP testen
      </Button>
      <Button size="sm" on:click={() => playFile(cfg.fallbackDownSoundPath, DEFAULT_DOWN_SOUND_URL)}>
        ▶ DOWN testen
      </Button>
    </div>
  </Field>
</Card>

<Card title="Fallback-Sounds" hint="UP = Level wurde erhöht, DOWN = Level wurde reduziert.">
  <Field label="UP-Sound">
    <FilePicker
      bind:value={cfg.fallbackUpSoundPath}
      placeholder="Default (up.mp3)"
      filters={audioFilters}
      onPlay={() => playFile(cfg.fallbackUpSoundPath, DEFAULT_UP_SOUND_URL)}
    />
  </Field>

  <Field label="DOWN-Sound">
    <FilePicker
      bind:value={cfg.fallbackDownSoundPath}
      placeholder="Default (down.mp3)"
      filters={audioFilters}
      onPlay={() => playFile(cfg.fallbackDownSoundPath, DEFAULT_DOWN_SOUND_URL)}
    />
  </Field>
</Card>

<style>
  .test-row {
    display: flex;
    gap: var(--sp-2);
  }
</style>
