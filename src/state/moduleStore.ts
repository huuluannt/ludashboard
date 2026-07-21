import { create } from 'zustand';
import { offlineStorage } from '@/storage/offlineStorage';
import type { ModuleManifest } from '@/modules/moduleTypes';
import { getModuleIconFallback, normalizeModuleIcon } from '@/lib/moduleIcon';

export type ImportedModuleType = 'url' | 'panel';

export interface ImportedModule extends ModuleManifest {
  url: string; // The online URL
  moduleType?: ImportedModuleType;
  iconLocalOnly?: boolean;
}

export interface ModuleOverride extends Omit<ModuleManifest, 'version'> {
  version?: string;
  iconLocalOnly?: boolean;
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
    const storedModules = await offlineStorage.getImportedModules() || [];
    const storedOverrides = await offlineStorage.getModuleOverrides() || [];
    const modules = await Promise.all(storedModules.map(async (module: ImportedModule) => ({
      ...module,
      icon: await normalizeModuleIcon(module.icon, getModuleIconFallback(module.moduleType), { preserveSourceOnFailure: true }),
    })));
    const overrides = await Promise.all(storedOverrides.map(async (override: ModuleOverride) => ({
      ...override,
      icon: await normalizeModuleIcon(override.icon, 'package', { preserveSourceOnFailure: true }),
    })));

    if (JSON.stringify(modules) !== JSON.stringify(storedModules)) {
      await offlineStorage.setImportedModules(modules);
    }
    if (JSON.stringify(overrides) !== JSON.stringify(storedOverrides)) {
      await offlineStorage.setModuleOverrides(overrides);
    }
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
