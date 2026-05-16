<script lang="ts">
  import type { AppSettings } from "../../types";
  export let cfg: AppSettings;
</script>

<h2>Modus</h2>
<p class="hint">
  Bestimmt das grundlegende Verhalten der Leiter. Andere Tabs (Timer-Dauer,
  Geschenk-Assets, Layout) bleiben gespeichert, werden aber je nach Modus
  ignoriert.
</p>

<div class="modes">
  <label class="mode-card" class:active={cfg.mode === "mmo"}>
    <input type="radio" name="mode" value="mmo" bind:group={cfg.mode} />
    <div class="card-content">
      <div class="title">MMO</div>
      <div class="desc">
        Reine Leiter ohne Timer und ohne Geschenk-Icons. Level werden
        ausschließlich über Webhooks gesteuert. Basis für komplexere
        Mechaniken (folgt).
      </div>
      <div class="tag">Standard</div>
    </div>
  </label>

  <label class="mode-card" class:active={cfg.mode === "simple"}>
    <input type="radio" name="mode" value="simple" bind:group={cfg.mode} />
    <div class="card-content">
      <div class="title">Simple</div>
      <div class="desc">
        Klassische Leiter wie im Godot-Original: Timer pro Level, läuft er ab
        → Level runter. Geschenk-Icons werden bei den Nachbar-Levels (UP/DOWN-Ziel) eingeblendet.
      </div>
    </div>
  </label>
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
    margin-bottom: 14px;
    line-height: 1.4;
  }
  .modes {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mode-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #333;
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.1s, background 0.1s;
  }
  .mode-card:hover {
    background: rgba(255, 255, 255, 0.07);
  }
  .mode-card.active {
    border-color: #2563eb;
    background: rgba(37, 99, 235, 0.12);
  }
  input[type="radio"] {
    margin-top: 3px;
    flex-shrink: 0;
  }
  .card-content {
    flex: 1;
    position: relative;
  }
  .title {
    font-size: 13px;
    font-weight: bold;
    color: #fff;
    margin-bottom: 4px;
  }
  .desc {
    font-size: 11px;
    color: #bbb;
    line-height: 1.5;
  }
  .tag {
    position: absolute;
    top: 0;
    right: 0;
    font-size: 9px;
    background: #2563eb;
    color: white;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style>
