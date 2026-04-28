import type { AppConfig } from '@shared/types';

const DEFAULTS: AppConfig = {
  selectedSourceId: null,
  audio: { systemAudioEnabled: true, microphoneEnabled: true },
  selectedDestinationKind: 'custom',
  customRtmp: null
};

// Minimal-Interface, das wir brauchen — kompatibel mit electron-store.
// In Tests wird ein FakeStore mit identischer Signatur eingeschoben.
export interface IStore<T> {
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
  readonly store: T;
}

export class ConfigStore {
  constructor(private store: IStore<AppConfig>) {}

  getAll(): AppConfig {
    return { ...this.store.store };
  }

  update(partial: Partial<AppConfig>): AppConfig {
    for (const [key, value] of Object.entries(partial)) {
      // undefined würde die Defaults überschreiben — explizit überspringen.
      if (value === undefined) continue;
      this.store.set(key as keyof AppConfig, value as never);
    }
    return this.getAll();
  }

  static defaults(): AppConfig {
    return structuredClone(DEFAULTS);
  }
}
