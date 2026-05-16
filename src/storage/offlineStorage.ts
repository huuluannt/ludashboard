import { get, set } from 'idb-keyval';

const STORAGE_KEYS = {
  TABS: 'lu:tabs',
  ACTIVE_TAB: 'lu:activeTab',
  PINNED: 'lu:pinned',
  MODULE_ORDER: 'lu:moduleOrder',
  SIDEBAR: 'lu:sidebar',
  USER: 'lu:user',
  IMPORTED_MODULES: 'lu:importedModules',
} as const;

/**
 * Typed helpers over idb-keyval for offline-first persistence.
 */
export const offlineStorage = {
  async getTabs() {
    return (await get(STORAGE_KEYS.TABS)) ?? [];
  },
  async setTabs(tabs: unknown) {
    await set(STORAGE_KEYS.TABS, tabs);
  },

  async getActiveTab() {
    return (await get(STORAGE_KEYS.ACTIVE_TAB)) ?? null;
  },
  async setActiveTab(id: string | null) {
    await set(STORAGE_KEYS.ACTIVE_TAB, id);
  },

  async getPinned(): Promise<string[]> {
    return (await get(STORAGE_KEYS.PINNED)) ?? [];
  },
  async setPinned(ids: string[]) {
    await set(STORAGE_KEYS.PINNED, ids);
  },

  async getModuleOrder(): Promise<string[]> {
    return (await get(STORAGE_KEYS.MODULE_ORDER)) ?? [];
  },
  async setModuleOrder(ids: string[]) {
    await set(STORAGE_KEYS.MODULE_ORDER, ids);
  },

  async getSidebarCollapsed(): Promise<boolean> {
    return (await get(STORAGE_KEYS.SIDEBAR)) ?? false;
  },
  async setSidebarCollapsed(collapsed: boolean) {
    await set(STORAGE_KEYS.SIDEBAR, collapsed);
  },

  async getUser() {
    return (await get(STORAGE_KEYS.USER)) ?? null;
  },
  async setUser(user: unknown) {
    await set(STORAGE_KEYS.USER, user);
  },

  async getImportedModules(): Promise<any[]> {
    return (await get(STORAGE_KEYS.IMPORTED_MODULES)) ?? [];
  },
  async setImportedModules(modules: any[]) {
    await set(STORAGE_KEYS.IMPORTED_MODULES, modules);
  },
};
