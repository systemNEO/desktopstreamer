interface LiveButtonProps {
  isLive: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function LiveButton({ isLive, disabled, onClick }: LiveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isLive ? 'Stream stoppen' : 'Stream starten'}
      className={`px-8 py-4 rounded-xl font-bold text-base transition focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-surface ${
        disabled
          ? 'bg-bg-hover text-text-muted cursor-not-allowed'
          : isLive
          ? 'bg-accent-live hover:bg-red-700 text-white'
          : 'bg-accent hover:bg-blue-600 text-white'
      }`}
    >
      {isLive ? '⏹  Stream stoppen' : '🔴  Live gehen'}
    </button>
  );
}
