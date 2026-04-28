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
    // first_load: false unterdrückt den OBS-First-Launch-Wizard, der sonst
    // die anderen Settings überschreibt. Reviewer-Catch.
    first_load: false,
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
  if (process.platform === 'win32') {
    return path.join(process.env['APPDATA'] ?? '', 'obs-studio');
  }
  if (process.platform === 'linux') {
    return path.join(process.env['HOME'] ?? '', '.config', 'obs-studio');
  }
  return path.join(
    process.env['HOME'] ?? '',
    'Library',
    'Application Support',
    'obs-studio'
  );
}
