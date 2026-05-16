<script lang="ts">
  import type { AppSettings, AppMode } from "../../types";
  import { SectionHeader } from "../../ui";

  export let cfg: AppSettings;

  const modes: { id: AppMode; title: string; desc: string; tag?: string }[] = [
    {
      id: "mmo",
      title: "MMO",
      desc: "Reine Leiter ohne Timer und Geschenk-Icons. Level werden ausschließlich über Webhooks gesteuert. Basis für komplexere Mechaniken (folgt).",
      tag: "Standard",
    },
    {
      id: "simple",
      title: "Simple",
      desc: "Klassische Leiter wie im Godot-Original: Timer pro Level, läuft er ab → Level runter. Geschenk-Icons werden bei den Nachbar-Levels (UP/DOWN-Ziel) eingeblendet.",
    },
  ];
</script>

<SectionHeader
  title="Modus"
  description="Bestimmt das grundlegende Verhalten der Leiter. Andere Tabs (Timer, Geschenk-Assets, Layout) bleiben gespeichert, werden aber je nach Modus ignoriert."
/>

<div class="modes">
  {#each modes as m}
    <label class="mode-card" class:active={cfg.mode === m.id}>
      <input type="radio" name="mode" value={m.id} bind:group={cfg.mode} />
      <div class="content">
        <div class="title-row">
          <span class="title">{m.title}</span>
          {#if m.tag}<span class="tag">{m.tag}</span>{/if}
        </div>
        <p class="desc">{m.desc}</p>
      </div>
    </label>
  {/each}
</div>

<style>
  .modes {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--sp-3);
  }
  .mode-card {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
    padding: var(--sp-4);
    background: var(--c-bg-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    cursor: pointer;
    transition: border-color var(--duration), background var(--duration);
  }
  .mode-card:hover {
    border-color: var(--c-border-strong);
  }
  .mode-card.active {
    border-color: var(--c-accent);
    background: var(--c-accent-soft);
  }
  input[type="radio"] {
    margin-top: 3px;
    flex-shrink: 0;
    accent-color: var(--c-accent);
  }
  .content {
    flex: 1;
  }
  .title-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-1);
  }
  .title {
    font-size: var(--fs-md);
    font-weight: 600;
    color: var(--c-text);
  }
  .tag {
    font-size: 10px;
    background: var(--c-accent);
    color: white;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }
  .desc {
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
    line-height: 1.5;
    margin: 0;
  }
</style>
