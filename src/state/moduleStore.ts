import { create } from 'zustand';
import { offlineStorage } from '@/storage/offlineStorage';
import type { ModuleManifest } from '@/modules/moduleTypes';

export interface ImportedModule extends ModuleManifest {
  url: string; // The online URL
}

interface ModuleStore {
  importedModules: ImportedModule[];
  _hydrated: boolean;

  hydrate: () => Promise<void>;
  importModule: (mod: ImportedModule) => void;
  removeModule: (id: string) => void;
  setImportedModules: (mods: ImportedModule[]) => void;
}

export const useModuleStore = create<ModuleStore>((set, get) => ({
  importedModules: [],
  _hydrated: false,

  async hydrate() {
    const modules = await offlineStorage.getImportedModules() || [];
    set({ importedModules: modules, _hydrated: true });
  },

  importModule(mod: ImportedModule) {
    const next = [...get().importedModules.filter(m => m.id !== mod.id), mod];
    set({ importedModules: next });
    offlineStorage.setImportedModules(next);
  },

  removeModule(id: string) {
    const next = get().importedModules.filter(m => m.id !== id);
    set({ importedModules: next });
    offlineStorage.setImportedModules(next);
  },

  setImportedModules(mods: ImportedModule[]) {
    set({ importedModules: mods });
    offlineStorage.setImportedModules(mods);
  }
}));
