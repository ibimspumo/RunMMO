<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import type { AppSettings } from "../../types";
  import { Callout, Card, Field, NumberInput, SectionHeader, Toggle } from "../../ui";

  export let cfg: AppSettings;

  // Toggle bindet bool — wir spiegeln auf den string-Modus.
  let queueOn = cfg.webhookProcessingMode === "queued";
  $: cfg.webhookProcessingMode = queueOn ? "queued" : "immediate";

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
    { method: "GET", path: "/reset", desc: "Reset auf Level 1 (HP voll)" },
    { method: "GET", path: "/status", desc: "Aktueller Status als JSON" },
    { method: "GET", path: "/gift?level=X", desc: "X=Level (1–12): gleiches Level → Timer-Reset, ±1 → Wechsel" },
    { method: "GET", path: "/heal?amount=X", desc: "Stream-HP +X (MMO-Modus). Default X=100." },
    { method: "GET", path: "/damage?amount=X", desc: "Stream-HP −X (MMO-Modus). Default X=100." },
  ];

  // Welche Basis-URL beim Kopieren ganzer Endpunkte verwendet wird.
  let copyBase: "local" | "lan" = "local";
  $: if (copyBase === "lan" && !networkUrl) copyBase = "local";
  $: activeBaseUrl = copyBase === "lan" && networkUrl ? networkUrl : localhostUrl;

  let copiedKey: string | null = null;
  let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedKey = key;
      if (copyResetTimer) clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => (copiedKey = null), 1200);
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
    <button class="copy" on:click={() => copy(localhostUrl, "base-local")} title="Basis-URL kopieren">
      {copiedKey === "base-local" ? "✓" : "⧉"}
    </button>
  </div>
  {#if networkUrl}
    <div class="url-row">
      <span class="url-label">Netzwerk</span>
      <code>{networkUrl}</code>
      <button class="copy" on:click={() => copy(networkUrl, "base-lan")} title="Basis-URL kopieren">
        {copiedKey === "base-lan" ? "✓" : "⧉"}
      </button>
    </div>
  {:else if cfg.webhookEnabled}
    <p class="hint-text">Aktiviere „Auf allen Netzwerk-Interfaces lauschen" für eine Netzwerk-URL.</p>
  {/if}
</Card>

<Card title="Endpunkte">
  {#if networkUrl}
    <div class="base-toggle">
      <span class="base-toggle-label">Kopier-Basis:</span>
      <label class="base-chip" class:active={copyBase === "local"}>
        <input type="radio" bind:group={copyBase} value="local" />
        <span>Localhost</span>
      </label>
      <label class="base-chip" class:active={copyBase === "lan"}>
        <input type="radio" bind:group={copyBase} value="lan" />
        <span>Netzwerk</span>
      </label>
    </div>
  {/if}

  <ul class="endpoints">
    {#each endpoints as e}
      {@const fullUrl = activeBaseUrl + e.path}
      <li>
        <div class="ep-head">
          <div class="ep-scroll">
            <span class="method">{e.method}</span>
            <code class="path">{fullUrl}</code>
          </div>
          <button
            class="copy"
            on:click={() => copy(fullUrl, "ep-" + e.path)}
            title="Komplette URL kopieren"
          >{copiedKey === "ep-" + e.path ? "✓" : "⧉"}</button>
        </div>
        <p class="ep-desc">{e.desc}</p>
      </li>
    {/each}
  </ul>
</Card>

<Card title="Verarbeitung eingehender Effekte">
  <p class="hint-text" style="margin: 0 0 var(--sp-3);">
    Steuert nur <code>/gift</code>, <code>/heal</code>, <code>/damage</code> und <code>/skill</code>.
    <code>/up</code>, <code>/down</code>, <code>/reset</code> und <code>/status</code> laufen immer sofort.
  </p>

  <Field
    hint={'Sofort: Jedes eingehende Event wird unmittelbar ausgelöst (HP-Änderung, Sound, Animation). Empfohlen für Live-Streams mit vielen 1-Coin-Geschenken — der Audio-Pool fängt Bursts automatisch ab. Warteschlange: Events landen in einer FIFO und werden im eingestellten Abstand abgearbeitet — für „cinematische" Streams, bei denen jeder Effekt einzeln zur Geltung kommen soll.'}
  >
    <Toggle
      bind:checked={queueOn}
      label="Effekt-Warteschlange aktivieren (statt sofort)"
    />
  </Field>

  <Field
    label="Abstand zwischen Effekten"
    inline
    hint="Mindest-Pause zwischen zwei abgearbeiteten Effekten. Niedrige Werte (50–150 ms) wirken schnell, höhere (300–1000 ms) zelebrieren jeden Effekt einzeln."
  >
    <NumberInput
      bind:value={cfg.webhookQueueIntervalMs}
      min={10}
      max={5000}
      step={10}
      suffix="ms"
      disabled={cfg.webhookProcessingMode !== "queued"}
      width="120px"
    />
  </Field>
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
  .base-toggle {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-3);
    flex-wrap: wrap;
  }
  .base-toggle-label {
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .base-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--c-bg-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 4px 10px;
    font-size: var(--fs-xs);
    color: var(--c-text);
    cursor: pointer;
    transition: background var(--duration), border-color var(--duration);
  }
  .base-chip:hover {
    background: var(--c-bg-3);
  }
  .base-chip.active {
    background: var(--c-accent-soft, rgba(56, 189, 248, 0.18));
    border-color: var(--c-accent);
    color: var(--c-accent);
  }
  .base-chip input {
    appearance: none;
    -webkit-appearance: none;
    width: 0;
    height: 0;
    margin: 0;
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
  }
  .ep-scroll {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: thin;
  }
  .ep-scroll::-webkit-scrollbar { height: 4px; }
  .ep-scroll::-webkit-scrollbar-thumb { background: var(--c-bg-3); border-radius: 2px; }
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
