<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import type { AppSettings, SoundEntry } from "../../types";
  import { DEFAULT_UP_SOUND_URL, DEFAULT_DOWN_SOUND_URL } from "../../defaults";
  import {
    Button,
    Card,
    Field,
    SectionHeader,
    Slider,
    SoundPicker,
  } from "../../ui";
  import { previewAudio } from "../../ui/audio-preview";
  import { playWheelTick } from "../../wheel-tick-audio";
  import {
    countSoundRefs,
    defaultNameForPath,
    newSoundId,
    resolveSoundUrl,
  } from "../../sound-library";

  export let cfg: AppSettings;

  function playUp() {
    const url = resolveSoundUrl(cfg, cfg.fallbackUpSoundPath) ?? DEFAULT_UP_SOUND_URL;
    // Spot-Offset nur, wenn der User auch einen eigenen UP-Sound gewählt hat.
    const off = cfg.fallbackUpSoundPath ? cfg.fallbackUpSoundVolumeDb : 0;
    previewAudio(url, cfg.volumeDb + off);
  }
  function playDown() {
    const url = resolveSoundUrl(cfg, cfg.fallbackDownSoundPath) ?? DEFAULT_DOWN_SOUND_URL;
    const off = cfg.fallbackDownSoundPath ? cfg.fallbackDownSoundVolumeDb : 0;
    previewAudio(url, cfg.volumeDb + off);
  }

  // Kurze Tick-Salve als Hörprobe — simuliert die Verlangsamung am Spin-Ende.
  function playTickSample() {
    const delays = [0, 90, 200, 340, 510, 720, 990];
    delays.forEach((d, i) => {
      const hint = i / (delays.length - 1);
      setTimeout(() => playWheelTick(cfg.volumeDb, cfg.wheelTickVolume, hint), d);
    });
  }

  // ===== Bibliothek-Verwaltung =====
  async function addSound() {
    try {
      const file = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] },
        ],
      });
      if (typeof file !== "string") return;
      const entry: SoundEntry = {
        id: newSoundId(),
        name: defaultNameForPath(file),
        path: file,
      };
      cfg.soundLibrary = [...cfg.soundLibrary, entry];
    } catch (e) {
      console.warn("file dialog failed", e);
    }
  }

  function renameEntry(id: string, name: string) {
    cfg.soundLibrary = cfg.soundLibrary.map((e) =>
      e.id === id ? { ...e, name: name || e.name } : e,
    );
  }

  function removeEntry(id: string) {
    const entry = cfg.soundLibrary.find((e) => e.id === id);
    const uses = countSoundRefs(cfg, id);
    const extra =
      uses > 0
        ? `\n\nDer Sound wird noch an ${uses} Stelle(n) verwendet — diese werden „leer".`
        : "";
    if (!confirm(`Sound "${entry?.name ?? id}" wirklich löschen?${extra}`))
      return;
    cfg.soundLibrary = cfg.soundLibrary.filter((e) => e.id !== id);
    // Verweise (Audio-Tab + alles andere) bleiben absichtlich stehen — werden
    // beim nächsten Resolve als „leer" behandelt, der User kann den Verweis
    // bewusst aufräumen.
  }

  function previewEntry(id: string) {
    const e = cfg.soundLibrary.find((x) => x.id === id);
    if (!e) return;
    previewAudio(resolveSoundUrl(cfg, `sound:${id}`), cfg.volumeDb);
  }
</script>

<SectionHeader
  title="Audio"
  description="Lautstärke und Sound-Bibliothek. Sounds werden einmal hochgeladen und stehen dann überall zur Verfügung (Level, Skills, Effekte, Wheel-Segmente, Stream-HP)."
/>

<Card title="Lautstärke">
  <Field
    label="Master (dB)"
    hint="Beeinflusst alle Sounds. -80 = stumm, 0 = unverändert, +24 = maximal verstärkt."
  >
    <Slider
      bind:value={cfg.volumeDb}
      min={-80}
      max={24}
      step={0.5}
      format={(v) => `${v.toFixed(1)} dB`}
    />
  </Field>
  <Field hint="Testet UP- und DOWN-Sound mit der oben gewählten Lautstärke.">
    <div class="test-row">
      <Button size="sm" on:click={playUp}>▶ UP testen</Button>
      <Button size="sm" on:click={playDown}>▶ DOWN testen</Button>
    </div>
  </Field>
</Card>

<Card
  title="Glücksrad-Tick"
  hint="Dynamisch erzeugter Klick-Sound, der beim Vorbeilaufen des Pointers an einer Sektor-Grenze gespielt wird. Wird vollständig in der App synthetisiert — keine Datei nötig. 0 = aus."
>
  <Field
    label="Tick-Lautstärke"
    hint="Skaliert zusätzlich zur Master-Lautstärke. 0 deaktiviert den Tick komplett."
  >
    <Slider
      bind:value={cfg.wheelTickVolume}
      min={0}
      max={100}
      step={1}
      format={(v) => (v <= 0 ? "Aus" : `${v.toFixed(0)} %`)}
    />
  </Field>
  <Field hint="Spielt eine kurze Tick-Salve, die das Abbremsen am Spin-Ende imitiert.">
    <div class="test-row">
      <Button size="sm" on:click={playTickSample}>▶ Tick-Salve testen</Button>
    </div>
  </Field>
</Card>

<Card
  title="Sound-Bibliothek"
  hint="Zentrale Liste aller Sounds. Beim Hochladen wird ein Eintrag angelegt, den du in allen Pickern (Level-Sounds, Skill-Sounds, Wheel-Segmente, Stream-HP) auswählen kannst. Hier kannst du sie umbenennen, vorhören oder entfernen."
>
  <div class="lib-toolbar">
    <Button variant="primary" size="sm" on:click={addSound}>
      + Sound hochladen…
    </Button>
    <span class="hint-count">
      {cfg.soundLibrary.length} Eintrag{cfg.soundLibrary.length === 1 ? "" : "e"}
    </span>
  </div>

  {#if cfg.soundLibrary.length === 0}
    <div class="empty">Noch keine Sounds in der Bibliothek.</div>
  {:else}
    <div class="lib-list">
      {#each cfg.soundLibrary as entry (entry.id)}
        {@const uses = countSoundRefs(cfg, entry.id)}
        <div class="lib-row">
          <span class="row-icon">🔊</span>
          <input
            type="text"
            class="row-name"
            value={entry.name}
            on:change={(e) => renameEntry(entry.id, e.currentTarget.value)}
            on:blur={(e) => renameEntry(entry.id, e.currentTarget.value)}
          />
          <span class="row-uses" title="Anzahl Verweise in den Settings">
            {uses > 0 ? `${uses}× verwendet` : "ungenutzt"}
          </span>
          <span class="row-path" title={entry.path}>{entry.path}</span>
          <button
            class="mini-btn"
            on:click={() => previewEntry(entry.id)}
            title="Vorhören"
          >▶</button>
          <button
            class="mini-btn danger"
            on:click={() => removeEntry(entry.id)}
            title="Sound aus Bibliothek löschen"
          >✕</button>
        </div>
      {/each}
    </div>
  {/if}
</Card>

<Card title="Fallback-Sounds" hint="UP = Level wurde erhöht, DOWN = Level wurde reduziert. Werden gespielt, wenn ein Level keinen eigenen Sound zugewiesen hat.">
  <Field label="UP-Sound">
    <SoundPicker
      value={cfg.fallbackUpSoundPath}
      placeholder="Default (up.mp3)"
      volumeDb={cfg.fallbackUpSoundVolumeDb}
      on:change={(e) => (cfg.fallbackUpSoundPath = e.detail)}
      on:volumeChange={(e) => (cfg.fallbackUpSoundVolumeDb = e.detail)}
    />
  </Field>

  <Field label="DOWN-Sound">
    <SoundPicker
      value={cfg.fallbackDownSoundPath}
      placeholder="Default (down.mp3)"
      volumeDb={cfg.fallbackDownSoundVolumeDb}
      on:change={(e) => (cfg.fallbackDownSoundPath = e.detail)}
      on:volumeChange={(e) => (cfg.fallbackDownSoundVolumeDb = e.detail)}
    />
  </Field>
</Card>

<Card
  title="Extraleben"
  hint="Sound, der gespielt wird, wenn ein Extraleben durch den „Extraleben wegnehmen“-Skill vom Stack entfernt wird. Der Revive-Sound (Einlösen bei HP=0) wird im Stream-HP-Tab konfiguriert."
>
  <Field
    label="Herz-verloren-Sound"
    hint="Optional. Wird nur abgespielt, wenn tatsächlich ein Herz entfernt wurde."
  >
    <SoundPicker
      value={cfg.streamHpExtraLifeLostSoundPath}
      placeholder="Kein Sound"
      volumeDb={cfg.streamHpExtraLifeLostSoundVolumeDb}
      on:change={(e) => (cfg.streamHpExtraLifeLostSoundPath = e.detail)}
      on:volumeChange={(e) => (cfg.streamHpExtraLifeLostSoundVolumeDb = e.detail)}
    />
  </Field>
</Card>

<style>
  .test-row {
    display: flex;
    gap: var(--sp-2);
  }

  .lib-toolbar {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    margin-bottom: var(--sp-2);
  }
  .hint-count {
    font-size: var(--fs-xs);
    color: var(--c-text-dim);
    font-family: var(--font-mono);
  }
  .empty {
    color: var(--c-text-dim);
    font-style: italic;
    font-size: var(--fs-sm);
    padding: var(--sp-2) 0;
  }
  .lib-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .lib-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    background: var(--c-bg-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 4px 8px;
  }
  .row-icon {
    font-size: 14px;
    width: 20px;
    flex-shrink: 0;
    text-align: center;
  }
  .row-name {
    flex: 1;
    min-width: 100px;
    background: var(--c-bg-3);
    color: var(--c-text);
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    padding: 4px 8px;
    font-family: inherit;
    font-size: var(--fs-sm);
  }
  .row-name:hover {
    border-color: var(--c-border);
  }
  .row-name:focus {
    outline: none;
    border-color: var(--c-accent);
  }
  .row-uses {
    font-size: 10px;
    color: var(--c-text-dim);
    font-family: var(--font-mono);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .row-path {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--c-text-dim);
    flex: 0 1 35%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
  }
  .mini-btn {
    width: 26px;
    height: 26px;
    border: 1px solid var(--c-border);
    background: var(--c-bg-3);
    color: var(--c-text-muted);
    border-radius: var(--r-sm);
    cursor: pointer;
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .mini-btn:hover {
    background: var(--c-bg-4);
    color: var(--c-text);
  }
  .mini-btn.danger:hover {
    background: var(--c-danger-soft);
    color: var(--c-danger);
    border-color: var(--c-danger);
  }
</style>
