import { create } from 'zustand';
import { offlineStorage } from '@/storage/offlineStorage';
import type { ModuleManifest } from '@/modules/moduleTypes';

export interface ImportedModule extends ModuleManifest {
  url: string; // The online URL
}

export interface ModuleOverride extends Omit<ModuleManifest, 'version'> {
  version?: string;
}

interface ModuleStore {
  importedModules: ImportedModule[];
  moduleOverrides: ModuleOverride[];
  registryVersion: number;
  _hydrated: boolean;

  hydrate: () => Promise<void>;
  importModule: (mod: ImportedModule) => void;
  removeModule: (id: string) => void;
  setImportedModules: (mods: ImportedModule[]) => void;
  saveModuleOverride: (override: ModuleOverride) => void;
  setModuleOverrides: (overrides: ModuleOverride[]) => void;
  bumpRegistryVersion: () => void;
}

export const useModuleStore = create<ModuleStore>((set, get) => ({
  importedModules: [],
  moduleOverrides: [],
  registryVersion: 0,
  _hydrated: false,

  async hydrate() {
    const modules = await offlineStorage.getImportedModules() || [];
    const overrides = await offlineStorage.getModuleOverrides() || [];
    set({
      importedModules: modules,
      moduleOverrides: overrides,
      registryVersion: get().registryVersion + 1,
      _hydrated: true,
    });
  },

  importModule(mod: ImportedModule) {
    const next = [...get().importedModules.filter(m => m.id !== mod.id), mod];
    set({ importedModules: next, registryVersion: get().registryVersion + 1 });
    offlineStorage.setImportedModules(next);
  },

  removeModule(id: string) {
    const next = get().importedModules.filter(m => m.id !== id);
    set({ importedModules: next, registryVersion: get().registryVersion + 1 });
    offlineStorage.setImportedModules(next);
  },

  setImportedModules(mods: ImportedModule[]) {
    set({ importedModules: mods, registryVersion: get().registryVersion + 1 });
    offlineStorage.setImportedModules(mods);
  },

  saveModuleOverride(override: ModuleOverride) {
    const next = [...get().moduleOverrides.filter(m => m.id !== override.id), override];
    set({ moduleOverrides: next, registryVersion: get().registryVersion + 1 });
    offlineStorage.setModuleOverrides(next);
  },

  setModuleOverrides(overrides: ModuleOverride[]) {
    set({ moduleOverrides: overrides, registryVersion: get().registryVersion + 1 });
    offlineStorage.setModuleOverrides(overrides);
  },

  bumpRegistryVersion() {
    set({ registryVersion: get().registryVersion + 1 });
  },
}));
