import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeObsProfile, writeSceneCollection, writeWebSocketConfig } from '../../../../src/main/obs/profile-writer';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

describe('OBSProfileWriter', () => {
  let tmpAppData: string;

  beforeEach(() => {
    tmpAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'dskt-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpAppData, { recursive: true, force: true });
  });

  it('writeObsProfile erzeugt basic.ini mit unseren Encoder-Defaults', () => {
    writeObsProfile({ appDataDir: tmpAppData, profileName: 'Desktopstreamer' });
    const iniPath = path.join(tmpAppData, 'basic', 'profiles', 'Desktopstreamer', 'basic.ini');
    expect(fs.existsSync(iniPath)).toBe(true);
    const content = fs.readFileSync(iniPath, 'utf-8');
    expect(content).toMatch(/RescaleRes=1920x1080/);
    expect(content).toMatch(/VBitrate=6000/);
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
    // first_load: false unterdrückt den OBS-First-Launch-Wizard (sonst
    // überschreibt der die anderen Settings).
    expect(data.first_load).toBe(false);
  });

  it('writeObsProfile ist idempotent (zweiter Aufruf überschreibt)', () => {
    writeObsProfile({ appDataDir: tmpAppData, profileName: 'Desktopstreamer' });
    writeObsProfile({ appDataDir: tmpAppData, profileName: 'Desktopstreamer' });
    const iniPath = path.join(tmpAppData, 'basic', 'profiles', 'Desktopstreamer', 'basic.ini');
    expect(fs.existsSync(iniPath)).toBe(true);
  });
});
