import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigStore } from '../../src/main/config-store';
import type { AppConfig } from '@shared/types';

// In-Memory-Mock von electron-store für Tests
class FakeStore<T> {
  private data: Record<string, unknown>;
  constructor(opts: { defaults: T }) {
    this.data = { ...(opts.defaults as object) };
  }
  get<K extends keyof T>(key: K): T[K] {
    return this.data[key as string] as T[K];
  }
  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key as string] = value;
  }
  get store(): T {
    return { ...this.data } as T;
  }
}

describe('ConfigStore', () => {
  let configStore: ConfigStore;

  beforeEach(() => {
    const fake = new FakeStore<AppConfig>({
      defaults: {
        selectedSourceId: null,
        audio: { systemAudioEnabled: true, microphoneEnabled: true },
        selectedDestinationKind: 'custom',
        customRtmp: null
      }
    });
    configStore = new ConfigStore(fake as never);
  });

  it('getAll liefert die Defaults', () => {
    const cfg = configStore.getAll();
    expect(cfg.audio.systemAudioEnabled).toBe(true);
    expect(cfg.selectedSourceId).toBeNull();
  });

  it('update merged partial in den Store', () => {
    configStore.update({ selectedSourceId: 'src-123' });
    const cfg = configStore.getAll();
    expect(cfg.selectedSourceId).toBe('src-123');
    expect(cfg.audio.systemAudioEnabled).toBe(true);
  });

  it('update merged audio-Subobjekt korrekt', () => {
    configStore.update({ audio: { systemAudioEnabled: false, microphoneEnabled: true } });
    const cfg = configStore.getAll();
    expect(cfg.audio.systemAudioEnabled).toBe(false);
    expect(cfg.audio.microphoneEnabled).toBe(true);
  });

  it('update gibt aktuelle Config zurück', () => {
    const result = configStore.update({ selectedSourceId: 'foo' });
    expect(result.selectedSourceId).toBe('foo');
  });
});
