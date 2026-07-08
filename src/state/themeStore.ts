import { create } from 'zustand';
import { offlineStorage } from '@/storage/offlineStorage';

export type ThemeMode = 'light' | 'dark';

interface ThemeStore {
  mode: ThemeMode;
  _hydrated: boolean;

  hydrate: () => Promise<void>;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === 'undefined') return;

  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: 'light',
  _hydrated: false,

  async hydrate() {
    const mode = await offlineStorage.getThemeMode();
    applyThemeMode(mode);
    set({ mode, _hydrated: true });
  },

  setMode(mode) {
    if (get().mode === mode) return;
    applyThemeMode(mode);
    set({ mode });
    offlineStorage.setThemeMode(mode);
  },

  toggleMode() {
    get().setMode(get().mode === 'dark' ? 'light' : 'dark');
  },
}));
