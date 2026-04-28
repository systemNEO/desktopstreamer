import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SourcePicker } from '../../../src/renderer/views/SourcePicker';

beforeEach(() => {
  (globalThis as { window: Window }).window.api = {
    config: {
      get: vi.fn().mockResolvedValue({
        selectedSourceId: null,
        audio: { systemAudioEnabled: true, microphoneEnabled: true },
        selectedDestinationKind: 'custom',
        customRtmp: null
      }),
      set: vi.fn().mockResolvedValue({
        selectedSourceId: null,
        audio: { systemAudioEnabled: false, microphoneEnabled: true },
        selectedDestinationKind: 'custom',
        customRtmp: null
      })
    },
    sources: {
      list: vi.fn().mockResolvedValue([
        { id: 's1', kind: 'screen', label: 'Bildschirm 1' },
        { id: 'w1', kind: 'window', label: 'Fenster A' },
        { id: 'a1', kind: 'audio', label: 'Mikro' }
      ])
    },
    stream: {
      start: vi.fn(),
      stop: vi.fn(),
      getStats: vi.fn()
    }
  } as never;
});

describe('SourcePicker', () => {
  it('rendert die drei Tabs (Bildschirm, Fenster, Audio)', async () => {
    render(<SourcePicker />);
    expect(await screen.findByRole('tab', { name: /bildschirm/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /fenster/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /audio/i })).toBeInTheDocument();
  });

  it('zeigt nach dem Laden Sources des aktiven Tabs', async () => {
    render(<SourcePicker />);
    await waitFor(() => {
      expect(screen.getByText('Bildschirm 1')).toBeInTheDocument();
    });
  });

  it('Audio-Toggles sind initial an', async () => {
    render(<SourcePicker />);
    const sysAudio = await screen.findByLabelText(/system-audio/i);
    const mic = screen.getByLabelText(/mikrofon/i);
    expect((sysAudio as HTMLInputElement).checked).toBe(true);
    expect((mic as HTMLInputElement).checked).toBe(true);
  });

  it('toggle Audio ruft setConfig', async () => {
    render(<SourcePicker />);
    const sysAudio = await screen.findByLabelText(/system-audio/i);
    fireEvent.click(sysAudio);
    await waitFor(() => {
      expect(window.api.config.set).toHaveBeenCalledWith({
        audio: { systemAudioEnabled: false, microphoneEnabled: true }
      });
    });
  });
});
