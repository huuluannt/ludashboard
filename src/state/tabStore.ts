import { create } from 'zustand';
import type { TabItem } from '@/modules/moduleTypes';
import { offlineStorage } from '@/storage/offlineStorage';

interface TabStore {
  tabs: TabItem[];
  activeTabId: string | null;
  _hydrated: boolean;

  hydrate: () => Promise<void>;
  openTab: (tab: TabItem) => void;
  closeTab: (moduleId: string) => void;
  setActiveTab: (moduleId: string) => void;
  reorderTabs: (from: number, to: number) => void;
  updateTab: (moduleId: string, patch: Partial<Omit<TabItem, 'moduleId'>>) => void;
  replaceTab: (moduleId: string, tab: TabItem) => void;
}

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  _hydrated: false,

  async hydrate() {
    const tabs = (await offlineStorage.getTabs()) as TabItem[];
    const activeTabId = (await offlineStorage.getActiveTab()) as string | null;
    set({ tabs, activeTabId, _hydrated: true });
  },

  openTab(tab: TabItem) {
    const { tabs } = get();
    const exists = tabs.find((t) => t.moduleId === tab.moduleId);
    if (exists) {
      // Already open — just switch to it
      set({ activeTabId: tab.moduleId });
      offlineStorage.setActiveTab(tab.moduleId);
      return;
    }
    const next = [...tabs, tab];
    set({ tabs: next, activeTabId: tab.moduleId });
    offlineStorage.setTabs(next);
    offlineStorage.setActiveTab(tab.moduleId);
  },

  closeTab(moduleId: string) {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.moduleId === moduleId);
    if (idx === -1) return;
    const next = tabs.filter((t) => t.moduleId !== moduleId);
    let nextActive = activeTabId;
    if (activeTabId === moduleId) {
      // Pick adjacent tab
      if (next.length === 0) {
        nextActive = null;
      } else if (idx >= next.length) {
        nextActive = next[next.length - 1].moduleId;
      } else {
        nextActive = next[idx].moduleId;
      }
    }
    set({ tabs: next, activeTabId: nextActive });
    offlineStorage.setTabs(next);
    offlineStorage.setActiveTab(nextActive);
  },

  setActiveTab(moduleId: string) {
    set({ activeTabId: moduleId });
    offlineStorage.setActiveTab(moduleId);
  },

  reorderTabs(from: number, to: number) {
    const { tabs } = get();
    const next = [...tabs];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    set({ tabs: next });
    offlineStorage.setTabs(next);
  },

  updateTab(moduleId: string, patch: Partial<Omit<TabItem, 'moduleId'>>) {
    const { tabs } = get();
    if (!tabs.some((tab) => tab.moduleId === moduleId)) return;

    const next = tabs.map((tab) =>
      tab.moduleId === moduleId
        ? {
            ...tab,
            ...patch,
          }
        : tab,
    );
    set({ tabs: next });
    offlineStorage.setTabs(next);
  },

  replaceTab(moduleId: string, tab: TabItem) {
    const { tabs, activeTabId } = get();
    if (!tabs.some((item) => item.moduleId === moduleId)) return;

    const next = tabs
      .filter((item) => item.moduleId === moduleId || item.moduleId !== tab.moduleId)
      .map((item) => (item.moduleId === moduleId ? tab : item));
    const nextActive = activeTabId === moduleId ? tab.moduleId : activeTabId;

    set({ tabs: next, activeTabId: nextActive });
    offlineStorage.setTabs(next);
    offlineStorage.setActiveTab(nextActive);
  },
}));
