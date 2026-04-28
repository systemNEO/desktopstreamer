import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { AppConfig, Source, StreamStats } from '@shared/types';

// Typed API, exponiert auf window.api im Renderer.
const api = {
  config: {
    get: (): Promise<AppConfig> => ipcRenderer.invoke(IPC.config.get),
    set: (partial: Partial<AppConfig>): Promise<AppConfig> =>
      ipcRenderer.invoke(IPC.config.set, partial)
  },
  sources: {
    list: (): Promise<Source[]> => ipcRenderer.invoke(IPC.sources.list)
  },
  stream: {
    start: (): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke(IPC.stream.start),
    stop: (): Promise<{ ok: true }> => ipcRenderer.invoke(IPC.stream.stop),
    getStats: (): Promise<StreamStats> => ipcRenderer.invoke(IPC.stream.statsSubscribe)
  }
};

contextBridge.exposeInMainWorld('api', api);

// Type-Augment für Renderer
declare global {
  interface Window {
    api: typeof api;
  }
}

export type { api };
