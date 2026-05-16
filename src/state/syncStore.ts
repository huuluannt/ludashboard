import { create } from 'zustand';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

interface SyncStore {
  status: SyncStatus;
  lastSyncedAt: Date | null;
  errorMessage: string | null;

  setStatus: (status: SyncStatus, error?: string) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  status: navigator.onLine ? 'synced' : 'offline',
  lastSyncedAt: null,
  errorMessage: null,

  setStatus: (status, error) => {
    set({ 
      status, 
      errorMessage: error || null,
      lastSyncedAt: status === 'synced' ? new Date() : undefined 
    });
  }
}));

// Listen to online/offline events
window.addEventListener('online', () => useSyncStore.getState().setStatus('synced'));
window.addEventListener('offline', () => useSyncStore.getState().setStatus('offline'));
