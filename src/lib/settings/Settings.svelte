<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { AppSettings } from "../types";
  import ModeSection from "./sections/ModeSection.svelte";
  import LevelsSection from "./sections/LevelsSection.svelte";
  import AudioSection from "./sections/AudioSection.svelte";
  import TimerSection from "./sections/TimerSection.svelte";
  import StreamHpSection from "./sections/StreamHpSection.svelte";
  import SkillsSection from "./sections/SkillsSection.svelte";
  import WebhookSection from "./sections/WebhookSection.svelte";
  import ColorsSection from "./sections/ColorsSection.svelte";
  import UpdateSection from "./sections/UpdateSection.svelte";
  import ResetSection from "./sections/ResetSection.svelte";
  import Button from "../ui/Button.svelte";
  import { APP_VERSION } from "../version";

  export let cfg: AppSettings;

  const dispatch = createEventDispatcher<{ save: AppSettings; close: void }>();

  let draft: AppSettings = structuredClone(cfg);

  type TabId =
    | "mode"
    | "levels"
    | "audio"
    | "timer"
    | "streamhp"
    | "skills"
    | "webhook"
    | "colors"
    | "update"
    | "reset";

  type TabItem = { id: TabId; label: string; icon: string };
  type TabGroup = { label: string; items: TabItem[] };

  const groups: TabGroup[] = [
    {
      label: "Allgemein",
      items: [
        { id: "mode", label: "Modus", icon: "◐" },
        { id: "webhook", label: "Webhook", icon: "↯" },
      ],
    },
    {
      label: "Inhalte",
      items: [
        { id: "levels", label: "Level-Assets", icon: "▤" },
        { id: "audio", label: "Audio", icon: "♪" },
        { id: "timer", label: "Timer", icon: "◷" },
        { id: "streamhp", label: "Stream-HP", icon: "♥" },
        { id: "skills", label: "Skills", icon: "✦" },
        { id: "colors", label: "Level-Farben", icon: "◆" },
      ],
    },
    {
      label: "System",
      items: [
        { id: "update", label: "Updates", icon: "↺" },
        { id: "reset", label: "Zurücksetzen", icon: "⟲" },
      ],
    },
  ];

  let activeTab: TabId = "mode";
  let drawerOpen = false;

  $: dirty = JSON.stringify(draft) !== JSON.stringify(cfg);
  $: activeItem = groups
    .flatMap((g) => g.items)
    .find((i) => i.id === activeTab)!;

  function save() {
    dispatch("save", structuredClone(draft));
  }
  function close() {
    dispatch("close");
  }
  function reset() {
    draft = structuredClone(cfg);
  }
  function selectTab(id: TabId) {
    activeTab = id;
    drawerOpen = false;
  }
</script>

<div class="settings-panel">
  <header class="topbar">
    <button class="icon-btn menu" on:click={() => (drawerOpen = !drawerOpen)} title="Menü">
      <span class="hamburger" class:open={drawerOpen}>
        <span></span><span></span><span></span>
      </span>
    </button>

    <div class="title-block" data-tauri-drag-region>
      <div class="title-row" data-tauri-drag-region>
        <span class="icon" data-tauri-drag-region>{activeItem.icon}</span>
        <span class="title" data-tauri-drag-region>{activeItem.label}</span>
      </div>
      <span class="drag-hint" data-tauri-drag-region>RunMMO v{APP_VERSION} · ziehen zum Verschieben</span>
    </div>

    <button class="icon-btn close" on:click={close} title="Schließen (ESC)">✕</button>
  </header>

  <div class="content">
    {#if activeTab === "mode"}
      <ModeSection bind:cfg={draft} />
    {:else if activeTab === "levels"}
      <LevelsSection bind:cfg={draft} />
    {:else if activeTab === "audio"}
      <AudioSection bind:cfg={draft} />
    {:else if activeTab === "timer"}
      <TimerSection bind:cfg={draft} />
    {:else if activeTab === "streamhp"}
      <StreamHpSection bind:cfg={draft} />
    {:else if activeTab === "skills"}
      <SkillsSection bind:cfg={draft} />
    {:else if activeTab === "webhook"}
      <WebhookSection bind:cfg={draft} />
    {:else if activeTab === "colors"}
      <ColorsSection bind:cfg={draft} />
    {:else if activeTab === "update"}
      <UpdateSection />
    {:else if activeTab === "reset"}
      <ResetSection bind:cfg={draft} />
    {/if}
  </div>

  <footer class="action-bar" class:dirty>
    {#if dirty}
      <Button variant="ghost" size="sm" on:click={reset}>Verwerfen</Button>
      <Button variant="primary" size="md" on:click={save}>● Speichern</Button>
    {:else}
      <span class="saved-hint">● Alles gespeichert</span>
    {/if}
  </footer>

  {#if drawerOpen}
    <button
      class="scrim"
      on:click={() => (drawerOpen = false)}
      aria-label="Menü schließen"
    ></button>
  {/if}

  <aside class="drawer" class:open={drawerOpen}>
    <div class="drawer-head">
      <span class="brand">RunMMO</span>
      <span class="ver">v{APP_VERSION}</span>
    </div>
    <nav class="nav">
      {#each groups as g}
        <div class="group-label">{g.label}</div>
        {#each g.items as t}
          <button
            class="nav-item"
            class:active={activeTab === t.id}
            on:click={() => selectTab(t.id)}
          >
            <span class="ni-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        {/each}
      {/each}
    </nav>
  </aside>
</div>

<style>
  .settings-panel {
    position: absolute;
    inset: 0;
    background: var(--c-bg-0);
    color: var(--c-text);
    font-family: var(--font-ui);
    display: flex;
    flex-direction: column;
    z-index: 100;
    overflow: hidden;
  }

  /* === Top bar === */
  .topbar {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    background: var(--c-bg-1);
    border-bottom: 1px solid var(--c-border);
    flex-shrink: 0;
    min-height: 52px;
  }
  .icon-btn {
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    color: var(--c-text-muted);
    border-radius: var(--r-sm);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: background var(--duration), color var(--duration);
    flex-shrink: 0;
  }
  .icon-btn:hover {
    background: var(--c-bg-3);
    color: var(--c-text);
  }

  /* Hamburger Icon */
  .hamburger {
    position: relative;
    width: 18px;
    height: 14px;
    display: inline-block;
  }
  .hamburger span {
    position: absolute;
    left: 0;
    width: 100%;
    height: 2px;
    background: currentColor;
    border-radius: 1px;
    transition: transform var(--duration), opacity var(--duration), top var(--duration);
  }
  .hamburger span:nth-child(1) { top: 0; }
  .hamburger span:nth-child(2) { top: 6px; }
  .hamburger span:nth-child(3) { top: 12px; }
  .hamburger.open span:nth-child(1) { top: 6px; transform: rotate(45deg); }
  .hamburger.open span:nth-child(2) { opacity: 0; }
  .hamburger.open span:nth-child(3) { top: 6px; transform: rotate(-45deg); }

  .title-block {
    flex: 1;
    min-width: 0;
    cursor: grab;
    user-select: none;
    padding: 4px 0;
  }
  .title-block:active { cursor: grabbing; }
  .title-row {
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
  }
  .title-row .icon {
    color: var(--c-accent);
    font-size: 14px;
  }
  .title {
    font-size: var(--fs-lg);
    font-weight: 600;
    color: var(--c-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .drag-hint {
    display: block;
    font-size: 10px;
    color: var(--c-text-dim);
    font-family: var(--font-mono);
    margin-top: 1px;
  }

  /* === Content === */
  .content {
    flex: 1;
    min-height: 0; /* erlaubt dem flex-child unter Content-Höhe zu schrumpfen → scrollbar greift */
    overflow-y: auto;
    padding: var(--sp-4) var(--sp-4) var(--sp-5);
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  /* Card-Kinder dürfen NIE komprimiert werden — sonst clippt overflow:hidden in der Card den Inhalt. */
  .content > :global(*) {
    flex-shrink: 0;
  }
  .content::-webkit-scrollbar { width: 8px; }
  .content::-webkit-scrollbar-track { background: transparent; }
  .content::-webkit-scrollbar-thumb {
    background: var(--c-bg-3);
    border-radius: 4px;
  }
  .content::-webkit-scrollbar-thumb:hover { background: var(--c-bg-4); }

  /* === Action bar — only visible when dirty, otherwise small hint === */
  .action-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    border-top: 1px solid var(--c-border);
    background: var(--c-bg-1);
    flex-shrink: 0;
    min-height: 44px;
  }
  .action-bar.dirty {
    background: linear-gradient(to top, var(--c-accent-soft), var(--c-bg-1));
    border-top-color: var(--c-accent-border);
  }
  .saved-hint {
    font-size: var(--fs-xs);
    color: var(--c-success);
    margin-right: auto;
    padding-left: var(--sp-2);
  }

  /* === Drawer === */
  .scrim {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    cursor: pointer;
    z-index: 10;
    animation: fade var(--duration) ease;
  }
  @keyframes fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .drawer {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 240px;
    max-width: 80%;
    background: var(--c-bg-1);
    border-right: 1px solid var(--c-border);
    transform: translateX(-100%);
    transition: transform 180ms cubic-bezier(0.32, 0.72, 0.36, 1);
    z-index: 11;
    display: flex;
    flex-direction: column;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
  }
  .drawer.open {
    transform: translateX(0);
  }
  .drawer-head {
    padding: var(--sp-4);
    border-bottom: 1px solid var(--c-border);
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
  }
  .brand {
    font-family: var(--font-display);
    font-size: var(--fs-xl);
    letter-spacing: 0.5px;
  }
  .ver {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--c-text-dim);
  }
  .nav {
    flex: 1;
    overflow-y: auto;
    padding: var(--sp-3) var(--sp-2);
  }
  .group-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--c-text-dim);
    padding: var(--sp-3) var(--sp-3) var(--sp-1);
    font-weight: 600;
  }
  .group-label:first-child { padding-top: 0; }
  .nav-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: 9px var(--sp-3);
    background: transparent;
    border: none;
    border-radius: var(--r-sm);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    font-family: var(--font-ui);
    text-align: left;
    cursor: pointer;
    transition: background var(--duration), color var(--duration);
  }
  .nav-item:hover {
    background: var(--c-bg-2);
    color: var(--c-text);
  }
  .nav-item.active {
    background: var(--c-accent-soft);
    color: white;
  }
  .ni-icon {
    display: inline-flex;
    width: 18px;
    justify-content: center;
    color: var(--c-text-dim);
    font-size: 13px;
  }
  .nav-item.active .ni-icon { color: var(--c-accent); }
</style>
