<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import {
    SKILL_CATALOG,
    SKILL_CATEGORIES,
    findIconEntry,
    resolveDefaultIcon,
  } from "../skill-icons";
  import type { SkillIconCategory } from "../skill-icons";
  import { convertFileSrc } from "@tauri-apps/api/core";

  // value-Format: null = kein Icon | "default:<key>" oder "default:fluent:<key>" = gebündelt | sonstige = User-Pfad
  export let value: string | null = null;

  const dispatch = createEventDispatcher<{ change: string | null }>();

  let open_ = false;
  let activeCategory: SkillIconCategory | "all" = "all";
  let query = "";

  // Aktuell ausgewähltes Icon: URL + Label für die Vorschau
  $: currentEntry = value && value.startsWith("default:") ? findIconEntry(value) : null;
  $: currentUrl = (() => {
    if (!value) return null;
    if (value.startsWith("default:")) return resolveDefaultIcon(value);
    return convertFileSrc(value);
  })();
  $: currentLabel = (() => {
    if (!value) return "Kein Icon";
    if (currentEntry) return `${currentEntry.name} · ${currentEntry.style === "fluent" ? "Fluent" : "Painterly"}`;
    if (value.startsWith("default:")) return value.slice("default:".length);
    const parts = value.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1];
  })();

  $: filtered = SKILL_CATALOG.filter((e) => {
    if (activeCategory !== "all" && e.category !== activeCategory) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!e.name.toLowerCase().includes(q) && !e.key.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function pick(iconPath: string) {
    dispatch("change", iconPath);
    close();
  }

  function clear() {
    dispatch("change", null);
    close();
  }

  async function pickFile() {
    try {
      const result = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Bilder", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"] }],
      });
      if (typeof result === "string") {
        dispatch("change", result);
        close();
      }
    } catch (e) {
      console.warn("file dialog failed", e);
    }
  }

  function close() {
    open_ = false;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open_) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  }
  onMount(() => window.addEventListener("keydown", onKeyDown, true));
  onDestroy(() => window.removeEventListener("keydown", onKeyDown, true));
</script>

<div class="picker-trigger">
  <button class="trigger-btn" on:click={() => (open_ = true)} title="Icon ändern">
    {#if currentUrl}
      <img src={currentUrl} alt="" class="thumb" draggable="false" />
    {:else}
      <span class="thumb empty">?</span>
    {/if}
    <span class="trigger-label">{currentLabel}</span>
    <span class="trigger-cta">Ändern</span>
  </button>
</div>

{#if open_}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="modal-scrim" on:click={close} role="presentation">
    <!-- svelte-ignore a11y-no-static-element-interactions a11y-no-noninteractive-element-interactions -->
    <div
      class="modal"
      on:click|stopPropagation
      role="dialog"
      aria-modal="true"
      aria-label="Icon auswählen"
    >
      <header class="modal-head">
        <div class="head-title">Icon-Bibliothek</div>
        <input
          type="search"
          class="search-input"
          placeholder="Suche…"
          bind:value={query}
        />
        <button class="head-close" on:click={close} title="Schließen (ESC)">✕</button>
      </header>

      <div class="cat-tabs">
        <button
          class="cat-tab"
          class:active={activeCategory === "all"}
          on:click={() => (activeCategory = "all")}
        >Alle</button>
        {#each SKILL_CATEGORIES as cat}
          <button
            class="cat-tab"
            class:active={activeCategory === cat.id}
            on:click={() => (activeCategory = cat.id)}
          >{cat.label}</button>
        {/each}
      </div>

      <div class="actions-row">
        <button class="action-btn" on:click={clear}>
          <span class="ax-emoji">∅</span> Kein Icon
        </button>
        <button class="action-btn" on:click={pickFile}>
          <span class="ax-emoji">⤴</span> Eigenes Bild…
        </button>
        <span class="count-hint">
          {filtered.length} von {SKILL_CATALOG.length}
        </span>
      </div>

      <div class="grid">
        {#each filtered as entry (entry.iconPath)}
          {@const selected = value === entry.iconPath}
          <button
            class="grid-item"
            class:selected
            on:click={() => pick(entry.iconPath)}
            title={`${entry.name} (${entry.style})`}
          >
            <div class="grid-icon">
              <img src={entry.url} alt={entry.name} draggable="false" />
              <span class="style-badge" class:fluent={entry.style === "fluent"}>
                {entry.style === "fluent" ? "F" : "P"}
              </span>
            </div>
            <span class="grid-label">{entry.name}</span>
          </button>
        {:else}
          <div class="empty-state">
            {SKILL_CATALOG.length === 0
              ? "Keine Icons gefunden. Generierung läuft eventuell noch — App neu starten."
              : "Nichts gefunden."}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .picker-trigger {
    width: 100%;
  }
  .trigger-btn {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    width: 100%;
    background: var(--c-bg-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 6px 8px;
    cursor: pointer;
    color: var(--c-text);
    transition: background var(--duration), border-color var(--duration);
    font-family: inherit;
    text-align: left;
  }
  .trigger-btn:hover {
    background: var(--c-bg-4);
    border-color: var(--c-border-strong);
  }
  .thumb {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 6px;
    background: linear-gradient(155deg, #25344a 0%, #0e1623 100%);
    object-fit: contain;
    padding: 3px;
  }
  .thumb.empty {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: 18px;
  }
  .trigger-label {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .trigger-cta {
    color: var(--c-accent);
    font-size: var(--fs-xs);
    font-weight: 600;
    flex-shrink: 0;
  }

  /* ===== Modal ===== */
  .modal-scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-3);
    animation: scrim-in 140ms ease-out;
  }
  @keyframes scrim-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .modal {
    background: var(--c-bg-1);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    width: 100%;
    max-width: 720px;
    max-height: calc(100vh - 24px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modal-in 160ms cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  @keyframes modal-in {
    from { transform: translateY(8px) scale(0.98); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }
  .modal-head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-3);
    border-bottom: 1px solid var(--c-border);
    flex-shrink: 0;
    background: var(--c-bg-2);
  }
  .head-title {
    font-size: var(--fs-md);
    font-weight: 600;
    flex-shrink: 0;
  }
  .search-input {
    flex: 1;
    background: var(--c-bg-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 6px 10px;
    color: var(--c-text);
    font-family: inherit;
    font-size: var(--fs-sm);
  }
  .search-input:focus {
    outline: none;
    border-color: var(--c-accent);
    background: var(--c-bg-2);
  }
  .head-close {
    width: 28px;
    height: 28px;
    border-radius: var(--r-sm);
    border: none;
    background: transparent;
    color: var(--c-text-muted);
    cursor: pointer;
    font-size: 14px;
  }
  .head-close:hover {
    background: var(--c-bg-3);
    color: var(--c-text);
  }

  .cat-tabs {
    display: flex;
    gap: 4px;
    padding: var(--sp-2) var(--sp-3);
    overflow-x: auto;
    border-bottom: 1px solid var(--c-border);
    flex-shrink: 0;
  }
  .cat-tab {
    flex-shrink: 0;
    background: transparent;
    color: var(--c-text-muted);
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    padding: 4px 10px;
    font-size: var(--fs-xs);
    cursor: pointer;
    font-family: inherit;
  }
  .cat-tab:hover {
    background: var(--c-bg-3);
    color: var(--c-text);
  }
  .cat-tab.active {
    background: var(--c-accent-soft);
    color: white;
    border-color: var(--c-accent-border);
  }

  .actions-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    border-bottom: 1px solid var(--c-border);
    flex-shrink: 0;
  }
  .action-btn {
    background: var(--c-bg-3);
    border: 1px solid var(--c-border);
    color: var(--c-text);
    border-radius: var(--r-sm);
    padding: 5px 12px;
    font-size: var(--fs-xs);
    cursor: pointer;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .action-btn:hover {
    background: var(--c-bg-4);
  }
  .ax-emoji {
    color: var(--c-text-dim);
    font-weight: 700;
  }
  .count-hint {
    margin-left: auto;
    font-size: var(--fs-xs);
    color: var(--c-text-dim);
    font-family: var(--font-mono);
  }

  .grid {
    flex: 1;
    overflow-y: auto;
    padding: var(--sp-3);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: var(--sp-2);
    align-content: start;
  }
  .grid::-webkit-scrollbar { width: 8px; }
  .grid::-webkit-scrollbar-thumb {
    background: var(--c-bg-3);
    border-radius: 4px;
  }
  .grid-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    background: var(--c-bg-2);
    border: 2px solid transparent;
    border-radius: var(--r-sm);
    padding: var(--sp-2) 4px;
    cursor: pointer;
    transition: background var(--duration), border-color var(--duration), transform 80ms;
    font-family: inherit;
    color: var(--c-text);
  }
  .grid-item:hover {
    background: var(--c-bg-3);
    transform: translateY(-1px);
  }
  .grid-item.selected {
    border-color: var(--c-accent);
    background: var(--c-accent-soft);
  }
  .grid-icon {
    width: 64px;
    height: 64px;
    border-radius: 8px;
    background: linear-gradient(155deg, #25344a 0%, #0e1623 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }
  .grid-icon img {
    width: 88%;
    height: 88%;
    object-fit: contain;
    user-select: none;
  }
  .style-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(180, 120, 60, 0.85);
    color: white;
    font-size: 9px;
    font-weight: 700;
    line-height: 16px;
    text-align: center;
    border: 1px solid rgba(0, 0, 0, 0.3);
    font-family: var(--font-mono, monospace);
  }
  .style-badge.fluent {
    background: rgba(56, 130, 200, 0.9);
  }
  .grid-icon {
    position: relative;
  }
  .grid-label {
    font-size: 11px;
    color: var(--c-text-muted);
    text-align: center;
    line-height: 1.2;
    word-break: break-word;
  }
  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--c-text-dim);
    padding: var(--sp-5) var(--sp-3);
    font-size: var(--fs-sm);
  }
</style>
