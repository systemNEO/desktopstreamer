import { useEffect, useState } from 'react';
import { ipc } from '@renderer/lib/ipc';
import type { OBSStatus } from '@shared/types';

export function InstallProgressDialog() {
  const [status, setStatus] = useState<OBSStatus>({ state: 'detecting' });

  useEffect(() => {
    void ipc.getObsStatus().then(setStatus);
    const off = ipc.onObsStatusEvent(setStatus);
    return off;
  }, []);

  if (status.state === 'ready') return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-bg-surface rounded-xl p-8 max-w-md w-full mx-4 border border-bg-hover">
        <h2 className="text-lg font-semibold mb-2">{titleFor(status)}</h2>
        <p className="text-text-muted text-sm mb-4">{messageFor(status)}</p>
        {status.state === 'installing' && (
          <div className="w-full h-2 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        )}
        {status.state === 'install-failed' && (
          <div className="text-sm text-red-400 bg-red-950/30 border border-red-900 p-3 rounded-lg mt-2">
            {status.error}
          </div>
        )}
        {status.state === 'disconnected' && (
          <div className="text-sm text-yellow-400 bg-yellow-950/30 border border-yellow-900 p-3 rounded-lg mt-2">
            {status.error}
          </div>
        )}
      </div>
    </div>
  );
}

function titleFor(s: OBSStatus): string {
  switch (s.state) {
    case 'detecting': return 'Suche OBS Studio …';
    case 'not-installed': return 'OBS Studio nicht gefunden';
    case 'installing': return 'OBS Studio wird installiert';
    case 'install-failed': return 'Installation fehlgeschlagen';
    case 'starting': return 'OBS Studio wird gestartet …';
    case 'disconnected': return 'OBS Studio nicht erreichbar';
    case 'ready': return '';
  }
}

function messageFor(s: OBSStatus): string {
  switch (s.state) {
    case 'detecting': return 'Prüfe Standardpfade und Registry.';
    case 'not-installed': return 'Klicke auf "Installieren", um die OBS-Engine zu installieren (~120 MB).';
    case 'installing': return s.message;
    case 'install-failed': return 'Bitte installiere OBS manuell von obsproject.com und starte die App neu.';
    case 'starting': return 'OBS startet im Hintergrund (Systray).';
    case 'disconnected': return 'Verbindung zu OBS verloren. Bitte App neu starten.';
    case 'ready': return '';
  }
}
