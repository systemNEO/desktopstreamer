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
        return {
          ok: false,
          error: 'Plan B2 unterstützt nur Custom-RTMP. Twitch in Plan B3, Lokal in Plan B4.'
        };
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
