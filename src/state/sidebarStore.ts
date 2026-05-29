import { create } from 'zustand';
import { offlineStorage } from '@/storage/offlineStorage';

interface SidebarStore {
  collapsed: boolean;
  searchQuery: string;
  pinnedModuleIds: string[];
  pickedModuleId: string | null;
  moduleOrderIds: string[];
  _hydrated: boolean;

  hydrate: () => Promise<void>;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setSearchQuery: (q: string) => void;
  togglePin: (moduleId: string) => void;
  setPickedModule: (moduleId: string | null) => void;
  setModuleOrder: (moduleIds: string[]) => void;
  removeModuleReferences: (moduleId: string) => void;
  replaceModuleId: (moduleId: string, nextModuleId: string) => void;
  isPinned: (moduleId: string) => boolean;
}

export const useSidebarStore = create<SidebarStore>((set, get) => ({
  collapsed: false,
  searchQuery: '',
  pinnedModuleIds: [],
  pickedModuleId: null,
  moduleOrderIds: [],
  _hydrated: false,

  async hydrate() {
    const collapsed = await offlineStorage.getSidebarCollapsed();
    const pinnedModuleIds = await offlineStorage.getPinned();
    const pickedModuleId = await offlineStorage.getPickedModule();
    const moduleOrderIds = await offlineStorage.getModuleOrder();
    set({ collapsed, pinnedModuleIds, pickedModuleId, moduleOrderIds, _hydrated: true });
  },

  toggleCollapsed() {
    const next = !get().collapsed;
    set({ collapsed: next });
    offlineStorage.setSidebarCollapsed(next);
  },

  setCollapsed(collapsed: boolean) {
    if (get().collapsed === collapsed) return;
    set({ collapsed });
    offlineStorage.setSidebarCollapsed(collapsed);
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

  setPickedModule(moduleId: string | null) {
    set({ pickedModuleId: moduleId });
    offlineStorage.setPickedModule(moduleId);
  },

  setModuleOrder(moduleIds: string[]) {
    set({ moduleOrderIds: moduleIds });
    offlineStorage.setModuleOrder(moduleIds);
  },

  removeModuleReferences(moduleId: string) {
    const pinnedModuleIds = get().pinnedModuleIds.filter((id) => id !== moduleId);
    const moduleOrderIds = get().moduleOrderIds.filter((id) => id !== moduleId);
    const pickedModuleId = get().pickedModuleId === moduleId ? null : get().pickedModuleId;
    set({ pinnedModuleIds, pickedModuleId, moduleOrderIds });
    offlineStorage.setPinned(pinnedModuleIds);
    offlineStorage.setPickedModule(pickedModuleId);
    offlineStorage.setModuleOrder(moduleOrderIds);
  },

  replaceModuleId(moduleId: string, nextModuleId: string) {
    const replace = (ids: string[]) =>
      Array.from(new Set(ids.map((id) => (id === moduleId ? nextModuleId : id))));
    const pinnedModuleIds = replace(get().pinnedModuleIds);
    const moduleOrderIds = replace(get().moduleOrderIds);
    const pickedModuleId = get().pickedModuleId === moduleId ? nextModuleId : get().pickedModuleId;
    set({ pinnedModuleIds, pickedModuleId, moduleOrderIds });
    offlineStorage.setPinned(pinnedModuleIds);
    offlineStorage.setPickedModule(pickedModuleId);
    offlineStorage.setModuleOrder(moduleOrderIds);
  },

  isPinned(moduleId: string) {
    return get().pinnedModuleIds.includes(moduleId);
  },
}));
