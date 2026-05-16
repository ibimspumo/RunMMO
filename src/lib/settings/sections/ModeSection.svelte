<script lang="ts">
  import type { AppSettings, AppMode, OverlayStyle } from "../../types";
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

  const styles: { id: OverlayStyle; title: string; desc: string }[] = [
    {
      id: "ladder",
      title: "Leiter",
      desc: "Klassische vertikale KMH-Balken (1–12 von unten nach oben).",
    },
    {
      id: "tacho",
      title: "Tacho",
      desc: "Halbkreis-Gauge mit Nadel wie im Auto. Farbsegmente folgen den Level-Farben.",
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

{#if cfg.mode === "mmo"}
  <div class="style-block">
    <div class="style-head">
      <span class="style-title">Anzeigeart</span>
      <span class="style-sub">Wie das Overlay im MMO-Modus dargestellt wird.</span>
    </div>
    <div class="modes">
      {#each styles as s}
        <label class="mode-card style" class:active={cfg.overlayStyle === s.id}>
          <input type="radio" name="overlayStyle" value={s.id} bind:group={cfg.overlayStyle} />
          <div class="content">
            <div class="title-row">
              <span class="title">{s.title}</span>
            </div>
            <p class="desc">{s.desc}</p>
          </div>
        </label>
      {/each}
    </div>
  </div>
{/if}

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
  .style-block {
    margin-top: var(--sp-4);
    padding-top: var(--sp-4);
    border-top: 1px solid var(--c-border);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .style-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .style-title {
    font-size: var(--fs-md);
    font-weight: 600;
    color: var(--c-text);
  }
  .style-sub {
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
  }
</style>
