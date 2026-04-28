import axios from 'axios';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import type { InstallProgress } from '@shared/types';

const SILENT_INSTALL_TIMEOUT_MS = 10 * 60 * 1000; // 10 Minuten

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
    const child = spawn(installerPath, ['/S'], { detached: false });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Installer hat nach ${SILENT_INSTALL_TIMEOUT_MS / 1000}s nicht beendet`));
    }, SILENT_INSTALL_TIMEOUT_MS);
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Installer exited with code ${code}`));
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
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
  try {
    await downloadInstaller(asset, tmpFile, onProgress);

    onProgress({ step: 'installing', percent: 0, message: 'Führe OBS-Installer aus (silent)' });
    await runSilentInstaller(tmpFile);

    onProgress({ step: 'done', percent: 100, message: 'OBS installiert' });
  } finally {
    // Auch bei Fehler den temporären Installer wegräumen.
    try { fs.rmSync(tmpFile, { force: true }); } catch { /* ignore */ }
  }
}

/**
 * Vergleicht zwei semver-ähnliche Versions-Strings (nur Major.Minor.Patch).
 * Pre-Release-Suffixes wie "-rc1" werden gestrippt: "30.0.0-rc1" zählt als 30.0.0.
 * Returns negative if a<b, 0 if equal, positive if a>b.
 */
export function compareVersions(a: string, b: string): number {
  const strip = (v: string): number[] =>
    v.replace(/[-+].*$/, '').split('.').map((p) => parseInt(p, 10) || 0);
  const pa = strip(a);
  const pb = strip(b);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

