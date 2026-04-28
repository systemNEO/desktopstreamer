import { useEffect, useState } from 'react';
import { ipc } from '@renderer/lib/ipc';
import type { Source, SourceKind, AppConfig } from '@shared/types';

const TABS: { kind: SourceKind; label: string }[] = [
  { kind: 'screen', label: 'Bildschirm' },
  { kind: 'window', label: 'Fenster' },
  { kind: 'audio', label: 'Audio' }
];

export function SourcePicker() {
  const [activeTab, setActiveTab] = useState<SourceKind>('screen');
  const [sources, setSources] = useState<Source[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    void ipc.listSources().then(setSources);
    void ipc.getConfig().then(setConfig);
  }, []);

  if (!config) return <div className="text-text-muted">Lädt …</div>;

  const filtered = sources.filter((s) => s.kind === activeTab);

  async function selectSource(id: string) {
    const updated = await ipc.setConfig({ selectedSourceId: id });
    setConfig(updated);
  }

  async function toggleAudio(field: 'systemAudioEnabled' | 'microphoneEnabled') {
    if (!config) return;
    const newAudio = { ...config.audio, [field]: !config.audio[field] };
    const updated = await ipc.setConfig({ audio: newAudio });
    setConfig(updated);
  }

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-2 border-b border-bg-hover">
        {TABS.map((t) => (
          <button
            type="button"
            role="tab"
            key={t.kind}
            aria-selected={activeTab === t.kind}
            onClick={() => setActiveTab(t.kind)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === t.kind
                ? 'text-text-primary border-accent'
                : 'text-text-muted border-transparent hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 ? (
          <p className="col-span-full text-text-muted text-sm">Keine Quellen gefunden.</p>
        ) : (
          filtered.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => selectSource(s.id)}
              className={`p-3 rounded-lg border-2 text-left transition ${
                config.selectedSourceId === s.id
                  ? 'border-accent bg-bg-hover'
                  : 'border-bg-hover hover:border-text-muted'
              }`}
            >
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-xs text-text-muted">{s.kind}</div>
            </button>
          ))
        )}
      </div>

      <div className="pt-4 border-t border-bg-hover flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.audio.systemAudioEnabled}
            onChange={() => toggleAudio('systemAudioEnabled')}
            className="w-4 h-4"
          />
          System-Audio
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.audio.microphoneEnabled}
            onChange={() => toggleAudio('microphoneEnabled')}
            className="w-4 h-4"
          />
          Mikrofon
        </label>
      </div>
    </div>
  );
}
