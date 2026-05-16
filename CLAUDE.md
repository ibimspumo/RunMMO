# CLAUDE.md

Instruktionen für Claude Code beim Arbeiten an diesem Repo.

## Was ist RunMMO

Tauri 2 Desktop-App für TikTok-Streamer. Zeigt ein 9:16 transparentes Overlay
(Levelleiter 1KMH–12KMH), das per HTTP-Webhooks von externen Tools (TikFinity etc.)
gesteuert wird. Vorlage war ein Godot-Projekt im Ordner `LeiterGoDot/` — das ist
**Referenz only**, wird nicht mehr verändert oder ausgeliefert.

App-Sprache **Deutsch only**. Plattformen: Windows (primär) + macOS.

## Stack

- **Tauri 2** (Rust + Webview)
- **Frontend**: Svelte 4 + TypeScript + Vite
- **Webhook-Server**: axum 0.7 in Rust
- **Persistenz**: `tauri-plugin-store` (JSON in `%APPDATA%\de.agentz.runmmo\settings.json`)
- **Auto-Update**: `tauri-plugin-updater` über GitHub Releases mit minisign

## Architektur

State-Verantwortung:
- **Backend (Rust)** hostet den HTTP-Server und leitet Requests als Tauri-Events ans Frontend weiter
- **Frontend (Svelte)** hält den Spielzustand (Level, Timer), rendert Overlay, spielt Sounds
- `/status` GET vom Server fragt das Frontend per Event nach dem Live-State und antwortet mit dem JSON-Reply

Datenfluss: `HTTP → axum-Handler → Tauri-Event "webhook" → App.svelte handler → ladderState update → Ladder re-render`

## Verzeichnislayout

```
src/                       Svelte-Frontend
  App.svelte               Hauptkomponente: Game-Loop, ESC, Shortcuts, Aspect-Lock
  lib/
    types.ts               AppSettings, LadderState, AppMode
    defaults.ts            defaultSettings(), Color-Konvertierung
    stores.ts              Svelte stores + load/save + Event-Binding
    version.ts             APP_VERSION (manuell bei Release hochsetzen!)
    overlay/               Ladder.svelte, LevelBar.svelte
    settings/              Settings.svelte + sections/*.svelte (8 Tabs)
  assets/defaults/         Gebündelte Default-Grafiken + Sounds
src-tauri/
  src/
    main.rs                bin entry
    lib.rs                 Builder, Plugins, AppState
    webhook.rs             axum-Routen + Server-Lifecycle
    commands.rs            #[tauri::command] Funktionen
  tauri.conf.json          Fenster, Plugins, Updater
  capabilities/default.json Permissions
LeiterGoDot/               Original Godot-Projekt – nicht anfassen
.github/workflows/release.yml  Multi-Plattform Release-Pipeline
```

## Settings-Modell

`AppSettings` (siehe `src/lib/types.ts`) ist die Single-Source-of-Truth. Wird:
- beim Start aus dem Store geladen, mit `defaultSettings()` gemergt (alte JSONs bekommen neue Felder automatisch)
- nur beim Klick auf "Speichern" persistiert
- bei Speichern via `invoke("apply_settings", ...)` an Rust geschickt, um den Webhook-Server bei Änderungen (Port/Enable/BindAll) sauber neu zu starten

Wenn du ein neues Settings-Feld hinzufügst:
1. In `types.ts` ergänzen
2. In `defaults.ts` Default setzen (für Migration alter Configs)
3. Section-Component erweitern oder neue erstellen
4. Falls Backend-relevant: an `apply_settings` weitergeben

## Modi

`cfg.mode`:
- **`"mmo"`** (Default): kein Timer, keine Geschenk-Icons im UI, Level nur via Webhook
- **`"simple"`**: Godot-1:1, Timer pro Level, Geschenke an Nachbar-Levels

Beim Modus-Wechsel zur Laufzeit (`onSave` in App.svelte) wird der State angepasst.
Logik, die nur einen Modus betrifft, **immer** mit `if (cfg.mode === "simple")` gaten.

## Versionierung & Release

Version steht an **vier** Stellen — alle gleichzeitig hochsetzen:
1. `package.json`
2. `src-tauri/Cargo.toml`
3. `src-tauri/tauri.conf.json`
4. `src/lib/version.ts` (`APP_VERSION` — UI-Anzeige)

Release-Flow:
```bash
# Versionen patchen, Cargo.lock aktualisieren (cargo check), committen
git tag vX.Y.Z
git push origin main --tags
```

Der Tag triggert `.github/workflows/release.yml`. Builds laufen auf
`windows-latest` + `macos-latest` (universal), `tauri-action` signiert die
Updater-Artefakte mit dem privaten minisign-Key aus den GH-Secrets und lädt
`latest.json` + Installer als Release hoch.

**Wichtig:** Kein Apple Developer Account und kein Windows Code-Signing-Cert
vorhanden. Builds sind unsigniert → SmartScreen/Gatekeeper-Warnungen für User,
aber funktional OK. Die **Update**-Signatur (minisign) ist davon unabhängig
und funktioniert.

## Webhook-API

```
GET /up               Level +1
GET /down             Level -1
GET /reset            Level → 1
GET /gift?level=X     Gleiches Level → Timer-Reset; ±1 → Wechsel; sonst ignoriert
GET /status           JSON mit current_level, time_left, is_running
```

Default-Port: 8080. `webhookBindAllInterfaces=true` → 0.0.0.0, sonst nur localhost.

## Fenster-Verhalten

- **9:16 Aspect-Lock**: JS-Resize-Listener in `App.svelte` snappt nach jedem Resize
- **Drag**: `data-tauri-drag-region` auf `.ladder`, `.level-row` und der Header-Drag-Area in Settings
- **Auto-Skalierung**: Inhalt skaliert proportional mit Fensterbreite (Referenz 450px). Multipliziert mit `cfg.overlayScale`.
- **Transparenz**: `transparent: true` + `decorations: false` für OBS Window-Capture

## Bekannte Stolperfallen

- **Webhook-Plugins-Permissions**: Bei jedem neuen Tauri-Plugin sowohl Cargo + JS-Package + Capability-Permission (`capabilities/default.json`) ergänzen, sonst Build-Fehler.
- **Asset-Pfade vom User-Dialog**: `convertFileSrc()` braucht den `assetProtocol` in `tauri.conf.json` und `fs:scope-*-recursive` für die Pfade.
- **CSS transform + drag region**: funktioniert, weil hit-testing transformierte Geometrie respektiert.
- **Tauri-Updater `dialog: false`**: wir nutzen Custom-UI in `UpdateSection.svelte`, nicht den Standard-Dialog.

## Befehle (häufig genutzt)

```bash
npm install                 # Deps installieren
npm run start               # Dev-Mode (Vite + Tauri)
npm run build               # Frontend-Build (nur Vite)
npm run tauri build         # Full Release-Build lokal
npx svelte-check --tsconfig ./tsconfig.json    # Type-Check
cd src-tauri && cargo build                    # Rust-Build only
```

## Was NICHT zu tun ist

- **Niemals** `LeiterGoDot/` modifizieren — das ist die Original-Referenz
- **Niemals** den privaten Key in `C:\Users\timo\.tauri\runmmo.key` committen
- **Niemals** den `pubkey` in `tauri.conf.json` ändern, ohne die GH-Secret
  zu rotieren — sonst können bestehende Installs keine Updates mehr verifizieren
- **Keine** automatischen Settings-Speicherungen ohne expliziten Save-Button —
  der User will Kontrolle

## Wo ich was finde

- Game-Loop & Shortcuts: `src/App.svelte`
- Bar-Rendering: `src/lib/overlay/LevelBar.svelte`
- Webhook-Routen: `src-tauri/src/webhook.rs`
- IPC-Commands: `src-tauri/src/commands.rs`
- Update-UI: `src/lib/settings/sections/UpdateSection.svelte`
- Permissions: `src-tauri/capabilities/default.json`
