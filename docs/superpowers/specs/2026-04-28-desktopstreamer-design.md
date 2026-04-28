# Desktopstreamer — Design-Dokument

**Datum:** 2026-04-28
**Status:** Draft (zur Review)
**Autor:** Brainstorming-Session zwischen User (hape@otterit.de) und Claude

---

## 1. Zielsetzung

Eine Desktop-Anwendung, die Discord-artig einfach das Streamen eines Bildschirm-, Fenster- oder Audio-Inhalts ermöglicht — primär auf **Twitch** (für die Anzeige in **VRChat**), alternativ auf einen **lokalen App-internen Server** oder einen **beliebigen Custom-RTMP-Endpunkt**. Plattform: Windows 11 (arm64, x86, x64), erweiterbar zu macOS/Linux.

**Differenzierung gegenüber OBS Studio:** drastisch reduzierter Funktionsumfang, kein Szenen-Editor, kein Filtermenü, drei-Schritt-Flow ("Was → Wohin → Live"). Wer Szenen, Filter und Studio-Features will, soll OBS nehmen.

---

## 2. System-Architektur

Drei Deliverables, zwei davon ausgeliefert:

```
┌─────────────────────────────────────┐
│  Desktop-App (Electron + Node)      │   <-- Hauptlieferung
│  - Source-Auswahl                    │
│  - Twitch-OAuth                      │
│  - Stream-Engine (libobs)            │
│  - Lokaler MediaMTX (gebundelt)      │
│  - Cloudflare-Tunnel (gebundelt)     │
└──────────────┬──────────────────────┘
               │
   RTMP-Push   │   eines von drei Zielen:
               ▼
   ┌───────────┬─────────────────┬──────────────┐
   │  Twitch   │  Lokal (in App) │  Custom-RTMP │
   │ (extern)  │  127.0.0.1:1935 │  (manuell)   │
   └───────────┴─────────────────┴──────────────┘

┌─────────────────────────────────────┐
│  Optional: Remote-Server-Bundle     │   <-- Sekundärlieferung
│  (Docker-Compose + Bash-Installer)  │
│  Für Power-User, die einen          │
│  dedizierten VPS betreiben wollen   │
└─────────────────────────────────────┘
```

### 2.1 Tech-Stack

**Desktop-App:**
- Electron (Hauptprozess + Renderer-Prozess)
- TypeScript
- React + Vite (Renderer)
- Tailwind CSS
- `obs-studio-node` (libobs-Bindings, von Streamlabs gepflegt)
- `keytar` (OS-Keystore: Windows Credential Manager)
- `ssh2` *(nur für v2 / Remote-Provisioning, nicht v1)*

**Bundled Binaries (in `resources/`):**
- `mediamtx` für Lokal-Modus (windows-amd64, windows-arm64, windows-386)
- `cloudflared` für optionalen externen Zugriff (gleiche drei Architekturen)

**Optionaler Remote-Server (separates Repo):**
- MediaMTX (Docker)
- Caddy (Auto-TLS via Let's Encrypt)
- Bash-Install-Skript

---

## 3. Streaming-Pipeline (libobs intern)

```
[Capture-Source]   →   [Scene]   →   [Encoder]   →   [Output]
 monitor_capture        1 Scene      NVENC > QSV     RTMP-Mux
 window_capture         1 Source     > AMF > x264    (FLV-Container)
 wasapi_input/output                  Auto-Detect      ↓
                                                     RTMP an
                                                     Twitch / Lokal /
                                                     Custom
```

### 3.1 Defaults v1 (nicht in UI exposed)

| Parameter | Wert |
|---|---|
| Auflösung | Quelle, gecapped auf 1920x1080 (aspect-preserving fit; Quellen ≤1080p werden nicht hochskaliert) |
| Framerate | 60 fps wenn Quelle 60 liefert, sonst 30 |
| Encoder | Hardware-Auto-Detect: NVENC → QSV → AMF → x264 |
| Video-Bitrate | 6000 kbps CBR |
| Audio-Codec | AAC, 160 kbps stereo |
| Keyframe-Interval | 2 s |
| Reconnect | aktiv, mit dynamischer Bitrate-Anpassung |

### 3.2 Audio-Mixing

Zwei aktive Tracks im libobs-Mixer:
- Track 1: System-Audio (WASAPI-Loopback der Default-Output-Device)
- Track 2: Mikrofon (WASAPI-Input der Default-Input-Device)

UI: zwei Toggles (an/aus), zwei Volume-Slider. Mehr nicht.

---

## 4. UI-Flow

Drei aufeinanderfolgende Sections in einer Hauptansicht:

```
┌────────────────────────────────────────────────┐
│ 1. Was streamen?                               │
│   ▢ Bildschirm  ▢ Fenster  ▢ Reine Audio       │
│   [Thumbnail-Grid der Quellen]                 │
│   Audio: [✓] System  [✓] Mikrofon              │
├────────────────────────────────────────────────┤
│ 2. Wohin streamen?                             │
│   (•) Twitch         [Mit Twitch verbinden ↗] │
│   ( ) Lokal          [Externer Zugriff: ▢]    │
│   ( ) Custom RTMP                              │
├────────────────────────────────────────────────┤
│ 3. Stream-Kontrolle                            │
│   [Großer roter LIVE-Button]                   │
│   Nach Start: VRChat-URL zum Kopieren          │
│   Bitrate / Dropped Frames / Uptime            │
└────────────────────────────────────────────────┘

(Zahnrad-Icon → Settings: Twitch-Account, Defaults)
```

### 4.1 Bewusst weggelassen (YAGNI)

- Szenen-Editor / Multi-Source-Komposition
- Source-Eigenschaften (Crop, Scale, Position)
- Filter (Chroma-Key, Sharpen, Compressor, etc.)
- Hotkeys, Multistream, Aufnahme-Funktion
- Chat-Overlay / Stream-Deck-Funktionen

---

## 5. Twitch-Integration

### 5.1 OAuth-Flow

- **Modus:** OAuth 2.0 mit PKCE (Public-Client-Pattern, kein Server-Secret nötig)
- **Client-ID:** in App-Binary embedded (Standard-Praxis bei OSS-Tools)
- **Scopes:** `user:read:email`, `channel:read:stream_key`
- **Flow:**
  1. App öffnet System-Browser auf `https://id.twitch.tv/oauth2/authorize`
  2. User loggt in Twitch ein und autorisiert
  3. Twitch redirected auf `http://localhost:{random-port}/callback`
  4. App fängt Code ab, tauscht gegen Access+Refresh-Token
  5. Refresh-Token in keytar persistiert, Access-Token in Memory

### 5.2 Helix-API-Calls

| Endpoint | Zweck |
|---|---|
| `GET /helix/users` | Login-Name → für VRChat-URL `https://twitch.tv/{login}` |
| `GET /helix/streams/key` | Aktueller Stream-Key |
| `GET /helix/ingests` | Regional optimaler RTMP-Ingest (informativ; in v1 verwenden wir den Default `rtmp://live.twitch.tv/app`, den Twitch automatisch geo-routet — Override via Helix-Ingests-Liste ist v1.1-Scope) |

### 5.3 VRChat-Output

Channel-URL: `https://twitch.tv/{login}` — von VRChat-Video-Playern via yt-dlp aufgelöst. Nutzer kopiert diese URL aus der App, fügt sie in VRChat-Video-Player ein.

---

## 6. Lokal-Modus

### 6.1 Bundling

```
resources/
├── mediamtx/
│   ├── mediamtx-windows-amd64.exe
│   ├── mediamtx-windows-arm64.exe
│   └── mediamtx-windows-386.exe
└── cloudflared/
    ├── cloudflared-windows-amd64.exe
    ├── cloudflared-windows-arm64.exe
    └── cloudflared-windows-386.exe
```

electron-builder packt nur das passende Binary für die jeweilige Architektur in den Installer (per `electronBuilder.files`-Filter).

### 6.2 Lifecycle

**Beim Aktivieren von "Lokal":**
1. App schreibt `mediamtx.yml` aus eingebettetem Template **bei jedem Start** neu in `%APPDATA%/desktopstreamer/mediamtx.yml` (manuelle User-Edits werden überschrieben — bewusst, damit Defaults wiederherstellbar bleiben; Custom-Configs sind v2-Scope)
2. App spawnt MediaMTX als Child-Process mit dieser Config (RTMP `:1935`, HLS `:8888`, LL-HLS aktiv)
3. App ermittelt LAN-IP via `os.networkInterfaces()`
4. UI zeigt LAN-URL: `http://192.168.x.x:8888/live/index.m3u8` (VRChat im LAN)
5. Optional-Toggle "Externer Zugriff":
   - App spawnt `cloudflared tunnel --url http://localhost:8888`
   - Parst `*.trycloudflare.com`-URL aus stdout
   - Zeigt sie als VRChat-URL an (HTTPS, von überall erreichbar)

**Beim App-Beenden / Modus-Wechsel:**
- Beide Child-Prozesse via `child.kill()` beendet
- MediaMTX-PID-File und Logs in AppData verbleiben (Debugging)

### 6.3 Sicherheits-Caveat

`trycloudflare`-Tunnels sind **öffentlich erreichbar** — jeder mit der URL kann den Stream sehen. Für Streams, die privat bleiben sollen, ist Lokal-Modus + LAN-URL die richtige Wahl. UI macht diesen Unterschied klar sichtbar.

---

## 7. Custom-RTMP-Modus

Drei Felder in der UI:
- **RTMP-URL** (z. B. `rtmp://my-server.example.com/live`)
- **Stream-Key** (frei wählbar oder vom Server vorgegeben)
- **Output-URL** (z. B. `https://my-server.example.com/live/index.m3u8` — wird beim Stream-Start zum Kopieren angezeigt für VRChat; rein kosmetisch, App probt diese URL nicht auf Erreichbarkeit)

Deckt ab: eigener Remote-Server (siehe Abschnitt 8), Restream.io, YouTube-Live (mit YouTube-Stream-Key), beliebige andere Plattformen.

---

## 8. Optionaler Remote-Server (Sekundärlieferung)

Für Power-User, die einen dedizierten VPS betreiben wollen. **Nicht in der App integriert** — manuelle Installation, dann im App-Custom-Modus eintragen.

### 8.1 Komponenten

```
desktopstreamer-server/
├── docker-compose.yml          # MediaMTX + Caddy
├── mediamtx.yml                # MediaMTX-Config
├── Caddyfile                   # Auto-TLS via Let's Encrypt
└── install.sh                  # One-line Installer
```

### 8.2 Install-Skript

Aufruf v1: `curl -fsSL https://raw.githubusercontent.com/{org}/desktopstreamer-server/main/install.sh | bash`

(Eigene Domain mit 301-Redirect ist v1.1+-Polish; GitHub-Raw-URL reicht für Launch.)

Skript-Logik:
1. `/etc/os-release` lesen → Distro-Erkennung (Ubuntu, Debian, Fedora als Tier-1; andere Distros: Warnung)
2. Docker installieren via `get.docker.com`-Skript, falls nicht vorhanden
3. Interaktive Eingabe: "Domain (j/n)?" → falls ja, Caddy mit Let's Encrypt; falls nein, IP+Port + selbst-signiertes Cert
4. Compose-File und Configs nach `/opt/desktopstreamer-server/` schreiben
5. Zufälligen Stream-Key generieren
6. `docker compose up -d` starten
7. Output: RTMP-URL, Stream-Key, HLS-URL — User kopiert in den Custom-Modus der Desktop-App

### 8.3 v2-Roadmap: SSH-Provisioning aus der App heraus

In v2 wird die Desktop-App diesen gesamten Flow übernehmen können:
- User gibt SSH-Credentials/Key in der App ein
- App SSHt sich rein (`ssh2`), führt das Install-Skript remote aus
- Pairing-Token-Austausch zur weiteren Verwaltung

Für v1 explizit nicht im Scope — der Lokal-Modus deckt 90% der Use-Cases ab.

---

## 9. Prozess-Architektur Desktop-App

```
┌──────────────────────────────────────────────┐
│ Main Process (Node.js)                       │
│  ┌────────────────┐  ┌──────────────────┐    │
│  │ OBSManager     │  │ TwitchAuth       │    │
│  │  - libobs init │  │  - PKCE OAuth    │    │
│  │  - Sources     │  │  - Helix API     │    │
│  │  - Encoders    │  │  - Token-Refresh │    │
│  │  - Output      │  └──────────────────┘    │
│  └────────────────┘  ┌──────────────────┐    │
│  ┌────────────────┐  │ LocalServerMgr   │    │
│  │ ConfigStore    │  │  - MediaMTX-Spawn│    │
│  │ (electron-store│  │  - CF-Tunnel     │    │
│  │  + keytar für  │  │  - URL-Parsing   │    │
│  │  Secrets)      │  └──────────────────┘    │
│  └────────────────┘  ┌──────────────────┐    │
│                      │ CredentialVault  │    │
│                      │  - keytar-Wrapper│    │
│                      │  - OS-Keystore   │    │
│                      └──────────────────┘    │
└─────────┬────────────────────────────────────┘
          │ IPC (typed channels)
          ▼
┌──────────────────────────────────────────────┐
│ Renderer Process (Chromium, React)           │
│  ┌──────────────────────────────────────┐    │
│  │ Views:                               │    │
│  │  - SourcePicker                      │    │
│  │  - DestinationPicker                 │    │
│  │  - StreamControl                     │    │
│  │  - Settings                          │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### 9.1 Modul-Verantwortlichkeiten

| Modul | Verantwortung | Stellt Renderer bereit |
|---|---|---|
| `OBSManager` | libobs-Lifecycle, Source-Enumeration, Scene/Encoder/Output-Konfig, Stream-Lifecycle | `listSources()`, `setSource()`, `setAudio()`, `startStream()`, `stopStream()`, `getStats()` |
| `TwitchAuth` | OAuth-Flow, Token-Persistenz, Helix-API | `connect()`, `disconnect()`, `getCurrentUser()`, `getStreamKey()`, `getIngest()` |
| `LocalServerMgr` | MediaMTX- und cloudflared-Child-Prozesse | `startLocal()`, `stopLocal()`, `enableTunnel()`, `getUrls()` |
| `ConfigStore` | App-Settings (gewähltes Ziel, letzte Source, etc.) | `get()`, `set()`, `subscribe()` |
| `CredentialVault` | OS-Keystore-Wrapper für Twitch-Refresh-Token | `setSecret()`, `getSecret()`, `deleteSecret()` |

---

## 10. Distribution

- **electron-builder** mit drei Targets:
  - `win-x64` (Windows 11 x86_64) — **Tier-1**: vollständig getestet, Release-Blocker bei Bugs
  - `win-arm64` (Windows 11 on ARM) — **Tier-2**: gebaut und Smoke-getestet, Bugs werden gefixt aber blockieren v1-Release nicht
  - `win-ia32` (Windows 11 32-bit) — **Tier-3**: best-effort, gebaut wenn Toolchain mitspielt, kein SLA
- **Code-Signing**: Standard-Cert für v1 (~$50-150/Jahr); Upgrade auf EV-Cert sobald Rev > 0
- **Auto-Update** (v1.1): `electron-updater` mit GitHub-Releases-Provider
- **CI**: GitHub Actions — Build pro Architektur, Releases auf Git-Tag

---

## 11. Risiken & Constraints

| Risiko | Konsequenz | Mitigation |
|---|---|---|
| **GPL-2.0 (libobs)** | App muss GPL-2.0-kompatibel lizenziert sein | App von Anfang an GPL-2.0; Source öffentlich auf GitHub |
| **`obs-studio-node` arm64** | Native Bindings für Windows-on-ARM noch unreif | arm64-Build prüfen; ggf. selbst kompilieren; Tier-2 markieren |
| **Code-Signing-Reputation** | Unsignierte Apps zeigen SmartScreen-Warnung | Standard-Cert + Reputation-Aufbau, später EV |
| **Twitch-ToS** | Inhalts-/Kategorie-Regeln | User-Verantwortung; ToS-Hinweis in Onboarding |
| **trycloudflare-Limits** | CF kann rate-limiten | In Doku transparent; Manual-Tunnel mit eigenem CF-Account dokumentieren |
| **Cloudflared-trycloudflare = öffentlich** | Stream theoretisch von Dritten einsehbar | UI macht Sicherheits-Hinweis sichtbar |

---

## 12. Roadmap

### v1 (MVP)

- Single-Source-Streaming (Bildschirm/Fenster/Audio)
- Twitch OAuth + Stream
- Lokal-Modus mit MediaMTX-Bundle + optionaler Cloudflare-Tunnel
- Custom-RTMP-Modus
- Windows x64 (Primärziel), arm64+x86 als Stretch-Goal
- Optionales Remote-Server-Repo (manuelle Installation)

### v1.1

- Webcam-Overlay (1 Webcam, fixe Position-Auswahl: TL/TR/BL/BR)
- Bitrate / Auflösung / FPS in UI konfigurierbar
- Auto-Update (electron-updater)

### v2

- Game-Capture-Source (DirectX/OpenGL/Vulkan-Hook für Vollbild-Spiele)
- SSH-Provisioning des Remote-Servers aus der App heraus
- macOS- und Linux-Support (libobs läuft dort, Capture-Quellen unterscheiden sich)

---

## 13. Open Questions

- **Twitch-App-Registrierung**: Wer registriert die Twitch-Developer-App (User-Account vs. Org)? Client-ID muss vor Release fix sein.
- ~~**Domain für install.sh**~~: erledigt — wird zunächst über GitHub-Raw-URL ausgeliefert; eigene Domain optional in v1.1+ als kosmetischer 301-Redirect.
- **GitHub-Repo-Org**: Persönliches Repo oder Org? Beeinflusst Issue-Tracking, Releases-URL.
- **CI-Budget**: GitHub-Actions-Free-Tier reicht für ~3 Builds/Tag; bei mehr ein eigener Runner sinnvoll.

---

## 14. Glossar

- **libobs**: C-Library im Kern von OBS Studio, kümmert sich um Capture, Encoding und Output
- **`obs-studio-node`**: Node.js-Bindings für libobs, von Streamlabs gepflegt, MIT/GPL Dual-License
- **MediaMTX**: Go-basierter Streaming-Server, RTMP-Ingest + HLS/LL-HLS/WebRTC-Output, Single-Binary
- **LL-HLS**: Low-Latency-HLS, ~3 s Latenz statt ~10-30 s bei klassischem HLS
- **PKCE**: Proof Key for Code Exchange, OAuth-Erweiterung für Public-Clients ohne Secret
- **Helix**: Twitch-API v5 (RESTful, OAuth-basiert)
- **trycloudflare**: Cloudflares Quick-Tunnel-Service, kostenlos, ohne Account, URLs sind ephemer
