<script lang="ts">
  import { check, type Update } from "@tauri-apps/plugin-updater";
  import { relaunch } from "@tauri-apps/plugin-process";
  import { APP_VERSION } from "../../version";

  type State =
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "up-to-date" }
    | { kind: "available"; update: Update }
    | { kind: "downloading"; progress: number; total: number | null }
    | { kind: "installing" }
    | { kind: "done"; willRestart: boolean }
    | { kind: "error"; message: string };

  let state: State = { kind: "idle" };

  async function checkForUpdate() {
    state = { kind: "checking" };
    try {
      const update = await check();
      if (update) {
        state = { kind: "available", update };
      } else {
        state = { kind: "up-to-date" };
      }
    } catch (err) {
      state = {
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function downloadAndInstall() {
    if (state.kind !== "available") return;
    const update = state.update;
    state = { kind: "downloading", progress: 0, total: null };

    let downloaded = 0;
    let total: number | null = null;

    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? null;
            state = { kind: "downloading", progress: 0, total };
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            state = { kind: "downloading", progress: downloaded, total };
            break;
          case "Finished":
            state = { kind: "installing" };
            break;
        }
      });

      // Auf Windows kann der Installer einen Restart erzwingen; sonst manuell.
      state = { kind: "done", willRestart: true };
      setTimeout(() => relaunch().catch(console.error), 1500);
    } catch (err) {
      state = {
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  function fmtBytes(n: number | null): string {
    if (n === null) return "?";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  function percent(s: Extract<State, { kind: "downloading" }>): number {
    if (!s.total) return 0;
    return Math.min(100, Math.round((s.progress / s.total) * 100));
  }
</script>

<h2>Updates</h2>
<p class="hint">
  Aktuelle Version: <strong>v{APP_VERSION}</strong><br />
  Updates werden über die GitHub-Releases des Projekts verteilt.
</p>

<div class="actions">
  {#if state.kind === "idle"}
    <button class="btn-primary" on:click={checkForUpdate}>
      Nach Updates suchen
    </button>
  {:else if state.kind === "checking"}
    <button class="btn-primary" disabled>Suche läuft…</button>
  {:else if state.kind === "up-to-date"}
    <div class="msg success">
      ✓ Du bist auf der neuesten Version (v{APP_VERSION}).
    </div>
    <button class="btn-secondary" on:click={checkForUpdate}>
      Erneut prüfen
    </button>
  {:else if state.kind === "available"}
    <div class="msg info">
      <strong>Update verfügbar: v{state.update.version}</strong>
      {#if state.update.date}
        <div class="meta">Veröffentlicht: {state.update.date}</div>
      {/if}
      {#if state.update.body}
        <pre class="changelog">{state.update.body}</pre>
      {/if}
    </div>
    <div class="button-row">
      <button class="btn-primary" on:click={downloadAndInstall}>
        Herunterladen & installieren
      </button>
      <button class="btn-secondary" on:click={() => (state = { kind: "idle" })}>
        Später
      </button>
    </div>
  {:else if state.kind === "downloading"}
    <div class="msg info">
      Lade herunter… {fmtBytes(state.progress)}
      {#if state.total}/ {fmtBytes(state.total)} ({percent(state)}%){/if}
      <div class="progress-bar">
        <div
          class="progress-fill"
          style="width: {state.total ? percent(state) : 100}%"
        ></div>
      </div>
    </div>
  {:else if state.kind === "installing"}
    <div class="msg info">Installiere Update…</div>
  {:else if state.kind === "done"}
    <div class="msg success">
      ✓ Update installiert. Die App startet gleich neu…
    </div>
  {:else if state.kind === "error"}
    <div class="msg error">
      Fehler: {state.message}
    </div>
    <button class="btn-secondary" on:click={() => (state = { kind: "idle" })}>
      Erneut versuchen
    </button>
  {/if}
</div>

<style>
  h2 {
    font-size: 14px;
    margin-bottom: 8px;
    font-family: system-ui, sans-serif;
  }
  .hint {
    font-size: 11px;
    color: #aaa;
    margin-bottom: 16px;
    line-height: 1.5;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .button-row {
    display: flex;
    gap: 8px;
  }
  button {
    border: none;
    border-radius: 4px;
    padding: 8px 14px;
    font-size: 12px;
    font-family: system-ui, sans-serif;
    cursor: pointer;
    align-self: flex-start;
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .btn-primary {
    background: #2563eb;
    color: white;
  }
  .btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
  }
  .btn-secondary {
    background: #2a2a30;
    color: #ddd;
  }
  .btn-secondary:hover {
    background: #3a3a42;
  }
  .msg {
    padding: 10px 12px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.5;
    font-family: system-ui, sans-serif;
  }
  .msg.success {
    background: rgba(34, 197, 94, 0.1);
    border-left: 3px solid #22c55e;
    color: #86efac;
  }
  .msg.info {
    background: rgba(37, 99, 235, 0.1);
    border-left: 3px solid #2563eb;
    color: #bfdbfe;
  }
  .msg.error {
    background: rgba(239, 68, 68, 0.1);
    border-left: 3px solid #ef4444;
    color: #fca5a5;
  }
  .meta {
    font-size: 10px;
    color: #999;
    margin-top: 4px;
  }
  .changelog {
    margin-top: 8px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 3px;
    font-size: 11px;
    color: #ccc;
    white-space: pre-wrap;
    font-family: ui-monospace, monospace;
    max-height: 200px;
    overflow-y: auto;
  }
  .progress-bar {
    margin-top: 8px;
    height: 6px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: #2563eb;
    transition: width 0.15s ease-out;
  }
</style>
