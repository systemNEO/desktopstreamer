import { describe, it, expect } from 'vitest';
import { IPC } from '@shared/ipc-channels';

describe('IPC channel constants', () => {
  it('haben eindeutige Strings', () => {
    const allChannels = [
      IPC.config.get,
      IPC.config.set,
      IPC.sources.list,
      IPC.stream.start,
      IPC.stream.stop,
      IPC.stream.statsSubscribe
    ];
    const unique = new Set(allChannels);
    expect(unique.size).toBe(allChannels.length);
  });

  it('alle Channel-Strings sind nicht-leer', () => {
    const allChannels = [
      IPC.config.get,
      IPC.config.set,
      IPC.sources.list,
      IPC.stream.start,
      IPC.stream.stop,
      IPC.stream.statsSubscribe
    ];
    for (const c of allChannels) {
      expect(c.length).toBeGreaterThan(0);
    }
  });

  it('config-Channels haben "config:"-Prefix', () => {
    expect(IPC.config.get).toMatch(/^config:/);
    expect(IPC.config.set).toMatch(/^config:/);
  });
});
