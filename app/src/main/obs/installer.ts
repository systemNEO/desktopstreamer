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

export async function sha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}
