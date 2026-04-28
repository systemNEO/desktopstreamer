import { useEffect, useState, useRef } from 'react';
import { ipc } from '@renderer/lib/ipc';
import { LiveButton } from '@renderer/components/LiveButton';
import type { AppConfig, StreamStats } from '@shared/types';

const ZERO_STATS: StreamStats = { bitrateKbps: 0, droppedFrames: 0, uptimeSeconds: 0 };

function formatUptime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

export function StreamControl() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [stats, setStats] = useState<StreamStats>(ZERO_STATS);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollerRef = useRef<number | null>(null);

  useEffect(() => {
    void ipc.getConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (!isLive) {
      if (pollerRef.current !== null) {
        window.clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
      return;
    }
    pollerRef.current = window.setInterval(() => {
      void ipc.getStats().then(setStats);
    }, 1000);
    return () => {
      if (pollerRef.current !== null) window.clearInterval(pollerRef.current);
    };
  }, [isLive]);

  async function toggleLive() {
    setErrorMsg(null);
    if (isLive) {
      await ipc.stopStream();
      setIsLive(false);
      setStats(ZERO_STATS);
    } else {
      const result = await ipc.startStream();
      if (result.ok) {
        setIsLive(true);
      } else {
        setErrorMsg(result.error);
      }
    }
  }

  const canGoLive = !!config?.selectedSourceId && !!config?.selectedDestinationKind;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <LiveButton isLive={isLive} disabled={!canGoLive} onClick={() => void toggleLive()} />
        {!canGoLive && (
          <p className="text-sm text-text-muted">
            Wähle zuerst eine Quelle und ein Ziel.
          </p>
        )}
      </div>

      {errorMsg && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-900 p-3 rounded-lg">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 pt-2">
        <Stat label="Bitrate" value={`${stats.bitrateKbps} kbps`} />
        <Stat label="Dropped" value={String(stats.droppedFrames)} />
        <Stat label="Uptime" value={formatUptime(stats.uptimeSeconds)} />
      </div>

      {isLive && config?.customRtmp?.outputUrl && (
        <div className="bg-bg p-3 rounded-lg">
          <div className="text-xs text-text-muted mb-1">Stream-URL für VRChat:</div>
          <code className="text-xs font-mono break-all">{config.customRtmp.outputUrl}</code>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg p-3 rounded-lg">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-lg font-mono">{value}</div>
    </div>
  );
}
