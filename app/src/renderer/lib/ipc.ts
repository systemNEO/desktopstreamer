import type { AppConfig, Source, StreamStats } from '@shared/types';

export const ipc = {
  async getConfig(): Promise<AppConfig> {
    return window.api.config.get();
  },
  async setConfig(partial: Partial<AppConfig>): Promise<AppConfig> {
    return window.api.config.set(partial);
  },
  async listSources(): Promise<Source[]> {
    return window.api.sources.list();
  },
  async startStream(): Promise<{ ok: true } | { ok: false; error: string }> {
    return window.api.stream.start();
  },
  async stopStream(): Promise<{ ok: true }> {
    return window.api.stream.stop();
  },
  async getStats(): Promise<StreamStats> {
    return window.api.stream.getStats();
  }
};
