import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { InstallProgressDialog } from '../../../src/renderer/components/InstallProgressDialog';

beforeEach(() => {
  (globalThis as { window: Window }).window.api = {
    config: { get: vi.fn(), set: vi.fn() },
    sources: { list: vi.fn() },
    stream: { start: vi.fn(), stop: vi.fn(), getStats: vi.fn() },
    obs: {
      getStatus: vi.fn().mockResolvedValue({ state: 'detecting' }),
      onStatusEvent: vi.fn(() => () => {}),
      onInstallProgress: vi.fn(() => () => {})
    }
  } as never;
});

describe('InstallProgressDialog', () => {
  it('zeigt "Suche OBS Studio" beim Detecting-State', async () => {
    render(<InstallProgressDialog />);
    await waitFor(() => {
      expect(screen.getByText(/suche obs studio/i)).toBeInTheDocument();
    });
  });

  it('rendert nichts bei state=ready', async () => {
    (window.api.obs.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: 'ready',
      obsVersion: '30.1.0'
    });
    const { container } = render(<InstallProgressDialog />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('zeigt Progress-Bar im installing-State', async () => {
    (window.api.obs.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: 'installing',
      progress: 50,
      message: 'Lade Installer'
    });
    render(<InstallProgressDialog />);
    await waitFor(() => {
      expect(screen.getByText(/wird installiert/i)).toBeInTheDocument();
    });
  });

  it('zeigt Fehler-Box bei install-failed', async () => {
    (window.api.obs.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: 'install-failed',
      error: 'Download failed: 503'
    });
    render(<InstallProgressDialog />);
    await waitFor(() => {
      expect(screen.getByText(/installation fehlgeschlagen/i)).toBeInTheDocument();
      expect(screen.getByText(/Download failed: 503/)).toBeInTheDocument();
    });
  });
});
