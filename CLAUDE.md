# CLAUDE.md

Instruktionen für Claude Code beim Arbeiten an diesem Repo.

## Was ist RunMMO

Tauri 2 Desktop-App für TikTok-Streamer. Zeigt ein 9:16 transparentes Overlay
(Levelleiter 1KMH–12KMH), das per HTTP-Webhooks von externen Tools (TikFinity etc.)
gesteuert wird. Ursprünglich Godot-Prototyp — komplett auf Tauri portiert, keine
Godot-Referenz mehr im Repo.

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
    overlay/               Ladder.svelte, LevelBar.svelte, Tacho.svelte, HpBar.svelte
    editor/                Editor.svelte — Edit-Modus (Taste "E"), Drag/Resize/Center
    design/                Design.svelte + DesignPanel.svelte + schemas.ts +
                           fields/ — Design-Modus (Taste "D"), Style-Felder
                           pro Sub-Target im Overlay
    settings/              Settings.svelte + sections/*.svelte
    ui/                    Design-System: tokens.css + Atom-Komponenten
                           (Button, Card, Field, FilePicker, …)
  assets/defaults/         Gebündelte Default-Grafiken + Sounds
src-tauri/
  src/
    main.rs                bin entry
    lib.rs                 Builder, Plugins, AppState
    webhook.rs             axum-Routen + Server-Lifecycle
    commands.rs            #[tauri::command] Funktionen
  tauri.conf.json          Fenster, Plugins, Updater
  capabilities/default.json Permissions
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
3. **Klassifizieren — die Drei-Modi-Regel (siehe unten)**:
   - **Inhalt/Technik** → in eine Settings-Section (`src/lib/settings/sections/*.svelte`)
   - **Position/Größe** → in den **Edit-Modus** (`buildEditTargets` in `App.svelte`)
   - **Visueller Stil** → in den **Design-Modus** (Schema in `src/lib/design/schemas.ts`)
4. Falls Backend-relevant: an `apply_settings` weitergeben

## Modi

`cfg.mode`:
- **`"mmo"`** (Default): kein Timer, keine Geschenk-Icons im UI, Level nur via Webhook
- **`"simple"`**: Klassisch, Timer pro Level, Geschenke an Nachbar-Levels

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
- **Auto-Skalierung**: Inhalt skaliert proportional mit Fensterbreite (Referenz 450px). Pro-Element-Skalierung über die jeweiligen `*Scale`-Felder im Settings-Modell (vom Edit-Modus verwaltet).
- **Transparenz**: `transparent: true` + `decorations: false` für OBS Window-Capture

## Die Drei-Modi-Regel (sehr wichtig)

RunMMO trennt Overlay-Einstellungen strikt nach Verantwortlichkeit. **Jeder neue
Setting/Token gehört in genau einen dieser drei Orte** — niemals doppelt pflegen,
und niemals Stil/Position in den Settings-Sections als Number-Input.

| Modus | Taste | Datei(en) | Verantwortlich für |
|-------|-------|-----------|--------------------|
| **Settings** | ESC | `src/lib/settings/sections/*.svelte` | Inhalt & Technik (Webhook-Port, Modus, Level-Assets, Sounds, Spielmechanik-Werte, **Inhalts-Farben** wie `levelColors`) |
| **Edit-Modus** | E | `src/lib/editor/Editor.svelte` + `buildEditTargets()` in `App.svelte` | Position & Größe per Drag/Resize (`<name>X/Y/Scale`, `<name>Width/Height`) |
| **Design-Modus** | D | `src/lib/design/Design.svelte` + Schema in `src/lib/design/schemas.ts` | Visueller Stil: Farben, Border-Radius, Schatten, Outline, Padding, Schriftgrößen, alles Dekorative |

Edit- und Design-Modus sind **mutex** und ausschließlich am Overlay (kein UI-Panel).
Beide ändern den Store live und persistieren beim Verlassen (`saveSettings` in
`exitEditMode` / `exitDesignMode`).

### Pflichten bei neuem Overlay-Element

1. **Settings-Felder anlegen** (in `types.ts` + `defaults.ts`):
   - Position/Größe: `<name>X`, `<name>Y`, `<name>Scale` (uniform) oder `<name>Width/Height` (wh).
     Werte im Referenz-450px-Raum, werden mit `windowWidth/450` skaliert.
   - Stil: ganz normale Felder am `AppSettings`-Root oder als verschachteltes Objekt
     (Schemas können Punkt-Pfade wie `mySection.color`).
   - Inhalt: ganz normale Felder.

2. **Komponente bauen**:
   - Props `editMode: boolean` UND `designMode: boolean`.
   - `data-tauri-drag-region={editMode || designMode ? null : true}` auf der äußeren Hülle
     (sonst zieht der User das Fenster statt das Element).
   - `getElement()` exportieren, das das outer DOM-Element zurückgibt (für Editor-Bbox).
   - Pro klickbarem Sub-Bereich (Bar, Text, …) ein `data-design-target={designMode ? "<schemaId>" : null}`.
   - Text-Elemente, deren Bbox sonst den ganzen Container füllt (z.B. flex-centered Spans
     mit `inset: 0`), in einen inneren `<span class="*-inner">` mit `display: inline-block`
     wrappen und `data-design-target` auf den inneren Span setzen — sonst überdeckt die
     Text-Hit-Box den Balken.

3. **In `App.svelte`**:
   - Komponente mit `bind:this={...Ref}` rendern, `{editMode}` UND `{designMode}` weiterreichen.
   - `buildEditTargets()` einen neuen Eintrag liefern lassen (`kind: "uniform"` oder `kind: "wh"`).

4. **In `src/lib/design/schemas.ts`**:
   - Pro Sub-Target ein `DesignSchema` mit `id` (= dein `data-design-target`-Wert),
     `label` (Panel-Header) und `fields: FieldDef[]`. Field-Kinds: `color`, `number`,
     `toggle`, `select`, `group` (visueller Divider, kein Wert).
   - Wenn ein Toggle den ganzen Sub-Bereich versteckt (z.B. `streamHpShowNumbers`),
     gehört der Toggle ins **Container-Schema** (`hp.bar`), nicht ins versteckte
     Schema (`hp.text`) — sonst kann der User es nicht mehr einschalten.

5. **Settings-Section bleibt schlank**: nur Inhalt/Technik. Falls Style-Felder
   früher dort waren → entfernen, durch `<Callout variant="info">` ersetzen mit
   Hinweis auf Edit-/Design-Modus.

### Pflichten bei neuem Design-Token an bestehendem Element

- **Nicht** in eine Settings-Section. In das passende `DesignSchema` einreihen
  (`src/lib/design/schemas.ts`). Falls noch kein passendes Sub-Target existiert,
  ein neues anlegen und am DOM mit `data-design-target` markieren.

## Bekannte Stolperfallen

- **Webhook-Plugins-Permissions**: Bei jedem neuen Tauri-Plugin sowohl Cargo + JS-Package + Capability-Permission (`capabilities/default.json`) ergänzen, sonst Build-Fehler.
- **Asset-Pfade vom User-Dialog**: `convertFileSrc()` braucht den `assetProtocol` in `tauri.conf.json` und `fs:scope-*-recursive` für die Pfade.
- **CSS transform + drag region**: funktioniert, weil hit-testing transformierte Geometrie respektiert.
- **Tauri-Updater `dialog: false`**: wir nutzen Custom-UI in `UpdateSection.svelte`, nicht den Standard-Dialog.
- **Design-Hit-Boxen bei zentrierten Texten**: `inset: 0` + flex-Centering macht die Text-Bbox so groß wie der Container. Inner-Span mit `display: inline-block` als Hit-Target verwenden (siehe `hp-text-inner`/`level-text-inner` als Vorbild).

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
- Edit-Modus (Position): `src/lib/editor/Editor.svelte` + `buildEditTargets` in `App.svelte`
- Design-Modus (Stil): `src/lib/design/` (Design.svelte, DesignPanel.svelte, schemas.ts, fields/)
