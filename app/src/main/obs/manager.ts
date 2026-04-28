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
const DEFAULT_STARTUP_DELAY_MS = 2500;
const DEFAULT_CONNECT_RETRY_DELAY_MS = 1000;

export interface OBSManagerOptions {
  startupDelayMs?: number;
  connectRetryDelayMs?: number;
}

export class OBSManager extends EventEmitter {
  private process = new OBSProcessManager();
  private ws: OBSWebSocketClient | null = null;
  private currentStatus: OBSStatus = { state: 'detecting' };
  private startupDelayMs: number;
  private connectRetryDelayMs: number;

  constructor(opts: OBSManagerOptions = {}) {
    super();
    this.startupDelayMs = opts.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS;
    this.connectRetryDelayMs = opts.connectRetryDelayMs ?? DEFAULT_CONNECT_RETRY_DELAY_MS;
  }

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
        this.setStatus({
          state: 'install-failed',
          error: 'OBS-Pfad nach Install nicht gefunden'
        });
        return this.currentStatus;
      }
    }

    // Profile + Scene + WS-Config schreiben (idempotent, vor jedem Start)
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
      // OBS braucht Zeit, bis das WebSocket-Listening hochkommt
      await new Promise((r) => setTimeout(r, this.startupDelayMs));
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
        await new Promise((r) => setTimeout(r, this.connectRetryDelayMs));
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
