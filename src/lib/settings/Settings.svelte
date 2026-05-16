<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { AppSettings } from "../types";
  import ModeSection from "./sections/ModeSection.svelte";
  import LevelsSection from "./sections/LevelsSection.svelte";
  import AudioSection from "./sections/AudioSection.svelte";
  import TimerSection from "./sections/TimerSection.svelte";
  import WebhookSection from "./sections/WebhookSection.svelte";
  import ColorsSection from "./sections/ColorsSection.svelte";
  import TextSection from "./sections/TextSection.svelte";
  import LayoutSection from "./sections/LayoutSection.svelte";
  import UpdateSection from "./sections/UpdateSection.svelte";
  import { APP_VERSION } from "../version";

  export let cfg: AppSettings;

  const dispatch = createEventDispatcher<{ save: AppSettings; close: void }>();

  // Lokale Kopie - erst beim Speichern wird die nach außen geschrieben
  let draft: AppSettings = structuredClone(cfg);

  type TabId =
    | "mode"
    | "levels"
    | "audio"
    | "timer"
    | "webhook"
    | "colors"
    | "text"
    | "layout"
    | "update";

  let activeTab: TabId = "mode";

  const tabs: { id: TabId; label: string }[] = [
    { id: "mode", label: "Modus" },
    { id: "levels", label: "Level (Bild + Sound)" },
    { id: "audio", label: "Audio" },
    { id: "timer", label: "Timer" },
    { id: "webhook", label: "Webhook" },
    { id: "colors", label: "Farben" },
    { id: "text", label: "Text" },
    { id: "layout", label: "Layout" },
    { id: "update", label: "Update" },
  ];

  function save() {
    dispatch("save", structuredClone(draft));
  }
  function close() {
    dispatch("close");
  }
  function reset() {
    draft = structuredClone(cfg);
  }
</script>

<div class="settings-panel">
  <header>
    <div class="drag-area" data-tauri-drag-region>
      <h1 data-tauri-drag-region>RunMMO</h1>
      <span class="version" data-tauri-drag-region>v{APP_VERSION}</span>
      <span class="drag-hint" data-tauri-drag-region>(zum Verschieben hier ziehen)</span>
    </div>
    <div class="header-actions">
      <button class="btn-secondary" on:click={reset}>Zurücksetzen</button>
      <button class="btn-secondary" on:click={close}>Schließen (ESC)</button>
      <button class="btn-primary" on:click={save}>Speichern</button>
    </div>
  </header>

  <div class="body">
    <nav class="tabs">
      {#each tabs as t}
        <button
          class:active={activeTab === t.id}
          on:click={() => (activeTab = t.id)}
        >
          {t.label}
        </button>
      {/each}
    </nav>

    <div class="content">
      {#if activeTab === "mode"}
        <ModeSection bind:cfg={draft} />
      {:else if activeTab === "levels"}
        <LevelsSection bind:cfg={draft} />
      {:else if activeTab === "audio"}
        <AudioSection bind:cfg={draft} />
      {:else if activeTab === "timer"}
        <TimerSection bind:cfg={draft} />
      {:else if activeTab === "webhook"}
        <WebhookSection bind:cfg={draft} />
      {:else if activeTab === "colors"}
        <ColorsSection bind:cfg={draft} />
      {:else if activeTab === "text"}
        <TextSection bind:cfg={draft} />
      {:else if activeTab === "layout"}
        <LayoutSection bind:cfg={draft} />
      {:else if activeTab === "update"}
        <UpdateSection />
      {/if}
    </div>
  </div>
</div>

<style>
  .settings-panel {
    position: absolute;
    inset: 0;
    background: rgba(15, 15, 20, 0.97);
    color: #eee;
    font-family: system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    z-index: 100;
  }
  header {
    padding: 12px 16px;
    border-bottom: 1px solid #333;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .drag-area {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: 8px;
    cursor: grab;
    user-select: none;
    /* WICHTIG: padding hier statt im h1, damit die ganze Fläche draggable bleibt */
    padding: 4px 0;
  }
  .drag-area:active {
    cursor: grabbing;
  }
  header h1 {
    font-size: 18px;
    font-family: "LuckiestGuy", system-ui, sans-serif;
    font-weight: normal;
  }
  .version {
    font-size: 11px;
    color: #888;
    font-family: ui-monospace, monospace;
  }
  .drag-hint {
    font-size: 10px;
    color: #555;
    margin-left: 4px;
    font-style: italic;
  }
  .header-actions {
    display: flex;
    gap: 8px;
  }
  button {
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-family: system-ui, sans-serif;
  }
  .btn-primary {
    background: #2563eb;
    color: white;
  }
  .btn-primary:hover {
    background: #1d4ed8;
  }
  .btn-secondary {
    background: #2a2a30;
    color: #ddd;
  }
  .btn-secondary:hover {
    background: #3a3a42;
  }
  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .tabs {
    width: 130px;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    padding: 8px 0;
    border-right: 1px solid #333;
    flex-shrink: 0;
    overflow-y: auto;
  }
  .tabs button {
    text-align: left;
    padding: 8px 12px;
    border-radius: 0;
    background: transparent;
    color: #ccc;
    font-size: 11px;
  }
  .tabs button:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  .tabs button.active {
    background: rgba(37, 99, 235, 0.3);
    color: white;
    border-left: 3px solid #2563eb;
  }
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
  }
</style>
