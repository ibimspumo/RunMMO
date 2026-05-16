<script lang="ts">
  import type { AppSettings } from "../../types";
  export let cfg: AppSettings;
</script>

<h2>Timer</h2>

<div class="field">
  <label>Level-Dauer (Sekunden)</label>
  <input
    type="number"
    min="1"
    max="3600"
    step="1"
    bind:value={cfg.levelDurationSeconds}
  />
  <p class="hint">
    Wie lange ein Level hält, bevor automatisch ein Level runter geht.
  </p>
</div>

<div class="field">
  <label>
    <input type="checkbox" bind:checked={cfg.showTimer} />
    Timer beim aktiven Level anzeigen
  </label>
</div>

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
  input[type="number"] {
    background: #1a1a20;
    color: #eee;
    border: 1px solid #333;
    border-radius: 3px;
    padding: 4px 8px;
    width: 100px;
  }
  input[type="checkbox"] {
    margin-right: 6px;
    vertical-align: middle;
  }
  .hint {
    font-size: 10px;
    color: #888;
    margin-top: 4px;
  }
</style>
