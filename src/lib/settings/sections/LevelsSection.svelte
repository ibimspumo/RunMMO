<script lang="ts">
  import type { AppSettings } from "../../types";
  import { FilePicker, GiftPicker, SectionHeader } from "../../ui";
  import { imageUrlForLevel, soundUrlForLevel } from "../../stores";
  import { previewAudio } from "../../ui/audio-preview";

  export let cfg: AppSettings;

  const sndFilters = [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] }];

  function playPreview(idx: number) {
    // Resolve mit Fallback: Level-Sound → globaler UP → Default-UP
    previewAudio(soundUrlForLevel(idx, cfg, "up"), cfg.volumeDb);
  }
</script>

<SectionHeader
  title="Level-Assets"
  description="Bild (Geschenk-Icon) und Sound pro Level. Bild aus der TikTok-Gift-Bibliothek wählen oder eigenes Bild hochladen. Wenn kein Sound gesetzt ist, wird der Fallback-Sound aus dem Audio-Tab verwendet."
/>

<div class="grid">
  {#each cfg.levels as slot, idx}
    {@const level = idx + 1}
    {@const url = imageUrlForLevel(idx, cfg)}
    <div class="row">
      <div class="thumb">
        {#if url}
          <img src={url} alt="Level {level}" />
        {:else}
          <span class="empty">∅</span>
        {/if}
      </div>

      <div class="label">
        <span class="level-num">{level}</span>
        <span class="level-unit">KMH</span>
      </div>

      <div class="pickers">
        <GiftPicker
          value={slot.imagePath}
          on:change={(e) => {
            slot.imagePath = e.detail;
            cfg.levels = cfg.levels;
          }}
        />
        <FilePicker
          bind:value={slot.soundPath}
          placeholder="Fallback nutzen"
          filters={sndFilters}
          onPlay={() => playPreview(idx)}
        />
      </div>
    </div>
  {/each}
</div>

<style>
  .grid {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .row {
    display: grid;
    grid-template-columns: 56px 64px 1fr;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2);
    background: var(--c-bg-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
  }
  .thumb {
    width: 48px;
    height: 48px;
    background: var(--c-bg-0);
    border-radius: var(--r-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    margin: 0 auto;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .empty {
    color: var(--c-text-dim);
    font-size: 20px;
  }
  .label {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }
  .level-num {
    font-family: var(--font-display);
    font-size: var(--fs-xl);
    color: var(--c-text);
  }
  .level-unit {
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    letter-spacing: 0.5px;
  }
  .pickers {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
</style>
