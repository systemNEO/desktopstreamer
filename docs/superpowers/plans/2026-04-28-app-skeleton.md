# App-Skeleton + UI-Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine startbare Electron-App mit drei vollständigen UI-Views (SourcePicker, DestinationPicker, StreamControl), IPC-Schicht, ConfigStore und funktionsfähigem Linux-Build — als solide Grundlage, die in Plan B2 mit echter libobs-Integration belebt wird.

**Architecture:** Klassisches Electron-Layout mit getrenntem Main-Process (Node.js, später libobs/keytar/ssh) und Renderer-Process (Chromium + React). Die beiden Welten kommunizieren ausschließlich über typed IPC-Channels (kein `nodeIntegration`, voller `contextIsolation`). UI wird mit React + Vite gebaut, Styling via Tailwind, State pro View lokal mit React-Hooks (kein globaler Store für v1 nötig — alle persistierten Werte via IPC zum ConfigStore).

**Tech Stack:**
- Electron 33 (oder neueste stabile Version zum Implementations-Zeitpunkt)
- TypeScript 5.x
- Vite 5.x + `electron-vite` für integriertes Main+Renderer-Bundling
- React 18 + Tailwind CSS 3.x
- Vitest (Unit-Tests, schnell, Vite-nativ)
- Playwright (E2E gegen Electron)
- electron-store (persistierte Settings)
- electron-builder (Linux-Build für Dev-Smoke-Test; Multi-Arch-Windows-Build kommt in Plan B5)

---

## File Structure

```
app/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── electron.vite.config.ts          # vite-config für main + preload + renderer
├── tailwind.config.js
├── postcss.config.js
├── playwright.config.ts
├── vitest.config.ts
├── .gitignore
├── README.md
│
├── src/
│   ├── main/
│   │   ├── index.ts                 # Electron-App-Bootstrap, BrowserWindow
│   │   ├── ipc-handlers.ts          # registriert alle IPC-Handler
│   │   ├── config-store.ts          # electron-store-Wrapper mit Schema
│   │   └── credential-vault.ts      # keytar-Stub (echte Impl in Plan B2)
│   │
│   ├── preload/
│   │   └── index.ts                 # contextBridge — exponiert typed API
│   │
│   ├── shared/
│   │   ├── ipc-channels.ts          # Channel-Konstanten + Typdefinitionen
│   │   └── types.ts                 # gemeinsame Datenmodelle (Source, Destination, etc.)
│   │
│   └── renderer/
│       ├── index.html
│       ├── main.tsx                 # React-Entry
│       ├── App.tsx                  # Layout-Shell + View-Switching
│       ├── styles.css               # Tailwind-Imports
│       ├── lib/
│       │   └── ipc.ts               # Renderer-side IPC-Wrapper
│       ├── components/
│       │   ├── Header.tsx
│       │   ├── SectionCard.tsx      # wiederverwendbares Card-Wrapper
│       │   └── LiveButton.tsx
│       └── views/
│           ├── SourcePicker.tsx
│           ├── DestinationPicker.tsx
│           └── StreamControl.tsx
│
├── tests/
│   ├── unit/
│   │   ├── config-store.test.ts
│   │   ├── ipc-channels.test.ts
│   │   └── components/
│   │       └── (eine .test.tsx-Datei pro Komponente, exemplarisch)
│   └── e2e/
│       └── app-launch.spec.ts       # Playwright: App startet, alle 3 Views sichtbar
│
└── resources/
    └── icons/
        └── README.md                # placeholder (Icons kommen in Plan B5)
```

**Verantwortlichkeiten:**
- `src/main/index.ts`: Lifecycle (`app.whenReady`, single-instance lock, `BrowserWindow` mit dev-/prod-URL).
- `src/main/ipc-handlers.ts`: registriert alle `ipcMain.handle()`-Endpunkte. Dünn, delegiert an `config-store.ts` etc.
- `src/main/config-store.ts`: `electron-store` mit getypter Schema-Validierung. Default-Werte zentral.
- `src/main/credential-vault.ts`: thin `keytar`-Wrapper mit `setSecret/getSecret/deleteSecret`. In Plan B1 nur Interface + Mock; echte Impl in Plan B2 (Twitch-Token).
- `src/preload/index.ts`: `contextBridge.exposeInMainWorld('api', { ... })` mit typed methods, keine Electron-internals exposed.
- `src/shared/`: IPC-Channel-Strings + Datentypen, von Main UND Renderer importiert (single source of truth).
- `src/renderer/lib/ipc.ts`: kleiner Promise-Wrapper um `window.api.*` für ergonomische Aufrufe in React-Hooks.
- `src/renderer/components/`: kleine wiederverwendbare UI-Bausteine.
- `src/renderer/views/`: die drei Hauptansichten — jede ist eine eigene Funktionskomponente, kein Routing nötig (alle drei gleichzeitig sichtbar als Sections in `App.tsx`).

---

## Task 1: App-Verzeichnis und package.json

**Files:**
- Create: `app/package.json`
- Create: `app/.gitignore`

- [ ] **Step 1: App-Verzeichnis anlegen**

```bash
cd /home/hpb/projects/desktopstreamer
mkdir -p app
```

- [ ] **Step 2: package.json schreiben**

Erstelle `app/package.json`:

```json
{
  "name": "desktopstreamer",
  "version": "0.1.0",
  "description": "Discord-artige Desktop-Streaming-App",
  "license": "GPL-2.0-or-later",
  "author": "systemNEO",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "package": "electron-vite build && electron-builder",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
    "lint": "eslint src --ext ts,tsx"
  },
  "dependencies": {
    "electron-store": "^10.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "electron-vite": "^2.3.0",
    "eslint": "^9.0.0",
    "postcss": "^8.4.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  },
  "build": {
    "appId": "app.desktopstreamer",
    "productName": "Desktopstreamer",
    "directories": {
      "output": "dist"
    },
    "linux": {
      "target": ["AppImage"],
      "category": "AudioVideo"
    }
  }
}
```

- [ ] **Step 3: .gitignore schreiben**

Erstelle `app/.gitignore`:

```
node_modules/
out/
dist/
.vite-cache/
test-results/
playwright-report/
*.log
.env
.env.local
```

- [ ] **Step 4: npm install**

Run:
```bash
cd /home/hpb/projects/desktopstreamer/app
npm install 2>&1 | tail -5
```

Expected: `added N packages` ohne Errors. Warnings zu peer-deps sind OK.

- [ ] **Step 5: Commit**

```bash
cd /home/hpb/projects/desktopstreamer
git add app/package.json app/package-lock.json app/.gitignore
git commit -m "feat(app): scaffold app package.json with electron-vite stack"
```

---

## Task 2: TypeScript + Vite + Tailwind Konfiguration

**Files:**
- Create: `app/tsconfig.json`, `app/tsconfig.node.json`
- Create: `app/electron.vite.config.ts`
- Create: `app/tailwind.config.js`, `app/postcss.config.js`

- [ ] **Step 1: tsconfig.json (Renderer + Shared)**

Erstelle `app/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@renderer/*": ["src/renderer/*"]
    }
  },
  "include": [
    "src/renderer/**/*",
    "src/shared/**/*",
    "src/preload/**/*",
    "tests/**/*"
  ]
}
```

- [ ] **Step 2: tsconfig.node.json (Main-Process)**

Erstelle `app/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/main/**/*", "src/shared/**/*", "electron.vite.config.ts"]
}
```

- [ ] **Step 3: electron.vite.config.ts**

Erstelle `app/electron.vite.config.ts`:

```typescript
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        '@renderer': resolve(__dirname, 'src/renderer')
      }
    },
    plugins: [react()]
  }
});
```

- [ ] **Step 4: Tailwind- und PostCSS-Config**

Erstelle `app/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        // Discord-inspirierte Palette
        bg: { DEFAULT: '#1e1f22', surface: '#2b2d31', hover: '#35373c' },
        accent: { DEFAULT: '#5865f2', live: '#f04747' },
        text: { primary: '#f2f3f5', muted: '#b5bac1' }
      }
    }
  },
  plugins: []
};
```

Erstelle `app/postcss.config.js`:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

- [ ] **Step 5: Typecheck-Smoke**

Run:
```bash
cd /home/hpb/projects/desktopstreamer/app
npx tsc --noEmit -p tsconfig.json 2>&1 | tail -10
npx tsc --noEmit -p tsconfig.node.json 2>&1 | tail -10
```

Expected: kein Output (= keine Fehler) — beide configs sind valide. Es kann zu „No inputs were found"-Warnungen kommen, weil noch keine .ts-Dateien existieren — das ist OK.

- [ ] **Step 6: Commit**

```bash
git add app/tsconfig.json app/tsconfig.node.json app/electron.vite.config.ts app/tailwind.config.js app/postcss.config.js
git commit -m "feat(app): add typescript, vite, and tailwind configs"
```

---

## Task 3: Vitest- und Playwright-Setup

**Files:**
- Create: `app/vitest.config.ts`
- Create: `app/playwright.config.ts`

- [ ] **Step 1: vitest.config.ts**

Erstelle `app/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer')
    }
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    globals: true,
    setupFiles: []
  }
});
```

- [ ] **Step 2: playwright.config.ts**

Erstelle `app/playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    trace: 'on-first-retry'
  },
  reporter: 'list'
});
```

- [ ] **Step 3: jsdom + testing-libs als devDeps**

Run:
```bash
cd /home/hpb/projects/desktopstreamer/app
npm install --save-dev jsdom @testing-library/react @testing-library/jest-dom 2>&1 | tail -3
```

Expected: 3 Pakete hinzugefügt.

- [ ] **Step 4: Smoke-Test mit leerer Test-Datei**

Erstelle `app/tests/unit/_smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('vitest läuft', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run:
```bash
cd /home/hpb/projects/desktopstreamer/app
npx vitest run 2>&1 | tail -10
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add app/vitest.config.ts app/playwright.config.ts app/tests/unit/_smoke.test.ts app/package.json app/package-lock.json
git commit -m "feat(app): add vitest and playwright configs with smoke test"
```

---

## Task 4: Shared Types und IPC-Channels

**Files:**
- Create: `app/src/shared/types.ts`
- Create: `app/src/shared/ipc-channels.ts`
- Create: `app/tests/unit/ipc-channels.test.ts`

Diese Datei ist die _single source of truth_ für Datenmodelle und Channel-Strings — von Main, Preload und Renderer importiert.

- [ ] **Step 1: types.ts schreiben**

Erstelle `app/src/shared/types.ts`:

```typescript
// Source-Modelle
export type SourceKind = 'screen' | 'window' | 'audio';

export interface Source {
  id: string;            // libobs-source-id (Plan B2 füllt das)
  kind: SourceKind;
  label: string;         // human-readable
  thumbnailDataUrl?: string;  // optional preview, base64
}

// Destination-Modelle
export type DestinationKind = 'twitch' | 'local' | 'custom';

export interface CustomRtmpDestination {
  kind: 'custom';
  rtmpUrl: string;
  streamKey: string;
  outputUrl: string;     // für VRChat-URL-Anzeige; rein kosmetisch
}

export interface TwitchDestination {
  kind: 'twitch';
  // gefüllt nach OAuth-Flow in Plan B3
}

export interface LocalDestination {
  kind: 'local';
  externalAccess: boolean;  // Cloudflare-Tunnel an/aus
}

export type Destination =
  | CustomRtmpDestination
  | TwitchDestination
  | LocalDestination;

// Audio-Settings
export interface AudioSettings {
  systemAudioEnabled: boolean;
  microphoneEnabled: boolean;
}

// Stream-Stats (Live-Anzeige)
export interface StreamStats {
  bitrateKbps: number;
  droppedFrames: number;
  uptimeSeconds: number;
}

// Persistente Settings (im electron-store)
export interface AppConfig {
  selectedSourceId: string | null;
  audio: AudioSettings;
  selectedDestinationKind: DestinationKind;
  customRtmp: CustomRtmpDestination | null;
}
```

- [ ] **Step 2: ipc-channels.ts schreiben**

Erstelle `app/src/shared/ipc-channels.ts`:

```typescript
import type { AppConfig, Source, StreamStats } from './types';

// Channel-Namen — als const-Strings exportiert für Type-Safety
export const IPC = {
  config: {
    get: 'config:get',
    set: 'config:set'
  },
  sources: {
    list: 'sources:list'
  },
  stream: {
    start: 'stream:start',
    stop: 'stream:stop',
    statsSubscribe: 'stream:stats:subscribe'
  }
} as const;

// Request/Response-Signaturen pro Channel — in Preload + Handler verwendet
export interface IPCContract {
  [IPC.config.get]: {
    request: void;
    response: AppConfig;
  };
  [IPC.config.set]: {
    request: Partial<AppConfig>;
    response: AppConfig;
  };
  [IPC.sources.list]: {
    request: void;
    response: Source[];
  };
  [IPC.stream.start]: {
    request: void;  // nimmt aktuelle Config, Plan B2 füllt das
    response: { ok: true } | { ok: false; error: string };
  };
  [IPC.stream.stop]: {
    request: void;
    response: { ok: true };
  };
  [IPC.stream.statsSubscribe]: {
    request: void;
    response: StreamStats;  // periodische Updates via push
  };
}
```

- [ ] **Step 3: Test schreiben (failing)**

Erstelle `app/tests/unit/ipc-channels.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { IPC } from '@shared/ipc-channels';

describe('IPC channel constants', () => {
  it('haben eindeutige Strings', () => {
    const allChannels = [
      IPC.config.get,
      IPC.config.set,
      IPC.sources.list,
      IPC.stream.start,
      IPC.stream.stop,
      IPC.stream.statsSubscribe
    ];
    const unique = new Set(allChannels);
    expect(unique.size).toBe(allChannels.length);
  });

  it('alle Channel-Strings sind nicht-leer', () => {
    const allChannels = [
      IPC.config.get,
      IPC.config.set,
      IPC.sources.list,
      IPC.stream.start,
      IPC.stream.stop,
      IPC.stream.statsSubscribe
    ];
    for (const c of allChannels) {
      expect(c.length).toBeGreaterThan(0);
    }
  });

  it('config-Channels haben "config:"-Prefix', () => {
    expect(IPC.config.get).toMatch(/^config:/);
    expect(IPC.config.set).toMatch(/^config:/);
  });
});
```

- [ ] **Step 4: Test ausführen**

Run:
```bash
cd /home/hpb/projects/desktopstreamer/app
npx vitest run 2>&1 | tail -8
```

Expected: alle Tests in beiden Dateien (smoke + ipc-channels) PASS, also `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add app/src/shared/ app/tests/unit/ipc-channels.test.ts
git commit -m "feat(app): add shared types and ipc-channel definitions"
```

---

## Task 5: ConfigStore (Main-Process)

**Files:**
- Create: `app/src/main/config-store.ts`
- Create: `app/tests/unit/config-store.test.ts`

- [ ] **Step 1: Test schreiben (failing)**

Erstelle `app/tests/unit/config-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigStore } from '../../src/main/config-store';
import type { AppConfig } from '@shared/types';

// In-Memory-Mock von electron-store für Tests
class FakeStore<T> {
  private data: Record<string, unknown> = {};
  constructor(private opts: { defaults: T }) {
    this.data = { ...(opts.defaults as object) };
  }
  get<K extends keyof T>(key: K): T[K] {
    return this.data[key as string] as T[K];
  }
  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key as string] = value;
  }
  get store(): T {
    return { ...this.data } as T;
  }
}

describe('ConfigStore', () => {
  let configStore: ConfigStore;

  beforeEach(() => {
    const fake = new FakeStore<AppConfig>({
      defaults: {
        selectedSourceId: null,
        audio: { systemAudioEnabled: true, microphoneEnabled: true },
        selectedDestinationKind: 'custom',
        customRtmp: null
      }
    });
    configStore = new ConfigStore(fake as never);
  });

  it('getAll liefert die Defaults', () => {
    const cfg = configStore.getAll();
    expect(cfg.audio.systemAudioEnabled).toBe(true);
    expect(cfg.selectedSourceId).toBeNull();
  });

  it('update merged partial in den Store', () => {
    configStore.update({ selectedSourceId: 'src-123' });
    const cfg = configStore.getAll();
    expect(cfg.selectedSourceId).toBe('src-123');
    expect(cfg.audio.systemAudioEnabled).toBe(true);  // unchanged
  });

  it('update merged audio-Subobjekt korrekt', () => {
    configStore.update({ audio: { systemAudioEnabled: false, microphoneEnabled: true } });
    const cfg = configStore.getAll();
    expect(cfg.audio.systemAudioEnabled).toBe(false);
    expect(cfg.audio.microphoneEnabled).toBe(true);
  });

  it('update gibt aktuelle Config zurück', () => {
    const result = configStore.update({ selectedSourceId: 'foo' });
    expect(result.selectedSourceId).toBe('foo');
  });
});
```

- [ ] **Step 2: Test ausführen — sollte fehlschlagen**

Run:
```bash
npx vitest run tests/unit/config-store.test.ts 2>&1 | tail -8
```

Expected: FAIL — „Cannot find module '../../src/main/config-store'".

- [ ] **Step 3: ConfigStore implementieren**

Erstelle `app/src/main/config-store.ts`:

```typescript
import type { AppConfig } from '@shared/types';

const DEFAULTS: AppConfig = {
  selectedSourceId: null,
  audio: { systemAudioEnabled: true, microphoneEnabled: true },
  selectedDestinationKind: 'custom',
  customRtmp: null
};

// Minimal-Interface, das wir brauchen — kompatibel mit electron-store.
// In Tests wird ein FakeStore mit identischer Signatur eingeschoben.
export interface IStore<T> {
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
  readonly store: T;
}

export class ConfigStore {
  constructor(private store: IStore<AppConfig>) {}

  getAll(): AppConfig {
    return { ...this.store.store };
  }

  update(partial: Partial<AppConfig>): AppConfig {
    for (const [key, value] of Object.entries(partial)) {
      this.store.set(key as keyof AppConfig, value as never);
    }
    return this.getAll();
  }

  static defaults(): AppConfig {
    return structuredClone(DEFAULTS);
  }
}
```

- [ ] **Step 4: Test erneut ausführen**

Run:
```bash
npx vitest run tests/unit/config-store.test.ts 2>&1 | tail -8
```

Expected: alle 4 Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/config-store.ts app/tests/unit/config-store.test.ts
git commit -m "feat(app): add config-store with electron-store wrapper and tests"
```

---

## Task 6: CredentialVault-Stub

**Files:**
- Create: `app/src/main/credential-vault.ts`

In Plan B3 wird `keytar` für Twitch-Tokens genutzt. Hier nur das Interface und ein In-Memory-Stub für Tests.

- [ ] **Step 1: CredentialVault schreiben**

Erstelle `app/src/main/credential-vault.ts`:

```typescript
// Plan B3 ersetzt die In-Memory-Variante durch echte keytar-Aufrufe.
// Interface jetzt schon definieren, damit nachfolgende Module dagegen programmieren.

export interface ICredentialVault {
  setSecret(service: string, account: string, secret: string): Promise<void>;
  getSecret(service: string, account: string): Promise<string | null>;
  deleteSecret(service: string, account: string): Promise<boolean>;
}

export class InMemoryCredentialVault implements ICredentialVault {
  private secrets = new Map<string, string>();

  private key(service: string, account: string): string {
    return `${service}::${account}`;
  }

  async setSecret(service: string, account: string, secret: string): Promise<void> {
    this.secrets.set(this.key(service, account), secret);
  }

  async getSecret(service: string, account: string): Promise<string | null> {
    return this.secrets.get(this.key(service, account)) ?? null;
  }

  async deleteSecret(service: string, account: string): Promise<boolean> {
    return this.secrets.delete(this.key(service, account));
  }
}
```

- [ ] **Step 2: Smoke-Test schreiben**

Erstelle `app/tests/unit/credential-vault.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCredentialVault } from '../../src/main/credential-vault';

describe('InMemoryCredentialVault', () => {
  let vault: InMemoryCredentialVault;

  beforeEach(() => {
    vault = new InMemoryCredentialVault();
  });

  it('setSecret + getSecret round-trip', async () => {
    await vault.setSecret('twitch', 'user1', 'token-abc');
    expect(await vault.getSecret('twitch', 'user1')).toBe('token-abc');
  });

  it('getSecret liefert null wenn nicht gesetzt', async () => {
    expect(await vault.getSecret('twitch', 'unknown')).toBeNull();
  });

  it('deleteSecret entfernt und liefert true', async () => {
    await vault.setSecret('s', 'a', 'x');
    expect(await vault.deleteSecret('s', 'a')).toBe(true);
    expect(await vault.getSecret('s', 'a')).toBeNull();
  });

  it('deleteSecret liefert false wenn nichts da war', async () => {
    expect(await vault.deleteSecret('s', 'a')).toBe(false);
  });

  it('verschiedene services überschreiben sich nicht', async () => {
    await vault.setSecret('twitch', 'u', '1');
    await vault.setSecret('youtube', 'u', '2');
    expect(await vault.getSecret('twitch', 'u')).toBe('1');
    expect(await vault.getSecret('youtube', 'u')).toBe('2');
  });
});
```

- [ ] **Step 3: Tests ausführen**

Run:
```bash
npx vitest run 2>&1 | tail -8
```

Expected: alle Tests PASS (5 neue + bestehende = 9+).

- [ ] **Step 4: Commit**

```bash
git add app/src/main/credential-vault.ts app/tests/unit/credential-vault.test.ts
git commit -m "feat(app): add credential-vault interface and in-memory impl with tests"
```

---

## Task 7: Main-Process Entry und IPC-Handlers

**Files:**
- Create: `app/src/main/index.ts`
- Create: `app/src/main/ipc-handlers.ts`

- [ ] **Step 1: ipc-handlers.ts schreiben**

Erstelle `app/src/main/ipc-handlers.ts`:

```typescript
import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { AppConfig, Source, StreamStats } from '@shared/types';
import { ConfigStore } from './config-store';

export function registerIpcHandlers(configStore: ConfigStore): void {
  ipcMain.handle(IPC.config.get, (): AppConfig => configStore.getAll());

  ipcMain.handle(IPC.config.set, (_e, partial: Partial<AppConfig>): AppConfig => {
    return configStore.update(partial);
  });

  // Stub-Implementationen — Plan B2 füllt sie mit libobs-Daten.
  ipcMain.handle(IPC.sources.list, (): Source[] => {
    // Mock-Daten zum UI-Bauen. Wird von Plan B2 durch echte Source-Enumeration ersetzt.
    return [
      { id: 'mock-screen-1', kind: 'screen', label: 'Bildschirm 1' },
      { id: 'mock-window-1', kind: 'window', label: 'Mock-Fenster: Browser' },
      { id: 'mock-audio-1', kind: 'audio', label: 'Default Audio Output' }
    ];
  });

  ipcMain.handle(IPC.stream.start, (): { ok: false; error: string } => ({
    ok: false,
    error: 'Streaming-Engine kommt in Plan B2'
  }));

  ipcMain.handle(IPC.stream.stop, (): { ok: true } => ({ ok: true }));

  ipcMain.handle(IPC.stream.statsSubscribe, (): StreamStats => ({
    bitrateKbps: 0,
    droppedFrames: 0,
    uptimeSeconds: 0
  }));
}
```

- [ ] **Step 2: Main-Entry schreiben**

Erstelle `app/src/main/index.ts`:

```typescript
import { app, BrowserWindow, shell } from 'electron';
import { join } from 'path';
import Store from 'electron-store';
import type { AppConfig } from '@shared/types';
import { ConfigStore } from './config-store';
import { registerIpcHandlers } from './ipc-handlers';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#1e1f22',
    title: 'Desktopstreamer',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());

  // Externe Links im System-Browser öffnen
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // Single-instance-lock
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  // ConfigStore initialisieren
  const electronStore = new Store<AppConfig>({
    defaults: ConfigStore.defaults()
  });
  const configStore = new ConfigStore(electronStore as never);

  registerIpcHandlers(configStore);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 3: Typecheck**

Run:
```bash
cd /home/hpb/projects/desktopstreamer/app
npx tsc --noEmit -p tsconfig.node.json 2>&1 | tail -10
```

Expected: keine Errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/main/index.ts app/src/main/ipc-handlers.ts
git commit -m "feat(app): add electron main entry with ipc handler registration"
```

---

## Task 8: Preload-Script mit contextBridge

**Files:**
- Create: `app/src/preload/index.ts`

- [ ] **Step 1: Preload schreiben**

Erstelle `app/src/preload/index.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { AppConfig, Source, StreamStats } from '@shared/types';

// Typed API, exponiert auf window.api im Renderer.
const api = {
  config: {
    get: (): Promise<AppConfig> => ipcRenderer.invoke(IPC.config.get),
    set: (partial: Partial<AppConfig>): Promise<AppConfig> =>
      ipcRenderer.invoke(IPC.config.set, partial)
  },
  sources: {
    list: (): Promise<Source[]> => ipcRenderer.invoke(IPC.sources.list)
  },
  stream: {
    start: (): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke(IPC.stream.start),
    stop: (): Promise<{ ok: true }> => ipcRenderer.invoke(IPC.stream.stop),
    getStats: (): Promise<StreamStats> => ipcRenderer.invoke(IPC.stream.statsSubscribe)
  }
};

contextBridge.exposeInMainWorld('api', api);

// Type-Augment für Renderer
declare global {
  interface Window {
    api: typeof api;
  }
}

export type { api };
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd /home/hpb/projects/desktopstreamer/app
npx tsc --noEmit -p tsconfig.json 2>&1 | tail -10
```

Expected: keine Errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/preload/index.ts
git commit -m "feat(app): add preload with contextbridge api exposure"
```

---

## Task 9: Renderer Entry, Layout-Shell und CSS

**Files:**
- Create: `app/src/renderer/index.html`
- Create: `app/src/renderer/main.tsx`
- Create: `app/src/renderer/App.tsx`
- Create: `app/src/renderer/styles.css`

- [ ] **Step 1: index.html**

Erstelle `app/src/renderer/index.html`:

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;" />
    <title>Desktopstreamer</title>
  </head>
  <body class="bg-bg text-text-primary">
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: styles.css**

Erstelle `app/src/renderer/styles.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
  margin: 0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 3: main.tsx**

Erstelle `app/src/renderer/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 4: App.tsx — Layout-Shell mit drei Section-Cards**

Erstelle `app/src/renderer/App.tsx`:

```tsx
import { Header } from './components/Header';
import { SectionCard } from './components/SectionCard';
import { SourcePicker } from './views/SourcePicker';
import { DestinationPicker } from './views/DestinationPicker';
import { StreamControl } from './views/StreamControl';

export function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto px-8 py-6 space-y-6 max-w-4xl mx-auto w-full">
        <SectionCard step={1} title="Was streamen?">
          <SourcePicker />
        </SectionCard>
        <SectionCard step={2} title="Wohin streamen?">
          <DestinationPicker />
        </SectionCard>
        <SectionCard step={3} title="Stream-Kontrolle">
          <StreamControl />
        </SectionCard>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/index.html app/src/renderer/main.tsx app/src/renderer/App.tsx app/src/renderer/styles.css
git commit -m "feat(app): add renderer entry, layout shell, and tailwind styles"
```

---

## Task 10: Header- und SectionCard-Komponenten

**Files:**
- Create: `app/src/renderer/components/Header.tsx`
- Create: `app/src/renderer/components/SectionCard.tsx`
- Create: `app/tests/unit/components/SectionCard.test.tsx`

- [ ] **Step 1: Header-Komponente**

Erstelle `app/src/renderer/components/Header.tsx`:

```tsx
export function Header() {
  return (
    <header className="bg-bg-surface border-b border-bg-hover px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center font-bold">
          D
        </div>
        <h1 className="text-lg font-semibold">Desktopstreamer</h1>
      </div>
      <button
        type="button"
        aria-label="Einstellungen"
        className="text-text-muted hover:text-text-primary p-2 rounded hover:bg-bg-hover transition"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </header>
  );
}
```

- [ ] **Step 2: SectionCard-Komponente**

Erstelle `app/src/renderer/components/SectionCard.tsx`:

```tsx
import type { ReactNode } from 'react';

interface SectionCardProps {
  step: number;
  title: string;
  children: ReactNode;
}

export function SectionCard({ step, title, children }: SectionCardProps) {
  return (
    <section className="bg-bg-surface rounded-xl p-6 border border-bg-hover">
      <header className="flex items-center gap-3 mb-4">
        <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-sm font-semibold">
          {step}
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
      </header>
      <div>{children}</div>
    </section>
  );
}
```

- [ ] **Step 3: Test schreiben**

Erstelle `app/tests/unit/components/SectionCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionCard } from '../../../src/renderer/components/SectionCard';

describe('SectionCard', () => {
  it('rendert step-Nummer und Titel', () => {
    render(
      <SectionCard step={1} title="Was streamen?">
        <p>kid</p>
      </SectionCard>
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Was streamen?')).toBeInTheDocument();
  });

  it('rendert children', () => {
    render(
      <SectionCard step={2} title="t">
        <p data-testid="kid">child-content</p>
      </SectionCard>
    );
    expect(screen.getByTestId('kid')).toBeInTheDocument();
  });
});
```

Setup-File für jest-dom:

Erstelle `app/tests/unit/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

Update `app/vitest.config.ts` `setupFiles`:

```typescript
test: {
  environment: 'jsdom',
  include: ['tests/unit/**/*.test.{ts,tsx}'],
  globals: true,
  setupFiles: ['./tests/unit/setup.ts']
}
```

- [ ] **Step 4: Tests ausführen**

Run:
```bash
cd /home/hpb/projects/desktopstreamer/app
npx vitest run 2>&1 | tail -8
```

Expected: alle Tests grün, inklusive 2 neue für SectionCard.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/components/ app/tests/unit/components/SectionCard.test.tsx app/tests/unit/setup.ts app/vitest.config.ts
git commit -m "feat(app): add header and section-card components with tests"
```

---

## Task 11: Renderer-IPC-Wrapper

**Files:**
- Create: `app/src/renderer/lib/ipc.ts`

Dünner Wrapper, der `window.api` typisiert ergonomisch macht — und Tests-Mocks erleichtert.

- [ ] **Step 1: IPC-Lib schreiben**

Erstelle `app/src/renderer/lib/ipc.ts`:

```typescript
import type { AppConfig, Source, StreamStats } from '@shared/types';

export const ipc = {
  async getConfig(): Promise<AppConfig> {
    return window.api.config.get();
  },
  async setConfig(partial: Partial<AppConfig>): Promise<AppConfig> {
    return window.api.config.set(partial);
  },
  async listSources(): Promise<Source[]> {
    return window.api.sources.list();
  },
  async startStream(): Promise<{ ok: true } | { ok: false; error: string }> {
    return window.api.stream.start();
  },
  async stopStream(): Promise<{ ok: true }> {
    return window.api.stream.stop();
  },
  async getStats(): Promise<StreamStats> {
    return window.api.stream.getStats();
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add app/src/renderer/lib/ipc.ts
git commit -m "feat(app): add typed renderer ipc wrapper"
```

---

## Task 12: SourcePicker-View

**Files:**
- Create: `app/src/renderer/views/SourcePicker.tsx`
- Create: `app/tests/unit/components/SourcePicker.test.tsx`

- [ ] **Step 1: Test schreiben (failing)**

Erstelle `app/tests/unit/components/SourcePicker.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SourcePicker } from '../../../src/renderer/views/SourcePicker';

beforeEach(() => {
  // Mock window.api
  (globalThis as { window: Window }).window.api = {
    config: {
      get: vi.fn().mockResolvedValue({
        selectedSourceId: null,
        audio: { systemAudioEnabled: true, microphoneEnabled: true },
        selectedDestinationKind: 'custom',
        customRtmp: null
      }),
      set: vi.fn().mockResolvedValue({})
    },
    sources: {
      list: vi.fn().mockResolvedValue([
        { id: 's1', kind: 'screen', label: 'Bildschirm 1' },
        { id: 'w1', kind: 'window', label: 'Fenster A' },
        { id: 'a1', kind: 'audio', label: 'Mikro' }
      ])
    },
    stream: {
      start: vi.fn(),
      stop: vi.fn(),
      getStats: vi.fn()
    }
  } as never;
});

describe('SourcePicker', () => {
  it('rendert die drei Tabs (Bildschirm, Fenster, Audio)', async () => {
    render(<SourcePicker />);
    expect(await screen.findByRole('tab', { name: /bildschirm/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /fenster/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /audio/i })).toBeInTheDocument();
  });

  it('zeigt nach dem Laden Sources des aktiven Tabs', async () => {
    render(<SourcePicker />);
    await waitFor(() => {
      expect(screen.getByText('Bildschirm 1')).toBeInTheDocument();
    });
  });

  it('Audio-Toggles sind initial an', async () => {
    render(<SourcePicker />);
    const sysAudio = await screen.findByLabelText(/system-audio/i);
    const mic = screen.getByLabelText(/mikrofon/i);
    expect((sysAudio as HTMLInputElement).checked).toBe(true);
    expect((mic as HTMLInputElement).checked).toBe(true);
  });

  it('toggle Audio ruft setConfig', async () => {
    render(<SourcePicker />);
    const sysAudio = await screen.findByLabelText(/system-audio/i);
    fireEvent.click(sysAudio);
    await waitFor(() => {
      expect(window.api.config.set).toHaveBeenCalledWith({
        audio: { systemAudioEnabled: false, microphoneEnabled: true }
      });
    });
  });
});
```

- [ ] **Step 2: Test ausführen — sollte fehlschlagen**

Run:
```bash
npx vitest run tests/unit/components/SourcePicker.test.tsx 2>&1 | tail -8
```

Expected: FAIL — „Cannot find module '.../SourcePicker'".

- [ ] **Step 3: SourcePicker implementieren**

Erstelle `app/src/renderer/views/SourcePicker.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ipc } from '@renderer/lib/ipc';
import type { Source, SourceKind, AppConfig } from '@shared/types';

const TABS: { kind: SourceKind; label: string }[] = [
  { kind: 'screen', label: 'Bildschirm' },
  { kind: 'window', label: 'Fenster' },
  { kind: 'audio', label: 'Audio' }
];

export function SourcePicker() {
  const [activeTab, setActiveTab] = useState<SourceKind>('screen');
  const [sources, setSources] = useState<Source[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    void ipc.listSources().then(setSources);
    void ipc.getConfig().then(setConfig);
  }, []);

  if (!config) return <div className="text-text-muted">Lädt …</div>;

  const filtered = sources.filter((s) => s.kind === activeTab);

  async function selectSource(id: string) {
    const updated = await ipc.setConfig({ selectedSourceId: id });
    setConfig(updated);
  }

  async function toggleAudio(field: 'systemAudioEnabled' | 'microphoneEnabled') {
    if (!config) return;
    const newAudio = { ...config.audio, [field]: !config.audio[field] };
    const updated = await ipc.setConfig({ audio: newAudio });
    setConfig(updated);
  }

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-2 border-b border-bg-hover">
        {TABS.map((t) => (
          <button
            type="button"
            role="tab"
            key={t.kind}
            aria-selected={activeTab === t.kind}
            onClick={() => setActiveTab(t.kind)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === t.kind
                ? 'text-text-primary border-accent'
                : 'text-text-muted border-transparent hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 ? (
          <p className="col-span-full text-text-muted text-sm">Keine Quellen gefunden.</p>
        ) : (
          filtered.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => selectSource(s.id)}
              className={`p-3 rounded-lg border-2 text-left transition ${
                config.selectedSourceId === s.id
                  ? 'border-accent bg-bg-hover'
                  : 'border-bg-hover hover:border-text-muted'
              }`}
            >
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-xs text-text-muted">{s.kind}</div>
            </button>
          ))
        )}
      </div>

      <div className="pt-4 border-t border-bg-hover flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.audio.systemAudioEnabled}
            onChange={() => toggleAudio('systemAudioEnabled')}
            className="w-4 h-4"
          />
          System-Audio
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.audio.microphoneEnabled}
            onChange={() => toggleAudio('microphoneEnabled')}
            className="w-4 h-4"
          />
          Mikrofon
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Tests ausführen**

Run:
```bash
npx vitest run 2>&1 | tail -8
```

Expected: alle Tests PASS, inklusive 4 neue für SourcePicker.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/views/SourcePicker.tsx app/tests/unit/components/SourcePicker.test.tsx
git commit -m "feat(app): add source-picker view with tab navigation and audio toggles"
```

---

## Task 13: DestinationPicker-View

**Files:**
- Create: `app/src/renderer/views/DestinationPicker.tsx`
- Create: `app/tests/unit/components/DestinationPicker.test.tsx`

- [ ] **Step 1: Test schreiben (failing)**

Erstelle `app/tests/unit/components/DestinationPicker.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DestinationPicker } from '../../../src/renderer/views/DestinationPicker';

beforeEach(() => {
  (globalThis as { window: Window }).window.api = {
    config: {
      get: vi.fn().mockResolvedValue({
        selectedSourceId: null,
        audio: { systemAudioEnabled: true, microphoneEnabled: true },
        selectedDestinationKind: 'custom',
        customRtmp: null
      }),
      set: vi.fn(async (p) => ({
        selectedSourceId: null,
        audio: { systemAudioEnabled: true, microphoneEnabled: true },
        selectedDestinationKind: 'custom',
        customRtmp: null,
        ...p
      }))
    },
    sources: { list: vi.fn() },
    stream: { start: vi.fn(), stop: vi.fn(), getStats: vi.fn() }
  } as never;
});

describe('DestinationPicker', () => {
  it('zeigt drei Optionen (Twitch, Lokal, Custom)', async () => {
    render(<DestinationPicker />);
    expect(await screen.findByLabelText(/twitch/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lokal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/custom/i)).toBeInTheDocument();
  });

  it('Custom-RTMP zeigt Felder wenn ausgewählt', async () => {
    render(<DestinationPicker />);
    const customRadio = await screen.findByLabelText(/custom/i);
    fireEvent.click(customRadio);
    await waitFor(() => {
      expect(screen.getByLabelText(/rtmp-url/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/stream-key/i)).toBeInTheDocument();
    });
  });

  it('Twitch und Lokal zeigen Hinweise auf folgende Pläne', async () => {
    render(<DestinationPicker />);
    const twitchRadio = await screen.findByLabelText(/twitch/i);
    fireEvent.click(twitchRadio);
    await waitFor(() => {
      expect(screen.getByText(/plan b3/i)).toBeInTheDocument();
    });
    const localRadio = screen.getByLabelText(/lokal/i);
    fireEvent.click(localRadio);
    await waitFor(() => {
      expect(screen.getByText(/plan b4/i)).toBeInTheDocument();
    });
  });

  it('eingegebene RTMP-Werte werden in setConfig gespeichert (debounced/blur)', async () => {
    render(<DestinationPicker />);
    const customRadio = await screen.findByLabelText(/custom/i);
    fireEvent.click(customRadio);
    const rtmpInput = await screen.findByLabelText(/rtmp-url/i);
    fireEvent.change(rtmpInput, { target: { value: 'rtmp://test/live' } });
    fireEvent.blur(rtmpInput);
    await waitFor(() => {
      expect(window.api.config.set).toHaveBeenCalledWith(
        expect.objectContaining({
          customRtmp: expect.objectContaining({ rtmpUrl: 'rtmp://test/live' })
        })
      );
    });
  });
});
```

- [ ] **Step 2: Test ausführen — sollte fehlschlagen**

Run:
```bash
npx vitest run tests/unit/components/DestinationPicker.test.tsx 2>&1 | tail -8
```

Expected: FAIL.

- [ ] **Step 3: DestinationPicker implementieren**

Erstelle `app/src/renderer/views/DestinationPicker.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ipc } from '@renderer/lib/ipc';
import type { AppConfig, DestinationKind, CustomRtmpDestination } from '@shared/types';

const OPTIONS: { kind: DestinationKind; label: string }[] = [
  { kind: 'twitch', label: 'Twitch' },
  { kind: 'local', label: 'Lokal' },
  { kind: 'custom', label: 'Custom RTMP' }
];

const EMPTY_CUSTOM: CustomRtmpDestination = {
  kind: 'custom',
  rtmpUrl: '',
  streamKey: '',
  outputUrl: ''
};

export function DestinationPicker() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [customDraft, setCustomDraft] = useState<CustomRtmpDestination>(EMPTY_CUSTOM);

  useEffect(() => {
    void ipc.getConfig().then((cfg) => {
      setConfig(cfg);
      if (cfg.customRtmp) setCustomDraft(cfg.customRtmp);
    });
  }, []);

  if (!config) return <div className="text-text-muted">Lädt …</div>;

  async function selectKind(kind: DestinationKind) {
    const updated = await ipc.setConfig({ selectedDestinationKind: kind });
    setConfig(updated);
  }

  async function persistCustom() {
    const updated = await ipc.setConfig({ customRtmp: customDraft });
    setConfig(updated);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {OPTIONS.map((opt) => (
          <label
            key={opt.kind}
            className="flex items-center gap-3 p-3 rounded-lg bg-bg hover:bg-bg-hover cursor-pointer"
          >
            <input
              type="radio"
              name="destination"
              value={opt.kind}
              checked={config.selectedDestinationKind === opt.kind}
              onChange={() => selectKind(opt.kind)}
              className="w-4 h-4 accent-accent"
            />
            <span className="font-medium text-sm">{opt.label}</span>
          </label>
        ))}
      </div>

      {config.selectedDestinationKind === 'twitch' && (
        <div className="text-sm text-text-muted bg-bg p-3 rounded-lg">
          Twitch-Integration kommt mit Plan B3 (OAuth).
        </div>
      )}

      {config.selectedDestinationKind === 'local' && (
        <div className="text-sm text-text-muted bg-bg p-3 rounded-lg">
          Lokaler MediaMTX-Server kommt mit Plan B4.
        </div>
      )}

      {config.selectedDestinationKind === 'custom' && (
        <div className="space-y-3 bg-bg p-4 rounded-lg">
          <label className="block text-sm">
            <span className="block text-text-muted mb-1">RTMP-URL</span>
            <input
              type="text"
              placeholder="rtmp://server.example.com:1935/live"
              value={customDraft.rtmpUrl}
              onChange={(e) =>
                setCustomDraft({ ...customDraft, rtmpUrl: e.target.value })
              }
              onBlur={persistCustom}
              aria-label="RTMP-URL"
              className="w-full bg-bg-surface px-3 py-2 rounded border border-bg-hover focus:border-accent outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-text-muted mb-1">Stream-Key</span>
            <input
              type="password"
              placeholder="Vom Server-Installer ausgegeben"
              value={customDraft.streamKey}
              onChange={(e) =>
                setCustomDraft({ ...customDraft, streamKey: e.target.value })
              }
              onBlur={persistCustom}
              aria-label="Stream-Key"
              className="w-full bg-bg-surface px-3 py-2 rounded border border-bg-hover focus:border-accent outline-none font-mono"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-text-muted mb-1">
              Output-URL für VRChat (optional, rein kosmetisch)
            </span>
            <input
              type="text"
              placeholder="https://server/live/{streamkey}/index.m3u8"
              value={customDraft.outputUrl}
              onChange={(e) =>
                setCustomDraft({ ...customDraft, outputUrl: e.target.value })
              }
              onBlur={persistCustom}
              aria-label="Output-URL"
              className="w-full bg-bg-surface px-3 py-2 rounded border border-bg-hover focus:border-accent outline-none"
            />
          </label>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Tests ausführen**

Run:
```bash
npx vitest run 2>&1 | tail -8
```

Expected: alle Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/views/DestinationPicker.tsx app/tests/unit/components/DestinationPicker.test.tsx
git commit -m "feat(app): add destination-picker view with custom-rtmp form"
```

---

## Task 14: StreamControl-View

**Files:**
- Create: `app/src/renderer/components/LiveButton.tsx`
- Create: `app/src/renderer/views/StreamControl.tsx`
- Create: `app/tests/unit/components/StreamControl.test.tsx`

- [ ] **Step 1: LiveButton-Komponente**

Erstelle `app/src/renderer/components/LiveButton.tsx`:

```tsx
interface LiveButtonProps {
  isLive: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function LiveButton({ isLive, disabled, onClick }: LiveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isLive ? 'Stream stoppen' : 'Stream starten'}
      className={`px-8 py-4 rounded-xl font-bold text-base transition focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-surface ${
        disabled
          ? 'bg-bg-hover text-text-muted cursor-not-allowed'
          : isLive
          ? 'bg-accent-live hover:bg-red-700 text-white'
          : 'bg-accent hover:bg-blue-600 text-white'
      }`}
    >
      {isLive ? '⏹  Stream stoppen' : '🔴  Live gehen'}
    </button>
  );
}
```

- [ ] **Step 2: Test schreiben (failing)**

Erstelle `app/tests/unit/components/StreamControl.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { StreamControl } from '../../../src/renderer/views/StreamControl';

beforeEach(() => {
  (globalThis as { window: Window }).window.api = {
    config: {
      get: vi.fn().mockResolvedValue({
        selectedSourceId: 'src1',
        audio: { systemAudioEnabled: true, microphoneEnabled: true },
        selectedDestinationKind: 'custom',
        customRtmp: { kind: 'custom', rtmpUrl: 'rtmp://x/live', streamKey: 'k', outputUrl: '' }
      }),
      set: vi.fn()
    },
    sources: { list: vi.fn() },
    stream: {
      start: vi.fn().mockResolvedValue({ ok: true }),
      stop: vi.fn().mockResolvedValue({ ok: true }),
      getStats: vi.fn().mockResolvedValue({ bitrateKbps: 0, droppedFrames: 0, uptimeSeconds: 0 })
    }
  } as never;
});

describe('StreamControl', () => {
  it('rendert Live-Button', async () => {
    render(<StreamControl />);
    expect(await screen.findByRole('button', { name: /live gehen/i })).toBeInTheDocument();
  });

  it('Klick auf Live ruft stream.start', async () => {
    render(<StreamControl />);
    const btn = await screen.findByRole('button', { name: /live gehen/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(window.api.stream.start).toHaveBeenCalled();
    });
  });

  it('Button ist disabled wenn keine Source ausgewählt', async () => {
    (window.api.config.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedSourceId: null,
      audio: { systemAudioEnabled: true, microphoneEnabled: true },
      selectedDestinationKind: 'custom',
      customRtmp: null
    });
    render(<StreamControl />);
    const btn = await screen.findByRole('button', { name: /live gehen/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('zeigt Stats-Felder (Bitrate, Dropped, Uptime)', async () => {
    render(<StreamControl />);
    expect(await screen.findByText(/bitrate/i)).toBeInTheDocument();
    expect(screen.getByText(/dropped/i)).toBeInTheDocument();
    expect(screen.getByText(/uptime/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Test ausführen — sollte fehlschlagen**

Run:
```bash
npx vitest run tests/unit/components/StreamControl.test.tsx 2>&1 | tail -8
```

Expected: FAIL.

- [ ] **Step 4: StreamControl implementieren**

Erstelle `app/src/renderer/views/StreamControl.tsx`:

```tsx
import { useEffect, useState, useRef } from 'react';
import { ipc } from '@renderer/lib/ipc';
import { LiveButton } from '@renderer/components/LiveButton';
import type { AppConfig, StreamStats } from '@shared/types';

const ZERO_STATS: StreamStats = { bitrateKbps: 0, droppedFrames: 0, uptimeSeconds: 0 };

function formatUptime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

export function StreamControl() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [stats, setStats] = useState<StreamStats>(ZERO_STATS);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollerRef = useRef<number | null>(null);

  useEffect(() => {
    void ipc.getConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (!isLive) {
      if (pollerRef.current !== null) {
        window.clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
      return;
    }
    pollerRef.current = window.setInterval(() => {
      void ipc.getStats().then(setStats);
    }, 1000);
    return () => {
      if (pollerRef.current !== null) window.clearInterval(pollerRef.current);
    };
  }, [isLive]);

  async function toggleLive() {
    setErrorMsg(null);
    if (isLive) {
      await ipc.stopStream();
      setIsLive(false);
      setStats(ZERO_STATS);
    } else {
      const result = await ipc.startStream();
      if (result.ok) {
        setIsLive(true);
      } else {
        setErrorMsg(result.error);
      }
    }
  }

  const canGoLive = !!config?.selectedSourceId && !!config?.selectedDestinationKind;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <LiveButton isLive={isLive} disabled={!canGoLive} onClick={() => void toggleLive()} />
        {!canGoLive && (
          <p className="text-sm text-text-muted">
            Wähle zuerst eine Quelle und ein Ziel.
          </p>
        )}
      </div>

      {errorMsg && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-900 p-3 rounded-lg">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 pt-2">
        <Stat label="Bitrate" value={`${stats.bitrateKbps} kbps`} />
        <Stat label="Dropped" value={String(stats.droppedFrames)} />
        <Stat label="Uptime" value={formatUptime(stats.uptimeSeconds)} />
      </div>

      {isLive && config?.customRtmp?.outputUrl && (
        <div className="bg-bg p-3 rounded-lg">
          <div className="text-xs text-text-muted mb-1">Stream-URL für VRChat:</div>
          <code className="text-xs font-mono break-all">{config.customRtmp.outputUrl}</code>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg p-3 rounded-lg">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-lg font-mono">{value}</div>
    </div>
  );
}
```

- [ ] **Step 5: Tests ausführen**

Run:
```bash
npx vitest run 2>&1 | tail -8
```

Expected: alle Tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/renderer/views/StreamControl.tsx app/src/renderer/components/LiveButton.tsx app/tests/unit/components/StreamControl.test.tsx
git commit -m "feat(app): add stream-control view with live button and stats display"
```

---

## Task 15: Dev-Lauf und E2E-Smoke-Test

**Files:**
- Create: `app/tests/e2e/app-launch.spec.ts`

- [ ] **Step 1: E2E-Test schreiben**

Erstelle `app/tests/e2e/app-launch.spec.ts`:

```typescript
import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'path';

test('App startet und zeigt alle drei Sections', async () => {
  const app = await electron.launch({
    args: [join(__dirname, '../../out/main/index.js')],
    timeout: 15_000
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Header sichtbar
  await expect(window.getByText('Desktopstreamer')).toBeVisible();

  // Drei Section-Titel sichtbar
  await expect(window.getByText('Was streamen?')).toBeVisible();
  await expect(window.getByText('Wohin streamen?')).toBeVisible();
  await expect(window.getByText('Stream-Kontrolle')).toBeVisible();

  // Live-Button vorhanden, initial disabled (keine Source gewählt)
  const liveBtn = window.getByRole('button', { name: /live gehen/i });
  await expect(liveBtn).toBeVisible();
  await expect(liveBtn).toBeDisabled();

  await app.close();
});
```

- [ ] **Step 2: Production-Build erzeugen**

Run:
```bash
cd /home/hpb/projects/desktopstreamer/app
npm run build 2>&1 | tail -10
```

Expected: `vite build` für main, preload und renderer; outputs in `out/`.

- [ ] **Step 3: E2E-Test ausführen**

Run:
```bash
npx playwright install chromium 2>&1 | tail -3
npx playwright test 2>&1 | tail -10
```

Expected: 1 Test PASS. (WSL hat WSLg, Electron-Apps starten dort headless im virtuellen Display.)

Falls Playwright in WSL meckert über fehlende System-Libs:
```bash
sudo npx playwright install-deps
```

- [ ] **Step 4: Commit**

```bash
git add app/tests/e2e/app-launch.spec.ts
git commit -m "test(app): add e2e smoke test for app launch and section visibility"
```

---

## Task 16: app/README.md

**Files:**
- Create: `app/README.md`

- [ ] **Step 1: README schreiben**

Erstelle `app/README.md`:

````markdown
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
````

- [ ] **Step 2: Commit + Push**

```bash
git add app/README.md
git commit -m "docs(app): add app readme"
git push origin main
```

---

## Self-Review

### Spec-Coverage-Check (Plan B1 = nur App-Skeleton-Subset)

- ✅ Section 9.1 (Modul-Verantwortlichkeiten):
  - `OBSManager`: Stub via IPC-Handler in Task 7 (vollständig in Plan B2)
  - `TwitchAuth`: nicht in Plan B1 (Plan B3)
  - `LocalServerMgr`: nicht in Plan B1 (Plan B4)
  - `ConfigStore`: ✅ Task 5 mit voller Test-Coverage
  - `CredentialVault`: ✅ Task 6 als Interface + In-Memory-Stub (echte keytar-Impl in Plan B3)
- ✅ Section 4 (UI-Flow): SourcePicker (Task 12), DestinationPicker (Task 13), StreamControl (Task 14) implementiert
- ✅ Section 4.1 (YAGNI-Liste): nichts davon implementiert (Szenen, Filter, Hotkeys, Multistream)
- ✅ Section 7 (Custom-RTMP-Modus): drei Felder (RTMP-URL, Stream-Key, Output-URL) in Task 13
- ✅ TypeScript + React + Tailwind + Vitest + Playwright: Tasks 1-3
- ✅ IPC + Preload-Architektur (Section 9): Tasks 4, 7, 8, 11

**Nicht in Plan B1 (= folgende Pläne):**
- libobs-Integration (Plan B2)
- Twitch-OAuth (Plan B3)
- Lokal-MediaMTX-Bundle (Plan B4)
- Multi-Arch-Build, Code-Signing, Auto-Update (Plan B5)

### Placeholder-Scan

Geprüft auf TBD/TODO/„fill in later" — keine gefunden. Alle Steps haben kompletten Code.

### Type-Konsistenz

- `Source`, `SourceKind`, `Destination`, `AppConfig`, `StreamStats` einmal in `src/shared/types.ts` definiert, durchgängig verwendet
- `IPC`-Channel-Konstanten + `IPCContract`-Map einmal definiert, in Preload + Handlers + Renderer-Lib verwendet
- `ipc.getConfig()`-Signatur konsistent zwischen Renderer-Wrapper, Preload und Main-Handler
- `ConfigStore.update`-Signatur konsistent mit Tests
- `selectedSourceId`, `selectedDestinationKind`, `customRtmp` etc. — gleiche Schreibweise überall

Plan ist konsistent.
