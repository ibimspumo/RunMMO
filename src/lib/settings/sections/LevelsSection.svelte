<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import type { AppSettings } from "../../types";
  import { DEFAULT_GIFT_URLS } from "../../defaults";

  export let cfg: AppSettings;

  async function pickImage(idx: number) {
    const file = await open({
      multiple: false,
      filters: [{ name: "Bilder", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }],
    });
    if (typeof file === "string") {
      cfg.levels[idx].imagePath = file;
      cfg = cfg;
    }
  }

  async function pickSound(idx: number) {
    const file = await open({
      multiple: false,
      filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] }],
    });
    if (typeof file === "string") {
      cfg.levels[idx].soundPath = file;
      cfg = cfg;
    }
  }

  function clearImage(idx: number) {
    cfg.levels[idx].imagePath = null;
    cfg = cfg;
  }
  function clearSound(idx: number) {
    cfg.levels[idx].soundPath = null;
    cfg = cfg;
  }

  function previewUrl(idx: number): string | null {
    const p = cfg.levels[idx].imagePath;
    if (p) return convertFileSrc(p);
    return DEFAULT_GIFT_URLS[idx] ?? null;
  }

  function playPreview(idx: number) {
    const p = cfg.levels[idx].soundPath;
    if (!p) return;
    const audio = new Audio(convertFileSrc(p));
    audio.volume = 1;
    audio.play().catch(console.error);
  }

  function shortPath(p: string | null): string {
    if (!p) return "—";
    const parts = p.split(/[/\\]/);
    return parts[parts.length - 1] ?? p;
  }
</script>

<h2>Geschenke & Sounds pro Level</h2>
<p class="hint">
  Pro Level lässt sich ein Bild (Geschenk-Icon) und ein Sound einstellen. Der Sound
  spielt, wenn das Level erreicht wird. Falls kein Sound gesetzt ist, wird der
  globale Up/Down-Sound aus dem Audio-Tab genutzt.
</p>

<div class="levels-grid">
  {#each cfg.levels as slot, idx}
    {@const level = idx + 1}
    <div class="level-card">
      <div class="level-header">Level {level}KMH</div>
      <div class="level-row">
        <div class="preview">
          {#if previewUrl(idx)}
            <img src={previewUrl(idx)} alt="Level {level}" />
          {:else}
            <span class="placeholder">kein Bild</span>
          {/if}
        </div>
        <div class="controls">
          <div class="control-block">
            <label>Bild</label>
            <div class="file-row">
              <span class="filename" title={slot.imagePath ?? ""}>{shortPath(slot.imagePath)}</span>
              <button on:click={() => pickImage(idx)}>📁</button>
              {#if slot.imagePath}
                <button on:click={() => clearImage(idx)}>✕</button>
              {/if}
            </div>
          </div>
          <div class="control-block">
            <label>Sound</label>
            <div class="file-row">
              <span class="filename" title={slot.soundPath ?? ""}>{shortPath(slot.soundPath)}</span>
              <button on:click={() => pickSound(idx)}>📁</button>
              {#if slot.soundPath}
                <button on:click={() => playPreview(idx)}>▶</button>
                <button on:click={() => clearSound(idx)}>✕</button>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  h2 {
    font-size: 14px;
    margin-bottom: 4px;
    font-family: system-ui, sans-serif;
  }
  .hint {
    font-size: 11px;
    color: #aaa;
    margin-bottom: 12px;
    line-height: 1.4;
  }
  .levels-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .level-card {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    padding: 8px;
  }
  .level-header {
    font-size: 12px;
    font-weight: bold;
    margin-bottom: 6px;
    color: #ddd;
  }
  .level-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .preview {
    width: 48px;
    height: 48px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .placeholder {
    font-size: 9px;
    color: #666;
    text-align: center;
  }
  .controls {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .control-block {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  label {
    font-size: 10px;
    color: #aaa;
    width: 40px;
    flex-shrink: 0;
  }
  .file-row {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }
  .filename {
    flex: 1;
    font-size: 11px;
    color: #ccc;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.25);
    padding: 3px 6px;
    border-radius: 3px;
    min-width: 0;
  }
  button {
    background: #2a2a30;
    color: #ddd;
    border: none;
    border-radius: 3px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
  }
  button:hover {
    background: #3a3a42;
  }
</style>
