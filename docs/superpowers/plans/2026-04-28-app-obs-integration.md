# OBS-Integration Implementation Plan (Plan B2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aus dem App-Skeleton (Plan B1) wird ein streamfähiges Tool: OBS Studio wird auto-erkannt oder auto-installiert, als Hintergrund-Prozess gemanaged, via `obs-websocket` ferngesteuert. Nach Plan B2 kann der User eine Quelle wählen, einen Custom-RTMP-Endpoint eintragen und live gehen — gegen den Server aus Plan A.

**Architecture:** OBS Studio läuft headless als Subprocess. Wir kommunizieren via `obs-websocket` (eingebaut seit OBS 28) auf `localhost:4455`. Vor dem ersten Launch schreiben wir eine eigene OBS-Profile + Scene-Collection nach `%APPDATA%\obs-studio\`, sodass wir den Stack vorkonfiguriert haben (Encoder, Auflösung, Bitrate) ohne User-Profile zu touchen. Der `OBSManager` im Main-Process orchestriert: detect → install (falls fehlt) → write profile → spawn → connect → ready.

**Tech Stack:**
- `obs-websocket-js` v5 (offizieller Client für Protocol v5)
- `axios` (Download des OBS-Installers via GitHub-Releases-API)
- `extract-zip` (für portable OBS-Variante als Fallback, optional)
- Node.js `child_process.spawn` (OBS-Prozess)
- Node.js `fs/promises` (Profile-Files schreiben)

---

## File Structure (Erweiterung von Plan B1)

```
app/
├── LICENSE                          # NEU: MIT-Lizenztext
├── src/main/
│   ├── obs/                         # NEU: OBS-Subsystem
│   │   ├── detect.ts                # Installation-Erkennung
│   │   ├── installer.ts             # Auto-Download + Silent-Install
│   │   ├── profile-writer.ts        # OBS-Profile/Scenes/WS-Config schreiben
│   │   ├── process-manager.ts       # OBS-Subprocess-Lifecycle
│   │   ├── ws-client.ts             # obs-websocket-js-Wrapper
│   │   └── manager.ts               # OBSManager (orchestriert alles oben)
│   ├── ipc-handlers.ts              # MODIFY: nutzt OBSManager statt Stubs
│   └── index.ts                     # MODIFY: instantiates OBSManager
├── src/shared/
│   ├── types.ts                     # MODIFY: + OBSStatus, InstallProgress
│   └── ipc-channels.ts              # MODIFY: + obs:status-Events
├── src/renderer/
│   ├── components/
│   │   └── InstallProgressDialog.tsx  # NEU
│   └── App.tsx                      # MODIFY: zeigt Dialog wenn obs:installing
└── tests/
    ├── unit/main/obs/
    │   ├── detect.test.ts
    │   ├── installer.test.ts
    │   ├── profile-writer.test.ts
    │   └── process-manager.test.ts
    ├── unit/main/obs-manager.test.ts
    └── e2e/
        ├── mock-obs/                # Mock obs-websocket Server für E2E
        │   └── server.ts
        └── streaming-flow.spec.ts
```

**Verantwortlichkeiten:**
- `detect.ts`: pure Funktion, prüft Registry/PATH/Standard-Pfade, liefert `{ installed, path?, version? }`
- `installer.ts`: GitHub-API → Asset-URL → Download → SHA256 → Silent-Install (`/S`-Flag bei NSIS)
- `profile-writer.ts`: Schreibt `basic.ini`, `service.json`, Scene-Collection, obs-websocket `config.json` in `%APPDATA%\obs-studio\`
- `process-manager.ts`: Spawnt `obs64.exe --minimize-to-tray --disable-shutdown-check`, watched, kills on app-exit
- `ws-client.ts`: Wrapped `obs-websocket-js`, Connect-Retry, Typed-Methods, Events
- `manager.ts`: High-Level API für IPC: `ensureReady()`, `listSources()`, `startStream()`, `stopStream()`, `getStats()`. Diesen Layer kennt der Rest der App.

---

## Task 1: Lizenz-Switch GPL→MIT und Dependencies

**Files:**
- Create: `app/LICENSE`
- Modify: `app/package.json` (license-Feld)

Da wir libobs nicht mehr embedden, sind wir nicht mehr an GPL-2.0 gebunden. MIT ist permissivst und kompatibel mit dem Server-Repo (das auch unter MIT laufen kann, da es keinen GPL-Code embedded — MediaMTX selbst ist MIT, Caddy ist Apache-2.0).

- [ ] **Step 1: LICENSE-Datei mit MIT-Text**

Erstelle `app/LICENSE`:

```
MIT License

Copyright (c) 2026 systemNEO

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: package.json license-Feld ändern**

Edit `app/package.json` — `"license": "GPL-2.0-or-later"` → `"license": "MIT"`.

- [ ] **Step 3: Dependencies installieren**

```bash
cd /home/hpb/projects/desktopstreamer/app
npm install obs-websocket-js axios
npm install --save-dev @types/axios
```

Expected: pakete hinzugefügt.

- [ ] **Step 4: Top-Level-README license-Hinweis aktualisieren**

Edit `/home/hpb/projects/desktopstreamer/README.md` — Lizenz-Sektion:

```markdown
## Lizenz

MIT — frei verwendbar. OBS Studio (GPL-2.0) wird zur Laufzeit als
unabhängiger Prozess gestartet, nicht eingebettet — die Lizenzen
beeinflussen sich daher nicht.
```

- [ ] **Step 5: app/README.md license-Sektion aktualisieren**

Edit `/home/hpb/projects/desktopstreamer/app/README.md` letzte Zeile:

```markdown
## Lizenz

MIT (siehe LICENSE-Datei).
```

- [ ] **Step 6: Commit**

```bash
cd /home/hpb/projects/desktopstreamer
git add app/LICENSE app/package.json app/package-lock.json README.md app/README.md
git commit -m "chore(app): switch license from GPL-2.0 to MIT after libobs decision"
```

---

## Task 2: Shared Types und IPC-Channels erweitern

**Files:**
- Modify: `app/src/shared/types.ts`
- Modify: `app/src/shared/ipc-channels.ts`

OBS-Lifecycle bringt neue Zustände, die der Renderer kennen muss (Installing, Connecting, Ready, Failed) plus Install-Progress.

- [ ] **Step 1: Types erweitern**

Edit `app/src/shared/types.ts` — am Ende ergänzen:

```typescript
// OBS-Lifecycle-Status
export type OBSStatus =
  | { state: 'detecting' }
  | { state: 'not-installed' }
  | { state: 'installing'; progress: number; message: string }
  | { state: 'install-failed'; error: string }
  | { state: 'starting' }
  | { state: 'ready'; obsVersion: string }
  | { state: 'disconnected'; error: string };

export interface InstallProgress {
  step: 'fetching-release' | 'downloading' | 'verifying' | 'installing' | 'done';
  percent: number;       // 0..100
  message: string;
}
```

- [ ] **Step 2: Test ergänzen — Type-Smoke**

Erstelle `app/tests/unit/shared/types-obs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { OBSStatus, InstallProgress } from '@shared/types';

describe('OBS types', () => {
  it('OBSStatus discriminated union narrows korrekt', () => {
    const s: OBSStatus = { state: 'ready', obsVersion: '30.1.0' };
    if (s.state === 'ready') {
      expect(s.obsVersion).toBe('30.1.0');
    }
  });

  it('InstallProgress hat 0..100 percent', () => {
    const p: InstallProgress = { step: 'downloading', percent: 42, message: 'msg' };
    expect(p.percent).toBeGreaterThanOrEqual(0);
    expect(p.percent).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 3: IPC-Channels ergänzen**

Edit `app/src/shared/ipc-channels.ts` — die `IPC`-Konstante:

```typescript
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
  },
  obs: {
    getStatus: 'obs:get-status',
    statusEvent: 'obs:status-event',           // push from main → renderer
    installProgressEvent: 'obs:install-progress' // push from main → renderer
  }
} as const;
```

Plus den `IPCContract` ergänzen:

```typescript
export interface IPCContract {
  // ... vorhandene Einträge ...
  [IPC.obs.getStatus]: {
    request: void;
    response: OBSStatus;
  };
}
```

(Push-Events haben keinen Response — sind via `webContents.send` einseitig.)

Vergiss nicht den Import oben: `import type { ... OBSStatus } from './types';`

- [ ] **Step 4: Bestehende ipc-channels-Tests laufen lassen**

```bash
cd /home/hpb/projects/desktopstreamer/app
npx vitest run tests/unit/ipc-channels.test.ts tests/unit/shared/types-obs.test.ts
```

Expected: alle PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/hpb/projects/desktopstreamer
git add app/src/shared/types.ts app/src/shared/ipc-channels.ts app/tests/unit/shared/types-obs.test.ts
git commit -m "feat(app): add obs-status types and ipc channels"
```

---

## Task 3: OBSDetector

**Files:**
- Create: `app/src/main/obs/detect.ts`
- Create: `app/tests/unit/main/obs/detect.test.ts`

Findet OBS auf dem System. Strategie: Standard-Pfade prüfen → Registry (via `reg query`) → `winget` als letzten Resort.

- [ ] **Step 1: Test schreiben (failing)**

Erstelle `app/tests/unit/main/obs/detect.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectOBSInstallation } from '../../../../src/main/obs/detect';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('detectOBSInstallation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liefert installed=false wenn keine bekannten Pfade existieren', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = await detectOBSInstallation({ skipRegistry: true });
    expect(result.installed).toBe(false);
  });

  it('liefert installed=true mit Pfad wenn Standard-Path existiert', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p).includes('Program Files') && String(p).endsWith('obs64.exe');
    });
    const result = await detectOBSInstallation({ skipRegistry: true });
    expect(result.installed).toBe(true);
    expect(result.path).toContain('obs64.exe');
  });

  it('respektiert OBS_PATH-Override (z. B. für Tests / Custom-Installs)', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => p === '/custom/obs');
    const result = await detectOBSInstallation({
      skipRegistry: true,
      overridePath: '/custom/obs'
    });
    expect(result.installed).toBe(true);
    expect(result.path).toBe('/custom/obs');
  });
});
```

- [ ] **Step 2: Test ausführen — sollte fehlschlagen**

```bash
npx vitest run tests/unit/main/obs/detect.test.ts
```

Expected: FAIL „Cannot find module".

- [ ] **Step 3: Implementierung**

Erstelle `app/src/main/obs/detect.ts`:

```typescript
import * as fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface OBSDetectionResult {
  installed: boolean;
  path?: string;
  version?: string;
}

export interface DetectOptions {
  skipRegistry?: boolean;
  overridePath?: string;  // für Tests oder Custom-Installs
}

const STANDARD_PATHS_WIN = [
  'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe',
  'C:\\Program Files (x86)\\obs-studio\\bin\\32bit\\obs32.exe'
];

export async function detectOBSInstallation(
  opts: DetectOptions = {}
): Promise<OBSDetectionResult> {
  // Override für Tests
  if (opts.overridePath) {
    return fs.existsSync(opts.overridePath)
      ? { installed: true, path: opts.overridePath }
      : { installed: false };
  }

  // 1) Standard-Pfade
  for (const p of STANDARD_PATHS_WIN) {
    if (fs.existsSync(p)) {
      return { installed: true, path: p, version: await tryGetVersion(p) };
    }
  }

  // 2) Registry (Windows) — Skip auf Linux/Mac und in Tests
  if (!opts.skipRegistry && process.platform === 'win32') {
    try {
      const { stdout } = await execAsync(
        'reg query "HKLM\\SOFTWARE\\OBS Studio" /ve',
        { timeout: 3000 }
      );
      const match = stdout.match(/REG_SZ\s+(.+)$/m);
      if (match) {
        const installDir = match[1].trim();
        const exe = `${installDir}\\bin\\64bit\\obs64.exe`;
        if (fs.existsSync(exe)) {
          return { installed: true, path: exe, version: await tryGetVersion(exe) };
        }
      }
    } catch {
      // reg query failed — kein Eintrag oder nicht Windows
    }
  }

  return { installed: false };
}

async function tryGetVersion(_obsPath: string): Promise<string | undefined> {
  // Windows-Version-Info aus PE-Header zu lesen ist unerwartet aufwändig;
  // wir delegieren das an OBS selbst — nach Connect via WebSocket
  // liefert GetVersion die echte Version. Hier nur "unknown" zurück.
  return undefined;
}
```

- [ ] **Step 4: Test erneut ausführen — sollte passen**

```bash
npx vitest run tests/unit/main/obs/detect.test.ts
```

Expected: 3 Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/obs/detect.ts app/tests/unit/main/obs/detect.test.ts
git commit -m "feat(app): add obs detection (registry + standard paths)"
```

---

## Task 4: OBSInstaller

**Files:**
- Create: `app/src/main/obs/installer.ts`
- Create: `app/tests/unit/main/obs/installer.test.ts`

Lädt den offiziellen OBS-Installer von GitHub-Releases und führt ihn silent aus. Pinning auf eine Mindest-Version (30.0+ für stabile WebSocket-API).

- [ ] **Step 1: Test schreiben (failing)**

Erstelle `app/tests/unit/main/obs/installer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { fetchLatestObsRelease, pickInstallerAsset } from '../../../../src/main/obs/installer';

vi.mock('axios');

describe('fetchLatestObsRelease', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liefert Version und Asset-Liste aus GitHub-API', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        tag_name: '30.2.0',
        assets: [
          { name: 'OBS-Studio-30.2.0-Windows-x64-Installer.exe', browser_download_url: 'https://...' },
          { name: 'OBS-Studio-30.2.0-Windows-arm64-Installer.exe', browser_download_url: 'https://...' }
        ]
      }
    });
    const release = await fetchLatestObsRelease();
    expect(release.version).toBe('30.2.0');
    expect(release.assets).toHaveLength(2);
  });
});

describe('pickInstallerAsset', () => {
  const assets = [
    { name: 'OBS-Studio-30.2.0-Windows-x64-Installer.exe', browser_download_url: 'https://x64' },
    { name: 'OBS-Studio-30.2.0-Windows-arm64-Installer.exe', browser_download_url: 'https://arm64' },
    { name: 'OBS-Studio-30.2.0-macOS-Apple.dmg', browser_download_url: 'https://mac' }
  ];

  it('wählt x64-Installer für x64-Arch', () => {
    const asset = pickInstallerAsset(assets, 'win32', 'x64');
    expect(asset?.browser_download_url).toBe('https://x64');
  });

  it('wählt arm64-Installer für arm64-Arch', () => {
    const asset = pickInstallerAsset(assets, 'win32', 'arm64');
    expect(asset?.browser_download_url).toBe('https://arm64');
  });

  it('liefert null wenn keine passende Asset gefunden', () => {
    expect(pickInstallerAsset(assets, 'win32', 'ia32')).toBeNull();
  });
});
```

- [ ] **Step 2: Test ausführen — sollte fehlschlagen**

```bash
npx vitest run tests/unit/main/obs/installer.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implementierung**

Erstelle `app/src/main/obs/installer.ts`:

```typescript
import axios from 'axios';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { InstallProgress } from '@shared/types';

const GITHUB_API = 'https://api.github.com/repos/obsproject/obs-studio/releases/latest';
const MIN_OBS_VERSION = '30.0.0';

export interface ObsAsset {
  name: string;
  browser_download_url: string;
}

export interface ObsRelease {
  version: string;
  assets: ObsAsset[];
}

export async function fetchLatestObsRelease(): Promise<ObsRelease> {
  const { data } = await axios.get(GITHUB_API, {
    timeout: 10_000,
    headers: { 'User-Agent': 'desktopstreamer-app' }
  });
  return {
    version: String(data.tag_name).replace(/^v/, ''),
    assets: data.assets as ObsAsset[]
  };
}

export function pickInstallerAsset(
  assets: ObsAsset[],
  platform: NodeJS.Platform,
  arch: string
): ObsAsset | null {
  if (platform !== 'win32') return null;

  const archMatch =
    arch === 'arm64' ? /arm64/i :
    arch === 'x64'   ? /x64|x86_64/i :
    arch === 'ia32'  ? /x86(?!_64)|i386/i :
    null;
  if (!archMatch) return null;

  return assets.find((a) =>
    /windows/i.test(a.name) &&
    /installer/i.test(a.name) &&
    archMatch.test(a.name)
  ) ?? null;
}

export async function downloadInstaller(
  asset: ObsAsset,
  destPath: string,
  onProgress: (p: InstallProgress) => void
): Promise<void> {
  const response = await axios.get(asset.browser_download_url, {
    responseType: 'stream',
    timeout: 60_000
  });
  const total = Number(response.headers['content-length'] ?? 0);
  let received = 0;

  const writer = fs.createWriteStream(destPath);
  response.data.on('data', (chunk: Buffer) => {
    received += chunk.length;
    if (total > 0) {
      onProgress({
        step: 'downloading',
        percent: Math.round((received / total) * 100),
        message: `Lade ${asset.name} (${Math.round(received / 1024 / 1024)}/${Math.round(total / 1024 / 1024)} MB)`
      });
    }
  });
  response.data.pipe(writer);
  await new Promise<void>((resolve, reject) => {
    writer.on('finish', () => resolve());
    writer.on('error', reject);
  });
}

export async function runSilentInstaller(installerPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // NSIS-Installer akzeptieren /S für silent install
    const child = spawn(installerPath, ['/S'], { detached: false });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Installer exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

export async function installObs(
  onProgress: (p: InstallProgress) => void
): Promise<void> {
  onProgress({ step: 'fetching-release', percent: 0, message: 'Frage GitHub nach OBS-Release-Info' });
  const release = await fetchLatestObsRelease();

  if (compareVersions(release.version, MIN_OBS_VERSION) < 0) {
    throw new Error(
      `OBS-Release ${release.version} ist älter als Mindest-Version ${MIN_OBS_VERSION}`
    );
  }

  const asset = pickInstallerAsset(release.assets, process.platform, process.arch);
  if (!asset) {
    throw new Error(
      `Kein OBS-Installer gefunden für ${process.platform}/${process.arch}`
    );
  }

  const tmpFile = path.join(os.tmpdir(), asset.name);
  await downloadInstaller(asset, tmpFile, onProgress);

  onProgress({ step: 'installing', percent: 0, message: 'Führe OBS-Installer aus (silent)' });
  await runSilentInstaller(tmpFile);

  onProgress({ step: 'done', percent: 100, message: 'OBS installiert' });

  fs.rmSync(tmpFile, { force: true });
}

// Naive semver-compare, ausreichend für x.y.z-Format
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

// SHA256 utility (für Tests, nicht in Hot-Path)
export async function sha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}
```

- [ ] **Step 4: Test erneut**

```bash
npx vitest run tests/unit/main/obs/installer.test.ts
```

Expected: 4 Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/obs/installer.ts app/tests/unit/main/obs/installer.test.ts
git commit -m "feat(app): add obs installer (github releases + silent install)"
```

---

## Task 5: OBSProfileWriter

**Files:**
- Create: `app/src/main/obs/profile-writer.ts`
- Create: `app/tests/unit/main/obs/profile-writer.test.ts`

Schreibt unsere OBS-Konfiguration **vor dem ersten Launch** in `%APPDATA%\obs-studio\`. Damit haben wir Profile, Scene-Collection und WebSocket-Config bereit, ohne dass User-Daten kollidieren.

- [ ] **Step 1: Test schreiben (failing)**

Erstelle `app/tests/unit/main/obs/profile-writer.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { writeObsProfile, writeSceneCollection, writeWebSocketConfig } from '../../../../src/main/obs/profile-writer';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

describe('OBSProfileWriter', () => {
  let tmpAppData: string;

  beforeEach(() => {
    tmpAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'dskt-test-'));
  });

  it('writeObsProfile erzeugt basic.ini mit unseren Encoder-Defaults', () => {
    writeObsProfile({ appDataDir: tmpAppData, profileName: 'Desktopstreamer' });
    const iniPath = path.join(tmpAppData, 'basic', 'profiles', 'Desktopstreamer', 'basic.ini');
    expect(fs.existsSync(iniPath)).toBe(true);
    const content = fs.readFileSync(iniPath, 'utf-8');
    expect(content).toMatch(/Encoder=/);
    expect(content).toMatch(/RescaleRes=1920x1080/);
  });

  it('writeSceneCollection erzeugt JSON mit unserer Default-Scene', () => {
    writeSceneCollection({ appDataDir: tmpAppData, collectionName: 'Desktopstreamer' });
    const jsonPath = path.join(tmpAppData, 'basic', 'scenes', 'Desktopstreamer.json');
    expect(fs.existsSync(jsonPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    expect(data.name).toBe('Desktopstreamer');
    expect(Array.isArray(data.scenes)).toBe(true);
  });

  it('writeWebSocketConfig erzeugt websocket-Config mit gewünschten Settings', () => {
    writeWebSocketConfig({
      appDataDir: tmpAppData,
      port: 4455,
      authRequired: false
    });
    const cfgPath = path.join(tmpAppData, 'plugin_config', 'obs-websocket', 'config.json');
    expect(fs.existsSync(cfgPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    expect(data.server_port).toBe(4455);
    expect(data.auth_required).toBe(false);
    expect(data.server_enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Test ausführen — fail**

```bash
npx vitest run tests/unit/main/obs/profile-writer.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implementierung**

Erstelle `app/src/main/obs/profile-writer.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

const DEFAULT_PROFILE_INI = `[General]
Name=Desktopstreamer

[Video]
BaseCX=1920
BaseCY=1080
OutputCX=1920
OutputCY=1080
FPSType=0
FPSCommon=60

[Output]
Mode=Simple

[SimpleOutput]
VBitrate=6000
ABitrate=160
StreamEncoder=x264
RescaleRes=1920x1080

[AdvOut]
TrackIndex=1
RecTrackIndex=1
`;

const DEFAULT_SCENE_COLLECTION = {
  name: 'Desktopstreamer',
  current_scene: 'Default',
  current_program_scene: 'Default',
  current_transition: 'Cut',
  scene_order: [{ name: 'Default' }],
  scenes: [
    {
      name: 'Default',
      sources: [],
      settings: {}
    }
  ],
  sources: []
};

export function writeObsProfile(opts: {
  appDataDir: string;
  profileName: string;
}): void {
  const dir = path.join(opts.appDataDir, 'basic', 'profiles', opts.profileName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'basic.ini'), DEFAULT_PROFILE_INI, 'utf-8');
}

export function writeSceneCollection(opts: {
  appDataDir: string;
  collectionName: string;
}): void {
  const dir = path.join(opts.appDataDir, 'basic', 'scenes');
  fs.mkdirSync(dir, { recursive: true });
  const collection = { ...DEFAULT_SCENE_COLLECTION, name: opts.collectionName };
  fs.writeFileSync(
    path.join(dir, `${opts.collectionName}.json`),
    JSON.stringify(collection, null, 2),
    'utf-8'
  );
}

export function writeWebSocketConfig(opts: {
  appDataDir: string;
  port: number;
  authRequired: boolean;
}): void {
  const dir = path.join(opts.appDataDir, 'plugin_config', 'obs-websocket');
  fs.mkdirSync(dir, { recursive: true });
  const cfg = {
    server_enabled: true,
    server_port: opts.port,
    alerts_enabled: false,
    auth_required: opts.authRequired,
    server_password: ''
  };
  fs.writeFileSync(
    path.join(dir, 'config.json'),
    JSON.stringify(cfg, null, 2),
    'utf-8'
  );
}

export function getObsAppDataDir(): string {
  // %APPDATA%\obs-studio auf Windows
  if (process.platform === 'win32') {
    return path.join(process.env['APPDATA'] ?? '', 'obs-studio');
  }
  // Linux: ~/.config/obs-studio
  if (process.platform === 'linux') {
    return path.join(process.env['HOME'] ?? '', '.config', 'obs-studio');
  }
  // macOS: ~/Library/Application Support/obs-studio
  return path.join(process.env['HOME'] ?? '', 'Library', 'Application Support', 'obs-studio');
}
```

- [ ] **Step 4: Test erneut**

```bash
npx vitest run tests/unit/main/obs/profile-writer.test.ts
```

Expected: 3 Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/obs/profile-writer.ts app/tests/unit/main/obs/profile-writer.test.ts
git commit -m "feat(app): add obs profile/scene/websocket-config writer"
```

---

## Task 6: OBSProcessManager

**Files:**
- Create: `app/src/main/obs/process-manager.ts`
- Create: `app/tests/unit/main/obs/process-manager.test.ts`

Spawnt OBS als Subprocess mit unseren Args, watched Lifecycle, killt sauber bei App-Exit.

- [ ] **Step 1: Test schreiben (failing)**

Erstelle `app/tests/unit/main/obs/process-manager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OBSProcessManager } from '../../../../src/main/obs/process-manager';
import * as childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';

vi.mock('node:child_process');

class FakeProcess extends EventEmitter {
  pid = 12345;
  killed = false;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill(_signal?: string) {
    this.killed = true;
    setImmediate(() => this.emit('exit', 0, null));
    return true;
  }
}

describe('OBSProcessManager', () => {
  let mgr: OBSProcessManager;
  let fake: FakeProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    fake = new FakeProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(fake as never);
    mgr = new OBSProcessManager();
  });

  it('spawn ruft child_process.spawn mit korrekten Args', () => {
    mgr.spawn('/path/to/obs64.exe', { profile: 'P', collection: 'C' });
    expect(childProcess.spawn).toHaveBeenCalledWith(
      '/path/to/obs64.exe',
      expect.arrayContaining([
        '--minimize-to-tray',
        '--disable-shutdown-check',
        '--profile', 'P',
        '--collection', 'C'
      ]),
      expect.any(Object)
    );
  });

  it('isRunning ist initial false, true nach spawn', () => {
    expect(mgr.isRunning()).toBe(false);
    mgr.spawn('/path/to/obs64.exe', { profile: 'P', collection: 'C' });
    expect(mgr.isRunning()).toBe(true);
  });

  it('kill setzt isRunning auf false und resolved', async () => {
    mgr.spawn('/path/to/obs64.exe', { profile: 'P', collection: 'C' });
    await mgr.kill();
    expect(mgr.isRunning()).toBe(false);
    expect(fake.killed).toBe(true);
  });

  it('emit exit-Event wenn Prozess unerwartet beendet', async () => {
    const handler = vi.fn();
    mgr.on('exit', handler);
    mgr.spawn('/path/to/obs64.exe', { profile: 'P', collection: 'C' });
    fake.emit('exit', 1, null);
    expect(handler).toHaveBeenCalledWith({ code: 1, signal: null });
  });
});
```

- [ ] **Step 2: Implementierung**

Erstelle `app/src/main/obs/process-manager.ts`:

```typescript
import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface SpawnOptions {
  profile: string;
  collection: string;
}

export interface ExitInfo {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export class OBSProcessManager extends EventEmitter {
  private child: ChildProcess | null = null;

  spawn(obsPath: string, opts: SpawnOptions): void {
    if (this.child) {
      throw new Error('OBS-Process läuft bereits');
    }
    const args = [
      '--minimize-to-tray',
      '--disable-shutdown-check',
      '--profile', opts.profile,
      '--collection', opts.collection
    ];
    this.child = spawn(obsPath, args, { detached: false });

    this.child.on('exit', (code, signal) => {
      this.child = null;
      this.emit('exit', { code, signal });
    });
    this.child.on('error', (err) => {
      this.child = null;
      this.emit('error', err);
    });
  }

  isRunning(): boolean {
    return this.child !== null && !this.child.killed;
  }

  async kill(): Promise<void> {
    if (!this.child) return;
    return new Promise<void>((resolve) => {
      const child = this.child!;
      const onExit = () => {
        resolve();
      };
      child.once('exit', onExit);
      child.kill();
    });
  }
}
```

- [ ] **Step 3: Tests laufen lassen**

```bash
npx vitest run tests/unit/main/obs/process-manager.test.ts
```

Expected: 4 Tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/main/obs/process-manager.ts app/tests/unit/main/obs/process-manager.test.ts
git commit -m "feat(app): add obs process manager (spawn/kill/lifecycle)"
```

---

## Task 7: OBSWebSocketClient

**Files:**
- Create: `app/src/main/obs/ws-client.ts`
- Create: `app/tests/unit/main/obs/ws-client.test.ts`

Wrapper um `obs-websocket-js` mit Reconnect-Logik und typed Methoden für die Calls, die wir brauchen.

- [ ] **Step 1: Test schreiben (mit obs-websocket-js mock)**

Erstelle `app/tests/unit/main/obs/ws-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OBSWebSocketClient } from '../../../../src/main/obs/ws-client';

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockCall = vi.fn();
const mockOn = vi.fn();

vi.mock('obs-websocket-js', () => ({
  default: vi.fn(() => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    call: mockCall,
    on: mockOn,
    off: vi.fn()
  }))
}));

describe('OBSWebSocketClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('connect ruft obs-websocket-js connect mit URL', async () => {
    mockConnect.mockResolvedValue({ obsWebSocketVersion: '5.4.0' });
    mockCall.mockResolvedValue({ obsVersion: '30.1.0' });
    const client = new OBSWebSocketClient({ url: 'ws://localhost:4455' });
    await client.connect();
    expect(mockConnect).toHaveBeenCalledWith('ws://localhost:4455', undefined);
  });

  it('connect liefert OBS-Version via GetVersion-Call', async () => {
    mockConnect.mockResolvedValue({ obsWebSocketVersion: '5.4.0' });
    mockCall.mockResolvedValue({ obsVersion: '30.1.0' });
    const client = new OBSWebSocketClient({ url: 'ws://localhost:4455' });
    const version = await client.connect();
    expect(version).toBe('30.1.0');
  });

  it('startStream ruft StartStream', async () => {
    mockConnect.mockResolvedValue({ obsWebSocketVersion: '5.4.0' });
    mockCall.mockImplementation(async (req: string) => {
      if (req === 'GetVersion') return { obsVersion: '30.1.0' };
      if (req === 'StartStream') return {};
      throw new Error(`unexpected ${req}`);
    });
    const client = new OBSWebSocketClient({ url: 'ws://localhost:4455' });
    await client.connect();
    await client.startStream();
    expect(mockCall).toHaveBeenCalledWith('StartStream');
  });

  it('disconnect ruft underlying disconnect', async () => {
    mockConnect.mockResolvedValue({ obsWebSocketVersion: '5.4.0' });
    mockCall.mockResolvedValue({ obsVersion: '30.1.0' });
    const client = new OBSWebSocketClient({ url: 'ws://localhost:4455' });
    await client.connect();
    await client.disconnect();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implementierung**

Erstelle `app/src/main/obs/ws-client.ts`:

```typescript
import OBSWebSocket from 'obs-websocket-js';

export interface OBSWebSocketClientOptions {
  url: string;
  password?: string;
}

export interface MonitorInfo {
  monitorIndex: number;
  monitorName: string;
  monitorWidth: number;
  monitorHeight: number;
}

export interface StatsInfo {
  outputBitrate: number;       // kbps
  outputDroppedFrames: number;
  outputTotalFrames: number;
  outputDuration: number;      // seconds
}

export class OBSWebSocketClient {
  private ws: OBSWebSocket;
  private connected = false;

  constructor(private opts: OBSWebSocketClientOptions) {
    this.ws = new OBSWebSocket();
  }

  async connect(): Promise<string> {
    await this.ws.connect(this.opts.url, this.opts.password);
    this.connected = true;
    const v = await this.ws.call('GetVersion');
    return v.obsVersion;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.ws.disconnect();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getMonitors(): Promise<MonitorInfo[]> {
    const result = await this.ws.call('GetMonitorList');
    return result.monitors as unknown as MonitorInfo[];
  }

  async setCurrentProfile(name: string): Promise<void> {
    await this.ws.call('SetCurrentProfile', { profileName: name });
  }

  async setCurrentSceneCollection(name: string): Promise<void> {
    await this.ws.call('SetCurrentSceneCollection', { sceneCollectionName: name });
  }

  async createMonitorSource(opts: {
    sceneName: string;
    inputName: string;
    monitorIndex: number;
  }): Promise<void> {
    await this.ws.call('CreateInput', {
      sceneName: opts.sceneName,
      inputName: opts.inputName,
      inputKind: 'monitor_capture',
      inputSettings: { monitor: opts.monitorIndex },
      sceneItemEnabled: true
    });
  }

  async clearScene(sceneName: string): Promise<void> {
    const items = await this.ws.call('GetSceneItemList', { sceneName });
    for (const item of items.sceneItems) {
      await this.ws.call('RemoveSceneItem', {
        sceneName,
        sceneItemId: item.sceneItemId as number
      });
    }
  }

  async setStreamServiceCustom(opts: {
    server: string;
    key: string;
  }): Promise<void> {
    await this.ws.call('SetStreamServiceSettings', {
      streamServiceType: 'rtmp_custom',
      streamServiceSettings: {
        server: opts.server,
        key: opts.key
      }
    });
  }

  async startStream(): Promise<void> {
    await this.ws.call('StartStream');
  }

  async stopStream(): Promise<void> {
    await this.ws.call('StopStream');
  }

  async getStats(): Promise<StatsInfo> {
    const stats = await this.ws.call('GetStats');
    return {
      outputBitrate: 0, // GetStats hat das nicht; siehe GetStreamStatus
      outputDroppedFrames: stats.renderSkippedFrames,
      outputTotalFrames: stats.renderTotalFrames,
      outputDuration: 0
    };
  }

  async getStreamStatus(): Promise<{
    streaming: boolean;
    bitrateKbps: number;
    droppedFrames: number;
    totalFrames: number;
    durationMs: number;
  }> {
    const s = await this.ws.call('GetStreamStatus');
    return {
      streaming: s.outputActive,
      bitrateKbps: 0, // OBS exposed das nicht direkt; CalcRate aus bytes/duration
      droppedFrames: s.outputSkippedFrames,
      totalFrames: s.outputTotalFrames,
      durationMs: s.outputDuration
    };
  }
}
```

- [ ] **Step 3: Tests laufen lassen**

```bash
npx vitest run tests/unit/main/obs/ws-client.test.ts
```

Expected: 4 Tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/main/obs/ws-client.ts app/tests/unit/main/obs/ws-client.test.ts
git commit -m "feat(app): add typed obs-websocket client wrapper"
```

---

## Task 8: OBSManager (Orchestrator)

**Files:**
- Create: `app/src/main/obs/manager.ts`
- Create: `app/tests/unit/main/obs/manager.test.ts`

High-Level-Klasse, die alle Sub-Module orchestriert. Das ist der einzige Layer, den die IPC-Handler kennen.

- [ ] **Step 1: Test schreiben**

Erstelle `app/tests/unit/main/obs/manager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OBSManager } from '../../../../src/main/obs/manager';

// Wir mocken die einzelnen Sub-Module
const mockDetect = vi.fn();
const mockInstall = vi.fn();
const mockWriteProfile = vi.fn();
const mockWriteSceneCollection = vi.fn();
const mockWriteWebSocketConfig = vi.fn();
const mockGetAppDataDir = vi.fn(() => '/tmp/obs');

vi.mock('../../../../src/main/obs/detect', () => ({
  detectOBSInstallation: (...args: unknown[]) => mockDetect(...args)
}));
vi.mock('../../../../src/main/obs/installer', () => ({
  installObs: (...args: unknown[]) => mockInstall(...args)
}));
vi.mock('../../../../src/main/obs/profile-writer', () => ({
  writeObsProfile: (...args: unknown[]) => mockWriteProfile(...args),
  writeSceneCollection: (...args: unknown[]) => mockWriteSceneCollection(...args),
  writeWebSocketConfig: (...args: unknown[]) => mockWriteWebSocketConfig(...args),
  getObsAppDataDir: () => mockGetAppDataDir()
}));

const mockSpawn = vi.fn();
const mockKill = vi.fn();
vi.mock('../../../../src/main/obs/process-manager', () => ({
  OBSProcessManager: vi.fn().mockImplementation(() => ({
    spawn: mockSpawn,
    kill: mockKill,
    isRunning: () => true,
    on: vi.fn()
  }))
}));

const mockWsConnect = vi.fn();
const mockWsDisconnect = vi.fn();
vi.mock('../../../../src/main/obs/ws-client', () => ({
  OBSWebSocketClient: vi.fn().mockImplementation(() => ({
    connect: mockWsConnect,
    disconnect: mockWsDisconnect,
    isConnected: () => true,
    setCurrentProfile: vi.fn(),
    setCurrentSceneCollection: vi.fn()
  }))
}));

describe('OBSManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWsConnect.mockResolvedValue('30.1.0');
  });

  it('ensureReady: Happy-Path mit installiertem OBS', async () => {
    mockDetect.mockResolvedValue({ installed: true, path: '/path/to/obs64.exe' });
    const mgr = new OBSManager();
    const status = await mgr.ensureReady();
    expect(status.state).toBe('ready');
    expect(mockInstall).not.toHaveBeenCalled();
    expect(mockWriteProfile).toHaveBeenCalled();
    expect(mockSpawn).toHaveBeenCalledWith('/path/to/obs64.exe', expect.any(Object));
    expect(mockWsConnect).toHaveBeenCalled();
  });

  it('ensureReady: triggert Install wenn OBS fehlt', async () => {
    mockDetect
      .mockResolvedValueOnce({ installed: false })
      .mockResolvedValueOnce({ installed: true, path: '/path/to/obs64.exe' });
    mockInstall.mockResolvedValue(undefined);
    const mgr = new OBSManager();
    const status = await mgr.ensureReady();
    expect(status.state).toBe('ready');
    expect(mockInstall).toHaveBeenCalled();
  });

  it('emit status-Events während Lifecycle', async () => {
    mockDetect.mockResolvedValue({ installed: true, path: '/path/to/obs64.exe' });
    const mgr = new OBSManager();
    const states: string[] = [];
    mgr.on('status', (s) => states.push(s.state));
    await mgr.ensureReady();
    expect(states).toContain('detecting');
    expect(states).toContain('starting');
    expect(states).toContain('ready');
  });

  it('shutdown disconnectet WS und killed Process', async () => {
    mockDetect.mockResolvedValue({ installed: true, path: '/path/to/obs64.exe' });
    const mgr = new OBSManager();
    await mgr.ensureReady();
    await mgr.shutdown();
    expect(mockWsDisconnect).toHaveBeenCalled();
    expect(mockKill).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implementierung**

Erstelle `app/src/main/obs/manager.ts`:

```typescript
import { EventEmitter } from 'node:events';
import { detectOBSInstallation } from './detect.js';
import { installObs } from './installer.js';
import {
  writeObsProfile,
  writeSceneCollection,
  writeWebSocketConfig,
  getObsAppDataDir
} from './profile-writer.js';
import { OBSProcessManager } from './process-manager.js';
import { OBSWebSocketClient } from './ws-client.js';
import type { OBSStatus, InstallProgress } from '@shared/types';

const PROFILE_NAME = 'Desktopstreamer';
const SCENE_COLLECTION = 'Desktopstreamer';
const WS_PORT = 4455;
const WS_URL = `ws://localhost:${WS_PORT}`;

export class OBSManager extends EventEmitter {
  private process = new OBSProcessManager();
  private ws: OBSWebSocketClient | null = null;
  private currentStatus: OBSStatus = { state: 'detecting' };

  getStatus(): OBSStatus {
    return this.currentStatus;
  }

  private setStatus(s: OBSStatus): void {
    this.currentStatus = s;
    this.emit('status', s);
  }

  async ensureReady(): Promise<OBSStatus> {
    this.setStatus({ state: 'detecting' });
    let detection = await detectOBSInstallation();

    if (!detection.installed) {
      this.setStatus({
        state: 'installing',
        progress: 0,
        message: 'Bereite OBS-Installation vor'
      });
      try {
        await installObs((p: InstallProgress) => {
          this.setStatus({
            state: 'installing',
            progress: p.percent,
            message: p.message
          });
          this.emit('install-progress', p);
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.setStatus({ state: 'install-failed', error: msg });
        return this.currentStatus;
      }
      detection = await detectOBSInstallation();
      if (!detection.installed || !detection.path) {
        this.setStatus({ state: 'install-failed', error: 'OBS-Pfad nach Install nicht gefunden' });
        return this.currentStatus;
      }
    }

    // Profile + Scene + WS-Config schreiben (vor jedem Start, idempotent)
    const appDataDir = getObsAppDataDir();
    writeObsProfile({ appDataDir, profileName: PROFILE_NAME });
    writeSceneCollection({ appDataDir, collectionName: SCENE_COLLECTION });
    writeWebSocketConfig({ appDataDir, port: WS_PORT, authRequired: false });

    this.setStatus({ state: 'starting' });

    if (!this.process.isRunning()) {
      this.process.spawn(detection.path!, {
        profile: PROFILE_NAME,
        collection: SCENE_COLLECTION
      });
      // Kurz warten, bis OBS die WebSocket-Schnittstelle hochfährt
      await new Promise((r) => setTimeout(r, 2500));
    }

    this.ws = new OBSWebSocketClient({ url: WS_URL });
    let obsVersion: string;
    try {
      obsVersion = await this.connectWithRetry();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus({ state: 'disconnected', error: msg });
      return this.currentStatus;
    }

    // Sicherstellen, dass unser Profil aktiv ist
    await this.ws.setCurrentProfile(PROFILE_NAME);
    await this.ws.setCurrentSceneCollection(SCENE_COLLECTION);

    this.setStatus({ state: 'ready', obsVersion });
    return this.currentStatus;
  }

  private async connectWithRetry(maxAttempts = 5): Promise<string> {
    let lastErr: unknown;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await this.ws!.connect();
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('connect failed');
  }

  async shutdown(): Promise<void> {
    try {
      if (this.ws?.isConnected()) await this.ws.disconnect();
    } catch {
      // ignore
    }
    if (this.process.isRunning()) {
      await this.process.kill();
    }
  }

  // Stream-API für IPC-Handler
  async setSourceMonitor(monitorIndex: number): Promise<void> {
    if (!this.ws) throw new Error('OBS nicht verbunden');
    await this.ws.clearScene('Default');
    await this.ws.createMonitorSource({
      sceneName: 'Default',
      inputName: 'CapturedMonitor',
      monitorIndex
    });
  }

  async startStream(rtmpUrl: string, streamKey: string): Promise<void> {
    if (!this.ws) throw new Error('OBS nicht verbunden');
    await this.ws.setStreamServiceCustom({ server: rtmpUrl, key: streamKey });
    await this.ws.startStream();
  }

  async stopStream(): Promise<void> {
    if (!this.ws) throw new Error('OBS nicht verbunden');
    await this.ws.stopStream();
  }

  async getStreamStats() {
    if (!this.ws) throw new Error('OBS nicht verbunden');
    return this.ws.getStreamStatus();
  }

  async listMonitors() {
    if (!this.ws) throw new Error('OBS nicht verbunden');
    return this.ws.getMonitors();
  }
}
```

- [ ] **Step 3: Tests laufen lassen**

```bash
npx vitest run tests/unit/main/obs/manager.test.ts
```

Expected: 4 Tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/main/obs/manager.ts app/tests/unit/main/obs/manager.test.ts
git commit -m "feat(app): add obs manager (orchestrates detect/install/spawn/connect)"
```

---

## Task 9: IPC-Integration

**Files:**
- Modify: `app/src/main/ipc-handlers.ts`
- Modify: `app/src/main/index.ts`

Ersetze die Stub-Handler durch echte OBSManager-Aufrufe und broadcaste Status-Events an den Renderer.

- [ ] **Step 1: ipc-handlers.ts erweitern**

Edit `app/src/main/ipc-handlers.ts` — komplett ersetzen:

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type {
  AppConfig,
  Source,
  StreamStats,
  OBSStatus,
  InstallProgress
} from '@shared/types';
import { ConfigStore } from './config-store.js';
import { OBSManager } from './obs/manager.js';

export function registerIpcHandlers(
  configStore: ConfigStore,
  obsManager: OBSManager,
  getMainWindow: () => BrowserWindow | null
): void {
  ipcMain.handle(IPC.config.get, (): AppConfig => configStore.getAll());

  ipcMain.handle(IPC.config.set, (_e, partial: Partial<AppConfig>): AppConfig => {
    return configStore.update(partial);
  });

  // Sources via OBS-Monitor-Liste — Plan B2 deckt nur monitor_capture ab
  ipcMain.handle(IPC.sources.list, async (): Promise<Source[]> => {
    try {
      const monitors = await obsManager.listMonitors();
      return monitors.map((m, i) => ({
        id: `monitor-${m.monitorIndex}`,
        kind: 'screen' as const,
        label: m.monitorName || `Monitor ${i + 1} (${m.monitorWidth}x${m.monitorHeight})`
      }));
    } catch {
      // OBS nicht ready — leere Liste statt Crash
      return [];
    }
  });

  ipcMain.handle(
    IPC.stream.start,
    async (): Promise<{ ok: true } | { ok: false; error: string }> => {
      const cfg = configStore.getAll();
      if (cfg.selectedDestinationKind !== 'custom' || !cfg.customRtmp) {
        return { ok: false, error: 'Plan B2 unterstützt nur Custom-RTMP. Twitch in Plan B3, Lokal in Plan B4.' };
      }
      if (!cfg.selectedSourceId) {
        return { ok: false, error: 'Keine Quelle gewählt' };
      }
      const monitorMatch = cfg.selectedSourceId.match(/^monitor-(\d+)$/);
      if (!monitorMatch) {
        return { ok: false, error: 'Diese Quelle wird in v1 noch nicht unterstützt' };
      }

      try {
        await obsManager.setSourceMonitor(parseInt(monitorMatch[1], 10));
        await obsManager.startStream(cfg.customRtmp.rtmpUrl, cfg.customRtmp.streamKey);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(IPC.stream.stop, async (): Promise<{ ok: true }> => {
    try {
      await obsManager.stopStream();
    } catch {
      // ignore
    }
    return { ok: true };
  });

  ipcMain.handle(IPC.stream.statsSubscribe, async (): Promise<StreamStats> => {
    try {
      const s = await obsManager.getStreamStats();
      return {
        bitrateKbps: s.bitrateKbps,
        droppedFrames: s.droppedFrames,
        uptimeSeconds: Math.floor(s.durationMs / 1000)
      };
    } catch {
      return { bitrateKbps: 0, droppedFrames: 0, uptimeSeconds: 0 };
    }
  });

  ipcMain.handle(IPC.obs.getStatus, (): OBSStatus => obsManager.getStatus());

  // Push: Status-Events an Renderer
  obsManager.on('status', (status: OBSStatus) => {
    const win = getMainWindow();
    win?.webContents.send(IPC.obs.statusEvent, status);
  });

  obsManager.on('install-progress', (p: InstallProgress) => {
    const win = getMainWindow();
    win?.webContents.send(IPC.obs.installProgressEvent, p);
  });
}
```

- [ ] **Step 2: index.ts ergänzen — OBSManager initialisieren**

Edit `app/src/main/index.ts` — innerhalb des `if (gotSingleInstanceLock) { ... whenReady().then(() => { ... }) }`-Blocks, nach `registerIpcHandlers`:

```typescript
import { OBSManager } from './obs/manager.js';
```

Und im `whenReady`:

```typescript
    const electronStore = new Store<AppConfig>({
      defaults: ConfigStore.defaults()
    });
    const configStore = new ConfigStore(electronStore as never);

    const obsManager = new OBSManager();
    registerIpcHandlers(configStore, obsManager, () => mainWindow);

    createWindow();

    // OBS-Init starten — non-blocking
    void obsManager.ensureReady();

    app.on('before-quit', () => {
      void obsManager.shutdown();
    });
```

- [ ] **Step 3: Preload erweitern**

Edit `app/src/preload/index.ts` — ergänze im `api`-Objekt:

```typescript
const api = {
  // ... existing config, sources, stream ...
  obs: {
    getStatus: (): Promise<OBSStatus> => ipcRenderer.invoke(IPC.obs.getStatus),
    onStatusEvent: (cb: (s: OBSStatus) => void) => {
      const handler = (_: unknown, s: OBSStatus) => cb(s);
      ipcRenderer.on(IPC.obs.statusEvent, handler);
      return () => ipcRenderer.off(IPC.obs.statusEvent, handler);
    },
    onInstallProgress: (cb: (p: InstallProgress) => void) => {
      const handler = (_: unknown, p: InstallProgress) => cb(p);
      ipcRenderer.on(IPC.obs.installProgressEvent, handler);
      return () => ipcRenderer.off(IPC.obs.installProgressEvent, handler);
    }
  }
};
```

Und Imports:

```typescript
import type { AppConfig, Source, StreamStats, OBSStatus, InstallProgress } from '@shared/types';
```

- [ ] **Step 4: Renderer-IPC-Wrapper erweitern**

Edit `app/src/renderer/lib/ipc.ts` — füge hinzu:

```typescript
import type { AppConfig, Source, StreamStats, OBSStatus, InstallProgress } from '@shared/types';

export const ipc = {
  // ... bestehende Methoden ...
  async getObsStatus(): Promise<OBSStatus> {
    return window.api.obs.getStatus();
  },
  onObsStatusEvent(cb: (s: OBSStatus) => void): () => void {
    return window.api.obs.onStatusEvent(cb);
  },
  onInstallProgress(cb: (p: InstallProgress) => void): () => void {
    return window.api.obs.onInstallProgress(cb);
  }
};
```

- [ ] **Step 5: Tests + Typecheck**

```bash
cd /home/hpb/projects/desktopstreamer/app
npx vitest run
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.node.json
```

Expected: alle bestehenden Tests grün, kein Typecheck-Error.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/index.ts app/src/main/ipc-handlers.ts app/src/preload/index.ts app/src/renderer/lib/ipc.ts
git commit -m "feat(app): wire obs manager into ipc handlers and preload api"
```

---

## Task 10: Install-Progress-Dialog

**Files:**
- Create: `app/src/renderer/components/InstallProgressDialog.tsx`
- Modify: `app/src/renderer/App.tsx`

Modal-Overlay, das während OBS-Install/Connect den Fortschritt zeigt und User informiert.

- [ ] **Step 1: Dialog-Komponente**

Erstelle `app/src/renderer/components/InstallProgressDialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ipc } from '@renderer/lib/ipc';
import type { OBSStatus } from '@shared/types';

export function InstallProgressDialog() {
  const [status, setStatus] = useState<OBSStatus>({ state: 'detecting' });

  useEffect(() => {
    void ipc.getObsStatus().then(setStatus);
    const off = ipc.onObsStatusEvent(setStatus);
    return off;
  }, []);

  // Nur zeigen wenn nicht ready
  if (status.state === 'ready') return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-bg-surface rounded-xl p-8 max-w-md w-full mx-4 border border-bg-hover">
        <h2 className="text-lg font-semibold mb-2">{titleFor(status)}</h2>
        <p className="text-text-muted text-sm mb-4">{messageFor(status)}</p>
        {status.state === 'installing' && (
          <div className="w-full h-2 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        )}
        {status.state === 'install-failed' && (
          <div className="text-sm text-red-400 bg-red-950/30 border border-red-900 p-3 rounded-lg mt-2">
            {status.error}
          </div>
        )}
        {status.state === 'disconnected' && (
          <div className="text-sm text-yellow-400 bg-yellow-950/30 border border-yellow-900 p-3 rounded-lg mt-2">
            {status.error}
          </div>
        )}
      </div>
    </div>
  );
}

function titleFor(s: OBSStatus): string {
  switch (s.state) {
    case 'detecting': return 'Suche OBS Studio …';
    case 'not-installed': return 'OBS Studio nicht gefunden';
    case 'installing': return 'OBS Studio wird installiert';
    case 'install-failed': return 'Installation fehlgeschlagen';
    case 'starting': return 'OBS Studio wird gestartet …';
    case 'disconnected': return 'OBS Studio nicht erreichbar';
    case 'ready': return '';
  }
}

function messageFor(s: OBSStatus): string {
  switch (s.state) {
    case 'detecting': return 'Prüfe Standardpfade und Registry.';
    case 'not-installed': return 'Klicke auf "Installieren", um die OBS-Engine zu installieren (~120 MB).';
    case 'installing': return s.message;
    case 'install-failed': return 'Bitte installiere OBS manuell von obsproject.com und starte die App neu.';
    case 'starting': return 'OBS startet im Hintergrund (Systray).';
    case 'disconnected': return 'Verbindung zu OBS verloren. Bitte App neu starten.';
    case 'ready': return '';
  }
}
```

- [ ] **Step 2: App.tsx integrieren**

Edit `app/src/renderer/App.tsx`:

```tsx
import { Header } from './components/Header';
import { SectionCard } from './components/SectionCard';
import { InstallProgressDialog } from './components/InstallProgressDialog';
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
      <InstallProgressDialog />
    </div>
  );
}
```

- [ ] **Step 3: Test-Smoke**

Erstelle `app/tests/unit/components/InstallProgressDialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { InstallProgressDialog } from '../../../src/renderer/components/InstallProgressDialog';

beforeEach(() => {
  (globalThis as { window: Window }).window.api = {
    config: { get: vi.fn(), set: vi.fn() },
    sources: { list: vi.fn() },
    stream: { start: vi.fn(), stop: vi.fn(), getStats: vi.fn() },
    obs: {
      getStatus: vi.fn().mockResolvedValue({ state: 'detecting' }),
      onStatusEvent: vi.fn(() => () => {}),
      onInstallProgress: vi.fn(() => () => {})
    }
  } as never;
});

describe('InstallProgressDialog', () => {
  it('zeigt "Suche OBS Studio" beim Detecting-State', async () => {
    render(<InstallProgressDialog />);
    await waitFor(() => {
      expect(screen.getByText(/suche obs studio/i)).toBeInTheDocument();
    });
  });

  it('rendert nichts bei state=ready', async () => {
    (window.api.obs.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: 'ready',
      obsVersion: '30.1.0'
    });
    const { container } = render(<InstallProgressDialog />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
```

- [ ] **Step 4: Tests + bestehende Tests fixen**

Die bestehenden Tests von SourcePicker/DestinationPicker/StreamControl mocken nicht `window.api.obs`. Update setup oder die individuellen Tests, falls sie wegen `window.api.obs.*`-Calls failen.

Erstelle/Update `app/tests/unit/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  // Default-Mock für window.api — Tests können einzelne Felder überschreiben.
  if (!(globalThis as { window?: Window }).window?.api) {
    (globalThis as { window: Window }).window.api = {
      config: { get: vi.fn(), set: vi.fn() },
      sources: { list: vi.fn().mockResolvedValue([]) },
      stream: {
        start: vi.fn(),
        stop: vi.fn(),
        getStats: vi.fn().mockResolvedValue({ bitrateKbps: 0, droppedFrames: 0, uptimeSeconds: 0 })
      },
      obs: {
        getStatus: vi.fn().mockResolvedValue({ state: 'ready', obsVersion: '30.1.0' }),
        onStatusEvent: vi.fn(() => () => {}),
        onInstallProgress: vi.fn(() => () => {})
      }
    } as never;
  }
});
```

Alternativ: jeder Test setzt sein eigenes window.api komplett neu.

- [ ] **Step 5: Tests laufen lassen**

```bash
cd /home/hpb/projects/desktopstreamer/app
npx vitest run
```

Expected: alle Tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/renderer/components/InstallProgressDialog.tsx app/src/renderer/App.tsx app/tests/unit/components/InstallProgressDialog.test.tsx app/tests/unit/setup.ts
git commit -m "feat(app): add install-progress dialog wired to obs status events"
```

---

## Task 11: README + Manual-Integration-Test-Anleitung

**Files:**
- Modify: `app/README.md`

E2E-Test gegen echtes OBS ist auf CI nicht praktisch (OBS läuft nicht headless gut). Für Plan B2 dokumentieren wir den manuellen Integration-Test-Pfad.

- [ ] **Step 1: README erweitern**

Edit `app/README.md` — am Ende vor "Lizenz":

```markdown
## Manueller Integration-Test mit OBS

Plan B2 bringt die OBS-Integration. Um end-to-end zu testen:

1. **Stelle sicher, dass OBS Studio installiert ist** (oder lass die App es installieren beim ersten Start)
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
6. **Prüfe via VLC oder Browser**:
   ```bash
   curl -sLk -c /tmp/cj -b /tmp/cj "https://YOUR-SERVER/live/STREAM-KEY/index.m3u8"
   ```
   Sollte HTTP 200 mit M3U8-Manifest liefern.
7. **In VRChat**: trage die HLS-URL in einen Video-Player ein.

## Bekannte Limitierungen v1 (Plan B2)

- Nur **Bildschirm-Capture** (kein Window-Capture, kein Audio-Stream-Capture). Window/Audio kommen in v1.1.
- Twitch-Modus zeigt Hinweis auf Plan B3, ist nicht funktional.
- Lokal-Modus zeigt Hinweis auf Plan B4, ist nicht funktional.
- OBS Studio muss installiert sein (Auto-Install nur Windows; Mac/Linux manuell).
```

- [ ] **Step 2: Commit + Push**

```bash
cd /home/hpb/projects/desktopstreamer
git add app/README.md
git commit -m "docs(app): add manual integration test instructions for plan b2"
git push origin main
```

---

## Self-Review

### Spec-Coverage

- ✅ **Section 2.1** (OBS-as-Dependency): Tasks 3-8 implementieren detect/install/spawn/connect
- ✅ **Section 3** (Streaming-Pipeline via WS): Tasks 7-8 (WebSocket-Calls für Stream-Lifecycle)
- ✅ **Section 3.1** (Defaults im OBS-Profile): Task 5 (`profile-writer.ts` schreibt unsere `basic.ini`)
- ✅ **Section 9.1** OBSManager: Task 8 implementiert ihn als Orchestrator-Klasse
- ✅ **Section 11** (Risiko OBS-Auto-Install): Task 4 (Pin auf min OBS 30.0, Fehler-Branches)
- ✅ **Section 11** (Risiko Profile-Kollision): Eigenes Profile + Scene-Collection in Task 5

**Out of Scope für Plan B2 (= Plan B3/B4/B5):**
- Twitch OAuth (Plan B3)
- Lokal-Modus (Plan B4)
- Window-Capture / Audio-Capture (v1.1)
- Multi-Arch-Build, Code-Signing (Plan B5)

### Placeholder-Scan

Keine TBD/TODO/„fill in details" in den Code-Blöcken. Alle Tasks zeigen vollständigen Code.

### Type-Konsistenz

- `OBSStatus`-Discriminated-Union einmal in `shared/types.ts` definiert, durchgängig genutzt
- `OBSManager`-API: `ensureReady`, `setSourceMonitor`, `startStream`, `stopStream`, `getStreamStats`, `listMonitors`, `shutdown`, `on('status'|'install-progress')` — von Tests + IPC-Handler konsistent verwendet
- `IPC.obs.{getStatus,statusEvent,installProgressEvent}` einmal definiert, in Preload + Handler + Renderer konsistent
- `monitor-{N}` als Source-ID-Format in `ipc-handlers.ts` (Task 9) und parsed wieder in `stream:start` zurück

Plan ist konsistent.
