<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import type { AppSettings } from "../../types";
  import { DEFAULT_UP_SOUND_URL, DEFAULT_DOWN_SOUND_URL } from "../../defaults";

  export let cfg: AppSettings;

  async function pickUp() {
    const file = await open({
      multiple: false,
      filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] }],
    });
    if (typeof file === "string") {
      cfg.fallbackUpSoundPath = file;
      cfg = cfg;
    }
  }
  async function pickDown() {
    const file = await open({
      multiple: false,
      filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] }],
    });
    if (typeof file === "string") {
      cfg.fallbackDownSoundPath = file;
      cfg = cfg;
    }
  }
  function playUp() {
    const url = cfg.fallbackUpSoundPath
      ? convertFileSrc(cfg.fallbackUpSoundPath)
      : DEFAULT_UP_SOUND_URL;
    const a = new Audio(url);
    a.volume = Math.pow(10, cfg.volumeDb / 20);
    a.play().catch(console.error);
  }
  function playDown() {
    const url = cfg.fallbackDownSoundPath
      ? convertFileSrc(cfg.fallbackDownSoundPath)
      : DEFAULT_DOWN_SOUND_URL;
    const a = new Audio(url);
    a.volume = Math.pow(10, cfg.volumeDb / 20);
    a.play().catch(console.error);
  }

  function short(p: string | null, fallback: string) {
    if (!p) return `(Default: ${fallback})`;
    const parts = p.split(/[/\\]/);
    return parts[parts.length - 1] ?? p;
  }
</script>

<h2>Audio</h2>

<div class="field">
  <label>Lautstärke (dB)</label>
  <div class="row">
    <input type="range" min="-80" max="24" step="0.5" bind:value={cfg.volumeDb} />
    <span class="value">{cfg.volumeDb.toFixed(1)} dB</span>
  </div>
  <p class="hint">Beeinflusst alle Sounds. -80 = stumm, 0 = normal.</p>
</div>

<div class="field">
  <label>Fallback UP-Sound</label>
  <div class="row">
    <span class="filename">{short(cfg.fallbackUpSoundPath, "up.mp3")}</span>
    <button on:click={pickUp}>📁 Auswählen</button>
    <button on:click={playUp}>▶ Test</button>
    {#if cfg.fallbackUpSoundPath}
      <button on:click={() => { cfg.fallbackUpSoundPath = null; cfg = cfg; }}>✕</button>
    {/if}
  </div>
</div>

<div class="field">
  <label>Fallback DOWN-Sound</label>
  <div class="row">
    <span class="filename">{short(cfg.fallbackDownSoundPath, "down.mp3")}</span>
    <button on:click={pickDown}>📁 Auswählen</button>
    <button on:click={playDown}>▶ Test</button>
    {#if cfg.fallbackDownSoundPath}
      <button on:click={() => { cfg.fallbackDownSoundPath = null; cfg = cfg; }}>✕</button>
    {/if}
  </div>
</div>

<p class="hint">
  Fallback-Sounds spielen, wenn ein Level keinen eigenen Sound zugewiesen hat.
  UP = Level wurde erhöht, DOWN = Level wurde reduziert.
</p>

<style>
  h2 {
    font-size: 14px;
    margin-bottom: 12px;
    font-family: system-ui, sans-serif;
  }
  .field {
    margin-bottom: 14px;
  }
  label {
    display: block;
    font-size: 11px;
    color: #ddd;
    margin-bottom: 4px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  input[type="range"] {
    flex: 1;
  }
  .value {
    font-size: 11px;
    color: #ccc;
    min-width: 70px;
  }
  .filename {
    flex: 1;
    font-size: 11px;
    color: #ccc;
    background: rgba(0, 0, 0, 0.25);
    padding: 4px 8px;
    border-radius: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  button {
    background: #2a2a30;
    color: #ddd;
    border: none;
    border-radius: 3px;
    padding: 4px 10px;
    font-size: 11px;
    cursor: pointer;
  }
  button:hover {
    background: #3a3a42;
  }
  .hint {
    font-size: 10px;
    color: #888;
    margin-top: 2px;
  }
</style>
