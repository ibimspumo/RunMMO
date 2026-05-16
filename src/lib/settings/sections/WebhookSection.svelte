<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import type { AppSettings } from "../../types";

  export let cfg: AppSettings;

  let localIp = "";
  invoke<string>("get_local_ip").then((ip) => (localIp = ip)).catch(() => {});

  $: localhostUrl = `http://127.0.0.1:${cfg.webhookPort}`;
  $: networkUrl =
    cfg.webhookBindAllInterfaces && localIp
      ? `http://${localIp}:${cfg.webhookPort}`
      : null;
</script>

<h2>Webhook-Server</h2>

<div class="field">
  <label>
    <input type="checkbox" bind:checked={cfg.webhookEnabled} />
    Webhook-Server aktivieren
  </label>
</div>

<div class="field">
  <label>Port</label>
  <input
    type="number"
    min="1"
    max="65535"
    bind:value={cfg.webhookPort}
    disabled={!cfg.webhookEnabled}
  />
</div>

<div class="field">
  <label>
    <input
      type="checkbox"
      bind:checked={cfg.webhookBindAllInterfaces}
      disabled={!cfg.webhookEnabled}
    />
    Auf allen Netzwerk-Interfaces lauschen (0.0.0.0)
  </label>
  <p class="hint">
    Falls aus → nur localhost erreichbar. Falls an → auch aus dem lokalen Netz
    (z.B. anderes Gerät, Tools wie TikFinity).
  </p>
</div>

<div class="urls">
  <h3>Verfügbare URLs</h3>
  <div class="url-row">
    <strong>Localhost:</strong>
    <code>{localhostUrl}</code>
  </div>
  {#if networkUrl}
    <div class="url-row">
      <strong>Netzwerk:</strong>
      <code>{networkUrl}</code>
    </div>
  {/if}

  <h3>Endpunkte</h3>
  <ul>
    <li><code>GET /up</code> – Level erhöhen</li>
    <li><code>GET /down</code> – Level reduzieren</li>
    <li><code>GET /reset</code> – Reset auf Level 1</li>
    <li><code>GET /status</code> – Aktueller Status als JSON</li>
    <li>
      <code>GET /gift?level=X</code> – Geschenk für Level X (1-12):
      <ul>
        <li>Gleiches Level → Timer Reset</li>
        <li>+1 → Level hoch</li>
        <li>-1 → Level runter</li>
        <li>Sonst ignoriert</li>
      </ul>
    </li>
  </ul>

  <p class="hint warn">
    Änderungen an Port/Aktivierung/Bind werden erst nach „Speichern" wirksam.
  </p>
</div>

<style>
  h2 {
    font-size: 14px;
    margin-bottom: 12px;
    font-family: system-ui, sans-serif;
  }
  h3 {
    font-size: 12px;
    margin: 12px 0 4px;
    color: #ddd;
    font-family: system-ui, sans-serif;
  }
  .field {
    margin-bottom: 10px;
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
    margin-top: 2px;
  }
  .hint.warn {
    color: #d4a046;
    margin-top: 10px;
  }
  .urls {
    background: rgba(0, 0, 0, 0.3);
    padding: 10px;
    border-radius: 4px;
    margin-top: 12px;
    font-family: system-ui, sans-serif;
  }
  .url-row {
    font-size: 11px;
    margin: 2px 0;
  }
  code {
    font-family: ui-monospace, monospace;
    background: rgba(255, 255, 255, 0.06);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
    color: #d4d4d8;
  }
  ul {
    list-style: none;
    padding-left: 4px;
    font-size: 11px;
    color: #ccc;
  }
  ul li {
    margin: 2px 0;
  }
  ul ul {
    margin-left: 14px;
    font-size: 10px;
    color: #999;
  }
</style>
