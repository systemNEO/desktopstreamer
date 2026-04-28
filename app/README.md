# desktopstreamer (app)

Electron-Desktop-App für [desktopstreamer](https://github.com/systemNEO/desktopstreamer).

## Status

Plan B1 abgeschlossen: App-Skeleton mit drei vollständigen UI-Views (SourcePicker, DestinationPicker, StreamControl), funktionierendem IPC-Layer und ConfigStore. Streaming-Engine (libobs) ist noch ein Stub — kommt in Plan B2.

## Entwickeln

Voraussetzungen:
- Node.js 20+ (LTS)
- npm 10+

```bash
cd app
npm install
npm run dev
```

Das öffnet die App im Dev-Modus mit Hot-Reload (Vite + Electron).

## Tests

```bash
# Unit-Tests (Vitest, schnell)
npm test

# E2E-Tests (Playwright gegen Electron)
npm run build
npm run test:e2e

# Typecheck
npm run typecheck
```

## Build

```bash
# Erzeugt JS-Bundles in out/
npm run build

# Erzeugt installierbares Paket (Linux: AppImage; Windows-Builds in Plan B5)
npm run package
```

## Architektur

```
src/
├── main/          # Electron Main-Process (Node.js)
├── preload/       # IPC-Bridge zwischen Main und Renderer
├── renderer/      # React-UI (Chromium)
└── shared/        # Typen + IPC-Channel-Definitionen
```

Main und Renderer kommunizieren ausschließlich über typed IPC. Renderer hat **kein** `nodeIntegration` und vollen `contextIsolation` — alle Node-APIs gehen durch die `window.api`-Bridge im Preload.

## Manueller Integration-Test mit OBS

Plan B2 bringt die OBS-Integration. Um end-to-end zu testen:

1. **Stelle sicher, dass OBS Studio installiert ist** (oder lass die App es installieren beim ersten Start — Auto-Install nur Windows; Mac/Linux manuell)
2. **Starte den Server aus Plan A** (lokal mit Docker, siehe `server/README.md`):
   ```bash
   cd ../server
   ./install.sh   # IP-Modus wählen
   # Notiere RTMP-URL, Stream-Key, HLS-URL
   ```
3. **Starte die App im Dev-Modus**:
   ```bash
   cd ../app
   npm run dev
   ```
4. **In der App:**
   - Wähle den ersten Bildschirm in Section 1
   - Klicke "Custom RTMP" in Section 2
   - Trage RTMP-URL und Stream-Key vom Server ein, blur das Feld
   - Klicke "Live gehen" in Section 3
5. **Prüfe in OBS** (im Tray): Status sollte "Streaming live" anzeigen
6. **Prüfe via curl**:
   ```bash
   curl -sLk -c /tmp/cj -b /tmp/cj "https://YOUR-SERVER/live/STREAM-KEY/index.m3u8"
   ```
   Sollte HTTP 200 mit M3U8-Manifest liefern.
7. **In VRChat**: trage die HLS-URL in einen Video-Player ein.

## Bekannte Limitierungen v1 (Plan B2)

- Nur **Bildschirm-Capture** (kein Window-Capture, kein reines Audio-Capture). Window/Audio kommen in v1.1.
- Twitch-Modus zeigt Hinweis auf Plan B3, ist nicht funktional.
- Lokal-Modus zeigt Hinweis auf Plan B4, ist nicht funktional.
- OBS Studio muss installiert sein (Auto-Install nur Windows).

## Lizenz

MIT (siehe LICENSE-Datei).
