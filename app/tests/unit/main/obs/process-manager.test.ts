import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OBSProcessManager } from '../../../../src/main/obs/process-manager';
import * as childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';

vi.mock('node:child_process');

class FakeProcess extends EventEmitter {
  pid = 12345;
  killed = false;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill(_signal?: string) {
    this.killed = true;
    setImmediate(() => this.emit('exit', 0, null));
    return true;
  }
}

describe('OBSProcessManager', () => {
  let mgr: OBSProcessManager;
  let fake: FakeProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    fake = new FakeProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(fake as never);
    mgr = new OBSProcessManager();
  });

  it('spawn ruft child_process.spawn mit korrekten Args', () => {
    mgr.spawn('/path/to/obs64.exe', { profile: 'P', collection: 'C' });
    expect(childProcess.spawn).toHaveBeenCalledWith(
      '/path/to/obs64.exe',
      expect.arrayContaining([
        '--minimize-to-tray',
        '--disable-updater',
        '--profile', 'P',
        '--collection', 'C'
      ]),
      expect.any(Object)
    );
  });

  it('isRunning ist initial false, true nach spawn', () => {
    expect(mgr.isRunning()).toBe(false);
    mgr.spawn('/path/to/obs64.exe', { profile: 'P', collection: 'C' });
    expect(mgr.isRunning()).toBe(true);
  });

  it('kill setzt isRunning auf false und resolved', async () => {
    mgr.spawn('/path/to/obs64.exe', { profile: 'P', collection: 'C' });
    await mgr.kill();
    expect(mgr.isRunning()).toBe(false);
    expect(fake.killed).toBe(true);
  });

  it('emit exit-Event wenn Prozess unerwartet beendet', () => {
    const handler = vi.fn();
    mgr.on('exit', handler);
    mgr.spawn('/path/to/obs64.exe', { profile: 'P', collection: 'C' });
    fake.emit('exit', 1, null);
    expect(handler).toHaveBeenCalledWith({ code: 1, signal: null });
  });

  it('zweimaliges spawn ohne kill wirft Fehler', () => {
    mgr.spawn('/path/to/obs64.exe', { profile: 'P', collection: 'C' });
    expect(() => mgr.spawn('/path/to/obs64.exe', { profile: 'P', collection: 'C' })).toThrow(/läuft bereits/);
  });
});
