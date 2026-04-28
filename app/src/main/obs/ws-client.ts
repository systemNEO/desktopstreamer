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

export interface StreamStatus {
  streaming: boolean;
  bitrateKbps: number;
  droppedFrames: number;
  totalFrames: number;
  durationMs: number;
}

interface BitrateSample {
  bytes: number;
  durationMs: number;
}

export class OBSWebSocketClient {
  private ws: OBSWebSocket;
  private connected = false;
  // Vorheriges Sample für Bitrate-Delta-Berechnung
  private lastBitrateSample: BitrateSample | null = null;

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

  async getStreamStatus(): Promise<StreamStatus> {
    const s = await this.ws.call('GetStreamStatus');
    const bytes = (s as unknown as { outputBytes?: number }).outputBytes ?? 0;
    const durationMs = s.outputDuration;

    // Bitrate aus Delta zum letzten Sample (kbps)
    let bitrateKbps = 0;
    if (this.lastBitrateSample && durationMs > this.lastBitrateSample.durationMs) {
      const dBytes = bytes - this.lastBitrateSample.bytes;
      const dSeconds = (durationMs - this.lastBitrateSample.durationMs) / 1000;
      if (dSeconds > 0) {
        bitrateKbps = Math.round((dBytes * 8) / dSeconds / 1000);
      }
    }
    if (s.outputActive) {
      this.lastBitrateSample = { bytes, durationMs };
    } else {
      this.lastBitrateSample = null;
    }

    return {
      streaming: s.outputActive,
      bitrateKbps,
      droppedFrames: s.outputSkippedFrames,
      totalFrames: s.outputTotalFrames,
      durationMs
    };
  }
}
