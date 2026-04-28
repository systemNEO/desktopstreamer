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

## Lizenz

GPL-2.0-or-later (siehe Hauptrepo).
