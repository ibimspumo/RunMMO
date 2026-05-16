# RunMMO

TikTok-Streamer Overlay als Tauri 2 App. Wird über Webhooks von externen Tools
(TikFinity, eigene Scripts) gesteuert.

**Version:** 0.0.1

## Features

- **9:16 Hochformat-Overlay**, transparent für OBS Window-Capture, Aspect-Ratio-Lock beim Resize
- **Zwei Modi**:
  - **MMO (Default)**: reine Leiter ohne Timer/Geschenk-Icons, Steuerung nur über Webhooks
  - **Simple**: klassische Leiter mit Timer pro Level (1:1 Godot-Original)
- **12 Levels** (1KMH bis 12KMH), individuell anpassbares Bild + Sound pro Level
- **Webhook-Server** (axum, lokal oder LAN):
  - `GET /up` / `GET /down` / `GET /reset`
  - `GET /gift?level=X` (gleiches Level → Timer-Reset, ±1 → Wechsel)
  - `GET /status`
- **ESC** → Settings-Panel mit Tabs für Modus, Level, Audio, Timer, Webhook, Farben, Text, Layout, Update
- **Auto-Updater** über GitHub Releases mit Check + Install Button

## Setup

```bash
npm install
```

## Entwickeln

```bash
npm run start
```

## Build (lokal, ohne Update-Signierung)

```bash
npm run tauri build
```

## Tastatur-Shortcuts

- `W` / `↑` — Level hoch
- `S` / `↓` — Level runter
- `R` — Reset
- `T` — Timer Start/Stop (nur Simple-Modus)
- `P` — Status in Konsole
- `H` — Hilfe in Konsole
- `ESC` — Settings öffnen/schließen
- **Fenster verschieben:** überall auf der Leiter klicken+ziehen, oder im Settings-Panel die Titelzeile

## Release-Workflow (GitHub)

### 1. Signing-Keys generieren (einmalig)

```bash
npm run tauri signer generate -- -w ~/.tauri/runmmo.key
```

Das erzeugt zwei Dateien:
- `~/.tauri/runmmo.key` — **private** Key (geheim halten)
- `~/.tauri/runmmo.key.pub` — public Key

Den Inhalt von `runmmo.key.pub` in [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json)
ins Feld `plugins.updater.pubkey` einsetzen (ersetzt den
`REPLACE_WITH_PUBKEY_FROM_TAURI_SIGNER_GENERATE`-Platzhalter).

### 2. GitHub Repo-Secrets setzen

Unter **Settings → Secrets and variables → Actions** im GitHub-Repo:

| Secret | Inhalt |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Inhalt von `~/.tauri/runmmo.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Passwort, das du beim Generieren gesetzt hast |

### 3. Endpunkt-URL anpassen

In [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) den Endpunkt im
`plugins.updater.endpoints` Array vom Platzhalter `__GH_USER__` auf den echten
GitHub-User/Org-Namen ändern:

```json
"endpoints": [
  "https://github.com/DEIN_USER/RunMMO/releases/latest/download/latest.json"
]
```

### 4. Release veröffentlichen

```bash
# Version bumpen (3 Dateien: package.json, Cargo.toml, tauri.conf.json,
# außerdem src/lib/version.ts für die UI-Anzeige)
git add -A
git commit -m "release v0.0.2"
git tag v0.0.2
git push origin main --tags
```

Das pusht den Tag und triggert [.github/workflows/release.yml](.github/workflows/release.yml):
- Build auf Windows + macOS
- Signiert die Updater-Artefakte mit `TAURI_SIGNING_PRIVATE_KEY`
- Erzeugt `latest.json` mit Versionsinfo + Download-URLs + Signaturen
- Lädt alle Artefakte als GitHub-Release-Assets hoch
- Setzt das Release von Draft auf publiziert

### 5. Update in der App holen

Nutzer öffnen ESC → Tab „Update" → „Nach Updates suchen". Falls eine neuere
Version vorhanden ist, zeigt die App Versionsnummer + Changelog, lädt das
Update mit Fortschrittsanzeige herunter und installiert + relauncht.

## Architektur

- **Frontend** (Svelte 4 + TypeScript): rendert Overlay, hält Spielzustand, spielt Sounds
- **Backend** (Rust + axum): hostet Webhook-Server, leitet HTTP-Requests per Tauri-Event ans Frontend weiter
- **Persistenz**: `tauri-plugin-store` → `settings.json` im OS-Config-Ordner
- **Updates**: `tauri-plugin-updater` + GitHub Releases

## Plattformen

- ✅ Windows (primär)
- ✅ macOS (Cross-Dev)
