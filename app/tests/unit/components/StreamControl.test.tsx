import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { StreamControl } from '../../../src/renderer/views/StreamControl';

beforeEach(() => {
  (globalThis as { window: Window }).window.api = {
    config: {
      get: vi.fn().mockResolvedValue({
        selectedSourceId: 'src1',
        audio: { systemAudioEnabled: true, microphoneEnabled: true },
        selectedDestinationKind: 'custom',
        customRtmp: { kind: 'custom', rtmpUrl: 'rtmp://x/live', streamKey: 'k', outputUrl: '' }
      }),
      set: vi.fn()
    },
    sources: { list: vi.fn() },
    stream: {
      start: vi.fn().mockResolvedValue({ ok: true }),
      stop: vi.fn().mockResolvedValue({ ok: true }),
      getStats: vi.fn().mockResolvedValue({ bitrateKbps: 0, droppedFrames: 0, uptimeSeconds: 0 })
    }
  } as never;
});

describe('StreamControl', () => {
  it('rendert Live-Button', async () => {
    render(<StreamControl />);
    expect(await screen.findByRole('button', { name: /stream starten/i })).toBeInTheDocument();
  });

  it('Klick auf Live ruft stream.start', async () => {
    render(<StreamControl />);
    const btn = await screen.findByRole('button', { name: /stream starten/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(window.api.stream.start).toHaveBeenCalled();
    });
  });

  it('Button ist disabled wenn keine Source ausgewählt', async () => {
    (window.api.config.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedSourceId: null,
      audio: { systemAudioEnabled: true, microphoneEnabled: true },
      selectedDestinationKind: 'custom',
      customRtmp: null
    });
    render(<StreamControl />);
    const btn = await screen.findByRole('button', { name: /stream starten/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('zeigt Stats-Felder (Bitrate, Dropped, Uptime)', async () => {
    render(<StreamControl />);
    expect(await screen.findByText(/bitrate/i)).toBeInTheDocument();
    expect(screen.getByText(/dropped/i)).toBeInTheDocument();
    expect(screen.getByText(/uptime/i)).toBeInTheDocument();
  });
});
