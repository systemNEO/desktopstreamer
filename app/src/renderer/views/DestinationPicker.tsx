import { useEffect, useState } from 'react';
import { ipc } from '@renderer/lib/ipc';
import type { AppConfig, DestinationKind, CustomRtmpDestination } from '@shared/types';

const OPTIONS: { kind: DestinationKind; label: string }[] = [
  { kind: 'twitch', label: 'Twitch' },
  { kind: 'local', label: 'Lokal' },
  { kind: 'custom', label: 'Custom RTMP' }
];

const EMPTY_CUSTOM: CustomRtmpDestination = {
  kind: 'custom',
  rtmpUrl: '',
  streamKey: '',
  outputUrl: ''
};

export function DestinationPicker() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [customDraft, setCustomDraft] = useState<CustomRtmpDestination>(EMPTY_CUSTOM);

  useEffect(() => {
    void ipc.getConfig().then((cfg) => {
      setConfig(cfg);
      if (cfg.customRtmp) setCustomDraft(cfg.customRtmp);
    });
  }, []);

  if (!config) return <div className="text-text-muted">Lädt …</div>;

  async function selectKind(kind: DestinationKind) {
    const updated = await ipc.setConfig({ selectedDestinationKind: kind });
    setConfig(updated);
  }

  async function persistCustom() {
    const updated = await ipc.setConfig({ customRtmp: customDraft });
    setConfig(updated);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {OPTIONS.map((opt) => (
          <label
            key={opt.kind}
            className="flex items-center gap-3 p-3 rounded-lg bg-bg hover:bg-bg-hover cursor-pointer"
          >
            <input
              type="radio"
              name="destination"
              value={opt.kind}
              checked={config.selectedDestinationKind === opt.kind}
              onChange={() => selectKind(opt.kind)}
              className="w-4 h-4 accent-accent"
            />
            <span className="font-medium text-sm">{opt.label}</span>
          </label>
        ))}
      </div>

      {config.selectedDestinationKind === 'twitch' && (
        <div className="text-sm text-text-muted bg-bg p-3 rounded-lg">
          Twitch-Integration kommt mit Plan B3 (OAuth).
        </div>
      )}

      {config.selectedDestinationKind === 'local' && (
        <div className="text-sm text-text-muted bg-bg p-3 rounded-lg">
          Lokaler MediaMTX-Server kommt mit Plan B4.
        </div>
      )}

      {config.selectedDestinationKind === 'custom' && (
        <div className="space-y-3 bg-bg p-4 rounded-lg">
          <label className="block text-sm">
            <span className="block text-text-muted mb-1">RTMP-URL</span>
            <input
              type="text"
              placeholder="rtmp://server.example.com:1935/live"
              value={customDraft.rtmpUrl}
              onChange={(e) =>
                setCustomDraft({ ...customDraft, rtmpUrl: e.target.value })
              }
              onBlur={persistCustom}
              aria-label="RTMP-URL"
              className="w-full bg-bg-surface px-3 py-2 rounded border border-bg-hover focus:border-accent outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-text-muted mb-1">Stream-Key</span>
            <input
              type="password"
              placeholder="Vom Server-Installer ausgegeben"
              value={customDraft.streamKey}
              onChange={(e) =>
                setCustomDraft({ ...customDraft, streamKey: e.target.value })
              }
              onBlur={persistCustom}
              aria-label="Stream-Key"
              className="w-full bg-bg-surface px-3 py-2 rounded border border-bg-hover focus:border-accent outline-none font-mono"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-text-muted mb-1">
              Output-URL für VRChat (optional, rein kosmetisch)
            </span>
            <input
              type="text"
              placeholder="https://server/live/{streamkey}/index.m3u8"
              value={customDraft.outputUrl}
              onChange={(e) =>
                setCustomDraft({ ...customDraft, outputUrl: e.target.value })
              }
              onBlur={persistCustom}
              aria-label="Output-URL"
              className="w-full bg-bg-surface px-3 py-2 rounded border border-bg-hover focus:border-accent outline-none"
            />
          </label>
        </div>
      )}
    </div>
  );
}
