import type { AppConfig, Source, StreamStats } from './types';

// Channel-Namen — als const-Strings exportiert für Type-Safety
export const IPC = {
  config: {
    get: 'config:get',
    set: 'config:set'
  },
  sources: {
    list: 'sources:list'
  },
  stream: {
    start: 'stream:start',
    stop: 'stream:stop',
    statsSubscribe: 'stream:stats:subscribe'
  }
} as const;

// Request/Response-Signaturen pro Channel — in Preload + Handler verwendet
export interface IPCContract {
  [IPC.config.get]: {
    request: void;
    response: AppConfig;
  };
  [IPC.config.set]: {
    request: Partial<AppConfig>;
    response: AppConfig;
  };
  [IPC.sources.list]: {
    request: void;
    response: Source[];
  };
  [IPC.stream.start]: {
    request: void;
    response: { ok: true } | { ok: false; error: string };
  };
  [IPC.stream.stop]: {
    request: void;
    response: { ok: true };
  };
  [IPC.stream.statsSubscribe]: {
    request: void;
    response: StreamStats;
  };
}
