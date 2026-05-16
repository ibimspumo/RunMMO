<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import type { AppSettings } from "../../types";
  import { Callout, Card, Field, NumberInput, SectionHeader, Toggle } from "../../ui";

  export let cfg: AppSettings;

  let localIp = "";
  invoke<string>("get_local_ip").then((ip) => (localIp = ip)).catch(() => {});

  $: localhostUrl = `http://127.0.0.1:${cfg.webhookPort}`;
  $: networkUrl =
    cfg.webhookBindAllInterfaces && localIp
      ? `http://${localIp}:${cfg.webhookPort}`
      : null;

  const endpoints: { method: string; path: string; desc: string }[] = [
    { method: "GET", path: "/up", desc: "Level erhöhen" },
    { method: "GET", path: "/down", desc: "Level reduzieren" },
    { method: "GET", path: "/reset", desc: "Reset auf Level 1" },
    { method: "GET", path: "/status", desc: "Aktueller Status als JSON" },
    { method: "GET", path: "/gift?level=X", desc: "X=Level (1–12): gleiches Level → Timer-Reset, ±1 → Wechsel" },
  ];

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.warn(e);
    }
  }
</script>

<SectionHeader
  title="Webhook-Server"
  description="HTTP-Server für externe Tools wie TikFinity. Änderungen werden erst nach Speichern wirksam."
/>

<Card title="Server">
  <Field>
    <Toggle bind:checked={cfg.webhookEnabled} label="Webhook-Server aktivieren" />
  </Field>

  <Field label="Port" inline>
    <NumberInput
      bind:value={cfg.webhookPort}
      min={1}
      max={65535}
      disabled={!cfg.webhookEnabled}
      width="110px"
    />
  </Field>

  <Field
    hint="Aus → nur localhost erreichbar. An → auch aus dem lokalen Netz (anderes Gerät, TikFinity etc.)."
  >
    <Toggle
      bind:checked={cfg.webhookBindAllInterfaces}
      label="Auf allen Netzwerk-Interfaces lauschen (0.0.0.0)"
      disabled={!cfg.webhookEnabled}
    />
  </Field>
</Card>

<Card title="Verfügbare URLs">
  <div class="url-row">
    <span class="url-label">Localhost</span>
    <code>{localhostUrl}</code>
    <button class="copy" on:click={() => copy(localhostUrl)} title="Kopieren">⧉</button>
  </div>
  {#if networkUrl}
    <div class="url-row">
      <span class="url-label">Netzwerk</span>
      <code>{networkUrl}</code>
      <button class="copy" on:click={() => copy(networkUrl)} title="Kopieren">⧉</button>
    </div>
  {:else if cfg.webhookEnabled}
    <p class="hint-text">Aktiviere „Auf allen Netzwerk-Interfaces lauschen" für eine Netzwerk-URL.</p>
  {/if}
</Card>

<Card title="Endpunkte">
  <ul class="endpoints">
    {#each endpoints as e}
      <li>
        <div class="ep-head">
          <span class="method">{e.method}</span>
          <code class="path">{e.path}</code>
        </div>
        <p class="ep-desc">{e.desc}</p>
      </li>
    {/each}
  </ul>
</Card>

<Callout variant="warn">
  Änderungen an <strong>Port</strong>, <strong>Aktivierung</strong> oder <strong>Bind</strong> werden erst nach „Speichern" wirksam — der Server wird dann neu gestartet.
</Callout>

<style>
  .url-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .url-label {
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    width: 70px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  code {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--c-text);
    background: var(--c-bg-0);
    padding: 5px 10px;
    border-radius: var(--r-sm);
    border: 1px solid var(--c-border);
    white-space: nowrap;
    overflow-x: auto;
    scrollbar-width: thin;
  }
  code::-webkit-scrollbar { height: 4px; }
  code::-webkit-scrollbar-thumb { background: var(--c-bg-3); border-radius: 2px; }
  .copy {
    background: var(--c-bg-3);
    border: 1px solid var(--c-border);
    color: var(--c-text-muted);
    width: 30px;
    height: 28px;
    border-radius: var(--r-sm);
    cursor: pointer;
    font-size: 14px;
    flex-shrink: 0;
  }
  .copy:hover {
    background: var(--c-bg-4);
    color: var(--c-text);
  }
  .hint-text {
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    margin: 0;
  }
  .endpoints {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .endpoints li {
    padding: var(--sp-2) var(--sp-3);
    background: var(--c-bg-0);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
  }
  .ep-head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    overflow-x: auto;
    /* Auf schmalen Screens: URL bleibt vollständig sichtbar via Scroll */
    scrollbar-width: thin;
  }
  .ep-head::-webkit-scrollbar { height: 4px; }
  .ep-head::-webkit-scrollbar-thumb { background: var(--c-bg-3); border-radius: 2px; }
  .method {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-accent);
    font-weight: 700;
    flex-shrink: 0;
  }
  .path {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--c-text);
    background: transparent;
    border: none;
    padding: 0;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .ep-desc {
    margin: var(--sp-1) 0 0;
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    line-height: 1.4;
  }
</style>
