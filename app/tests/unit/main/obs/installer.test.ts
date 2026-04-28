import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { fetchLatestObsRelease, pickInstallerAsset, compareVersions } from '../../../../src/main/obs/installer';

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

  it('strip "v"-Prefix von tag_name', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { tag_name: 'v31.0.0', assets: [] }
    });
    const release = await fetchLatestObsRelease();
    expect(release.version).toBe('31.0.0');
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

  it('liefert null bei nicht-Windows-Platforms', () => {
    expect(pickInstallerAsset(assets, 'darwin', 'x64')).toBeNull();
    expect(pickInstallerAsset(assets, 'linux', 'x64')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('vergleicht major.minor.patch korrekt', () => {
    expect(compareVersions('30.0.0', '30.0.0')).toBe(0);
    expect(compareVersions('30.0.0', '30.0.1')).toBeLessThan(0);
    expect(compareVersions('30.1.0', '30.0.5')).toBeGreaterThan(0);
    expect(compareVersions('31.0.0', '30.99.99')).toBeGreaterThan(0);
  });

  it('strippt Pre-Release-Suffixe', () => {
    expect(compareVersions('30.0.0-rc1', '30.0.0')).toBe(0);
    expect(compareVersions('30.0.0-rc1', '30.0.1')).toBeLessThan(0);
    expect(compareVersions('30.1.0-beta', '30.0.0')).toBeGreaterThan(0);
  });

  it('handhabt fehlende Komponenten als 0', () => {
    expect(compareVersions('30', '30.0.0')).toBe(0);
    expect(compareVersions('30.1', '30.0.5')).toBeGreaterThan(0);
  });
});
