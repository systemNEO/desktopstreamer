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

  it('respektiert overridePath (z. B. für Tests / Custom-Installs)', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => p === '/custom/obs');
    const result = await detectOBSInstallation({
      skipRegistry: true,
      overridePath: '/custom/obs'
    });
    expect(result.installed).toBe(true);
    expect(result.path).toBe('/custom/obs');
  });
});
