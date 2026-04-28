import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDetect = vi.fn();
const mockInstall = vi.fn();
const mockWriteProfile = vi.fn();
const mockWriteSceneCollection = vi.fn();
const mockWriteWebSocketConfig = vi.fn();
const mockGetAppDataDir = vi.fn(() => '/tmp/obs');

vi.mock('../../../../src/main/obs/detect', () => ({
  detectOBSInstallation: (...args: unknown[]) => mockDetect(...args)
}));
vi.mock('../../../../src/main/obs/installer', () => ({
  installObs: (...args: unknown[]) => mockInstall(...args)
}));
vi.mock('../../../../src/main/obs/profile-writer', () => ({
  writeObsProfile: (...args: unknown[]) => mockWriteProfile(...args),
  writeSceneCollection: (...args: unknown[]) => mockWriteSceneCollection(...args),
  writeWebSocketConfig: (...args: unknown[]) => mockWriteWebSocketConfig(...args),
  getObsAppDataDir: () => mockGetAppDataDir()
}));

const mockSpawn = vi.fn();
const mockKill = vi.fn();
const mockIsRunning = vi.fn(() => true);
vi.mock('../../../../src/main/obs/process-manager', () => {
  class FakeProc {
    spawn = mockSpawn;
    kill = mockKill;
    isRunning = mockIsRunning;
    on = vi.fn();
  }
  return { OBSProcessManager: FakeProc };
});

const mockWsConnect = vi.fn();
const mockWsDisconnect = vi.fn();
const mockWsIsConnected = vi.fn(() => true);
const mockWsSetProfile = vi.fn();
const mockWsSetCollection = vi.fn();
vi.mock('../../../../src/main/obs/ws-client', () => {
  class FakeWs {
    connect = mockWsConnect;
    disconnect = mockWsDisconnect;
    isConnected = mockWsIsConnected;
    setCurrentProfile = mockWsSetProfile;
    setCurrentSceneCollection = mockWsSetCollection;
  }
  return { OBSWebSocketClient: FakeWs };
});

import { OBSManager } from '../../../../src/main/obs/manager';

describe('OBSManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWsConnect.mockResolvedValue('30.1.0');
    mockIsRunning.mockReturnValue(false);
  });

  it('ensureReady: Happy-Path mit installiertem OBS', async () => {
    mockDetect.mockResolvedValue({ installed: true, path: '/path/to/obs64.exe' });
    const mgr = new OBSManager({ startupDelayMs: 0, connectRetryDelayMs: 0 });
    const status = await mgr.ensureReady();
    expect(status.state).toBe('ready');
    expect(mockInstall).not.toHaveBeenCalled();
    expect(mockWriteProfile).toHaveBeenCalled();
    expect(mockSpawn).toHaveBeenCalledWith('/path/to/obs64.exe', expect.any(Object));
    expect(mockWsConnect).toHaveBeenCalled();
  });

  it('ensureReady: triggert Install wenn OBS fehlt', async () => {
    mockDetect
      .mockResolvedValueOnce({ installed: false })
      .mockResolvedValueOnce({ installed: true, path: '/path/to/obs64.exe' });
    mockInstall.mockResolvedValue(undefined);
    const mgr = new OBSManager({ startupDelayMs: 0, connectRetryDelayMs: 0 });
    const status = await mgr.ensureReady();
    expect(status.state).toBe('ready');
    expect(mockInstall).toHaveBeenCalled();
  });

  it('emit status-Events während Lifecycle', async () => {
    mockDetect.mockResolvedValue({ installed: true, path: '/path/to/obs64.exe' });
    const mgr = new OBSManager({ startupDelayMs: 0, connectRetryDelayMs: 0 });
    const states: string[] = [];
    mgr.on('status', (s) => states.push(s.state));
    await mgr.ensureReady();
    expect(states).toContain('detecting');
    expect(states).toContain('starting');
    expect(states).toContain('ready');
  });

  it('shutdown disconnectet WS und killed Process', async () => {
    mockDetect.mockResolvedValue({ installed: true, path: '/path/to/obs64.exe' });
    mockIsRunning.mockReturnValue(true);
    const mgr = new OBSManager({ startupDelayMs: 0, connectRetryDelayMs: 0 });
    await mgr.ensureReady();
    await mgr.shutdown();
    expect(mockWsDisconnect).toHaveBeenCalled();
    expect(mockKill).toHaveBeenCalled();
  });

  it('Install-Failure setzt status auf install-failed', async () => {
    mockDetect.mockResolvedValue({ installed: false });
    mockInstall.mockRejectedValue(new Error('download failed'));
    const mgr = new OBSManager({ startupDelayMs: 0, connectRetryDelayMs: 0 });
    const status = await mgr.ensureReady();
    expect(status.state).toBe('install-failed');
  });

  it('WebSocket-Connect-Failure setzt status auf disconnected', async () => {
    mockDetect.mockResolvedValue({ installed: true, path: '/path/to/obs64.exe' });
    mockWsConnect.mockRejectedValue(new Error('ws connect refused'));
    const mgr = new OBSManager({ startupDelayMs: 0, connectRetryDelayMs: 0 });
    const status = await mgr.ensureReady();
    expect(status.state).toBe('disconnected');
  });
});
