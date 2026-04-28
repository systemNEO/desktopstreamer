import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { AppConfig, Source, StreamStats } from '@shared/types';
import { ConfigStore } from './config-store.js';

export function registerIpcHandlers(configStore: ConfigStore): void {
  ipcMain.handle(IPC.config.get, (): AppConfig => configStore.getAll());

  ipcMain.handle(IPC.config.set, (_e, partial: Partial<AppConfig>): AppConfig => {
    return configStore.update(partial);
  });

  // Stub-Implementationen — Plan B2 füllt sie mit libobs-Daten.
  ipcMain.handle(IPC.sources.list, (): Source[] => {
    // Mock-Daten zum UI-Bauen. Wird von Plan B2 durch echte Source-Enumeration ersetzt.
    return [
      { id: 'mock-screen-1', kind: 'screen', label: 'Bildschirm 1' },
      { id: 'mock-window-1', kind: 'window', label: 'Mock-Fenster: Browser' },
      { id: 'mock-audio-1', kind: 'audio', label: 'Default Audio Output' }
    ];
  });

  ipcMain.handle(IPC.stream.start, (): { ok: false; error: string } => ({
    ok: false,
    error: 'Streaming-Engine kommt in Plan B2'
  }));

  ipcMain.handle(IPC.stream.stop, (): { ok: true } => ({ ok: true }));

  ipcMain.handle(IPC.stream.statsSubscribe, (): StreamStats => ({
    bitrateKbps: 0,
    droppedFrames: 0,
    uptimeSeconds: 0
  }));
}
