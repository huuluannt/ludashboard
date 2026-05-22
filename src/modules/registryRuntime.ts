import { createElement } from 'react';
import type { ImportedModule, ModuleOverride } from '@/state/moduleStore';
import { moduleRegistry } from './moduleRegistry';
import IframeModule from './IframeModule';

export function registerImportedModule(mod: ImportedModule) {
  moduleRegistry.upsert({
    manifest: mod,
    component: () => createElement(IframeModule, { url: mod.url }),
    source: mod.moduleType === 'panel' ? 'panel' : 'imported',
  });
}

export function applyModuleOverride(override: ModuleOverride) {
  const { id, ...manifestPatch } = override;
  moduleRegistry.updateManifest(id, manifestPatch);
}

export function syncRegistryWithModuleStore(
  importedModules: ImportedModule[],
  moduleOverrides: ModuleOverride[],
) {
  const importedIds = new Set(importedModules.map((mod) => mod.id));

  moduleRegistry.getAll().forEach((mod) => {
    if ((mod.source === 'imported' || mod.source === 'panel') && !importedIds.has(mod.manifest.id)) {
      moduleRegistry.unregister(mod.manifest.id);
    }
  });

  importedModules.forEach(registerImportedModule);
  moduleOverrides.forEach(applyModuleOverride);
}
