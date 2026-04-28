import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OBSWebSocketClient } from '../../../../src/main/obs/ws-client';

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockCall = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();

vi.mock('obs-websocket-js', () => {
  class FakeOBS {
    connect = mockConnect;
    disconnect = mockDisconnect;
    call = mockCall;
    on = mockOn;
    off = mockOff;
  }
  return { default: FakeOBS };
});

describe('OBSWebSocketClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue({ obsWebSocketVersion: '5.4.0' });
    mockCall.mockResolvedValue({ obsVersion: '30.1.0' });
  });

  it('connect ruft obs-websocket-js connect mit URL', async () => {
    const client = new OBSWebSocketClient({ url: 'ws://localhost:4455' });
    await client.connect();
    expect(mockConnect).toHaveBeenCalledWith('ws://localhost:4455', undefined);
  });

  it('connect liefert OBS-Version via GetVersion-Call', async () => {
    const client = new OBSWebSocketClient({ url: 'ws://localhost:4455' });
    const version = await client.connect();
    expect(version).toBe('30.1.0');
  });

  it('startStream ruft StartStream', async () => {
    mockCall.mockImplementation(async (req: string) => {
      if (req === 'GetVersion') return { obsVersion: '30.1.0' };
      if (req === 'StartStream') return {};
      throw new Error(`unexpected ${req}`);
    });
    const client = new OBSWebSocketClient({ url: 'ws://localhost:4455' });
    await client.connect();
    await client.startStream();
    expect(mockCall).toHaveBeenCalledWith('StartStream');
  });

  it('stopStream ruft StopStream', async () => {
    mockCall.mockImplementation(async (req: string) => {
      if (req === 'GetVersion') return { obsVersion: '30.1.0' };
      if (req === 'StopStream') return {};
      throw new Error(`unexpected ${req}`);
    });
    const client = new OBSWebSocketClient({ url: 'ws://localhost:4455' });
    await client.connect();
    await client.stopStream();
    expect(mockCall).toHaveBeenCalledWith('StopStream');
  });

  it('disconnect ruft underlying disconnect', async () => {
    const client = new OBSWebSocketClient({ url: 'ws://localhost:4455' });
    await client.connect();
    await client.disconnect();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('isConnected reflektiert connect/disconnect-state', async () => {
    const client = new OBSWebSocketClient({ url: 'ws://localhost:4455' });
    expect(client.isConnected()).toBe(false);
    await client.connect();
    expect(client.isConnected()).toBe(true);
    await client.disconnect();
    expect(client.isConnected()).toBe(false);
  });

  it('setStreamServiceCustom propagiert URL und Key', async () => {
    mockCall.mockImplementation(async (req: string) => {
      if (req === 'GetVersion') return { obsVersion: '30.1.0' };
      if (req === 'SetStreamServiceSettings') return {};
      throw new Error(`unexpected ${req}`);
    });
    const client = new OBSWebSocketClient({ url: 'ws://localhost:4455' });
    await client.connect();
    await client.setStreamServiceCustom({ server: 'rtmp://x/live', key: 'abc' });
    expect(mockCall).toHaveBeenCalledWith('SetStreamServiceSettings', {
      streamServiceType: 'rtmp_custom',
      streamServiceSettings: { server: 'rtmp://x/live', key: 'abc' }
    });
  });
});
