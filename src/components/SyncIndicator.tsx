import { useSyncStore } from '@/state/syncStore';
import Icon from './Icon';

export default function SyncIndicator() {
  const status = useSyncStore((s) => s.status);
  
  if (status === 'synced') return null;

  return (
    <div className="fixed bottom-4 right-4 z-[999] pointer-events-none">
      <div className="bg-white border border-[var(--color-border)] shadow-lg rounded-full px-3 py-1.5 flex items-center gap-2">
        {status === 'syncing' && (
          <>
            <div className="w-3 h-3 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Syncing...</span>
          </>
        )}
        {status === 'offline' && (
          <>
            <Icon name="cloud" size={12} className="text-[var(--color-text-tertiary)]" />
            <span className="text-xs font-medium text-[var(--color-text-tertiary)]">Offline Mode</span>
          </>
        )}
        {status === 'error' && (
          <>
            <Icon name="x" size={12} className="text-[var(--color-danger)]" />
            <span className="text-xs font-medium text-[var(--color-danger)]">Sync Error</span>
          </>
        )}
      </div>
    </div>
  );
}
