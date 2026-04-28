import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DestinationPicker } from '../../../src/renderer/views/DestinationPicker';

beforeEach(() => {
  (globalThis as { window: Window }).window.api = {
    config: {
      get: vi.fn().mockResolvedValue({
        selectedSourceId: null,
        audio: { systemAudioEnabled: true, microphoneEnabled: true },
        selectedDestinationKind: 'custom',
        customRtmp: null
      }),
      set: vi.fn(async (p) => ({
        selectedSourceId: null,
        audio: { systemAudioEnabled: true, microphoneEnabled: true },
        selectedDestinationKind: 'custom',
        customRtmp: null,
        ...p
      }))
    },
    sources: { list: vi.fn() },
    stream: { start: vi.fn(), stop: vi.fn(), getStats: vi.fn() }
  } as never;
});

describe('DestinationPicker', () => {
  it('zeigt drei Optionen (Twitch, Lokal, Custom)', async () => {
    render(<DestinationPicker />);
    expect(await screen.findByLabelText(/twitch/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lokal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/custom/i)).toBeInTheDocument();
  });

  it('Custom-RTMP zeigt Felder wenn ausgewählt', async () => {
    render(<DestinationPicker />);
    const customRadio = await screen.findByLabelText(/custom/i);
    fireEvent.click(customRadio);
    await waitFor(() => {
      expect(screen.getByLabelText(/rtmp-url/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/stream-key/i)).toBeInTheDocument();
    });
  });

  it('Twitch und Lokal zeigen Hinweise auf folgende Pläne', async () => {
    render(<DestinationPicker />);
    const twitchRadio = await screen.findByLabelText(/twitch/i);
    fireEvent.click(twitchRadio);
    await waitFor(() => {
      expect(screen.getByText(/plan b3/i)).toBeInTheDocument();
    });
    const localRadio = screen.getByLabelText(/lokal/i);
    fireEvent.click(localRadio);
    await waitFor(() => {
      expect(screen.getByText(/plan b4/i)).toBeInTheDocument();
    });
  });

  it('eingegebene RTMP-Werte werden in setConfig gespeichert (debounced/blur)', async () => {
    render(<DestinationPicker />);
    const customRadio = await screen.findByLabelText(/custom/i);
    fireEvent.click(customRadio);
    const rtmpInput = await screen.findByLabelText(/rtmp-url/i);
    fireEvent.change(rtmpInput, { target: { value: 'rtmp://test/live' } });
    fireEvent.blur(rtmpInput);
    await waitFor(() => {
      expect(window.api.config.set).toHaveBeenCalledWith(
        expect.objectContaining({
          customRtmp: expect.objectContaining({ rtmpUrl: 'rtmp://test/live' })
        })
      );
    });
  });
});
