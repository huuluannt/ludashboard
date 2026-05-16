import { create } from 'zustand';
import { offlineStorage } from '@/storage/offlineStorage';

interface SidebarStore {
  collapsed: boolean;
  searchQuery: string;
  pinnedModuleIds: string[];
  _hydrated: boolean;

  hydrate: () => Promise<void>;
  toggleCollapsed: () => void;
  setSearchQuery: (q: string) => void;
  togglePin: (moduleId: string) => void;
  isPinned: (moduleId: string) => boolean;
}

export const useSidebarStore = create<SidebarStore>((set, get) => ({
  collapsed: false,
  searchQuery: '',
  pinnedModuleIds: [],
  _hydrated: false,

  async hydrate() {
    const collapsed = await offlineStorage.getSidebarCollapsed();
    const pinnedModuleIds = await offlineStorage.getPinned();
    set({ collapsed, pinnedModuleIds, _hydrated: true });
  },

  toggleCollapsed() {
    const next = !get().collapsed;
    set({ collapsed: next });
    offlineStorage.setSidebarCollapsed(next);
  },

  setSearchQuery(q: string) {
    set({ searchQuery: q });
  },

  togglePin(moduleId: string) {
    const { pinnedModuleIds } = get();
    const next = pinnedModuleIds.includes(moduleId)
      ? pinnedModuleIds.filter((id) => id !== moduleId)
      : [...pinnedModuleIds, moduleId];
    set({ pinnedModuleIds: next });
    offlineStorage.setPinned(next);
  },

  isPinned(moduleId: string) {
    return get().pinnedModuleIds.includes(moduleId);
  },
}));
