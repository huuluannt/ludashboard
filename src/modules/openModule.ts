import type { ImportedModule } from '@/state/moduleStore';
import type { RegisteredModule, TabItem } from './moduleTypes';

export function createTabFromModule(mod: RegisteredModule): TabItem {
  return {
    moduleId: mod.manifest.id,
    title: mod.manifest.title,
    icon: mod.manifest.icon,
  };
}

export function getExternalModuleUrl(mod: RegisteredModule, importedModules: ImportedModule[]) {
  return importedModules.find((item) => item.id === mod.manifest.id)?.url;
}

export function getDashboardModuleUrl(moduleId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('module', moduleId);
  return url.toString();
}

export function openModuleFromShell(
  mod: RegisteredModule,
  importedModules: ImportedModule[],
  openTab: (tab: TabItem) => void,
) {
  if (mod.manifest.openInNewWindow) {
    const url = getExternalModuleUrl(mod, importedModules) ?? getDashboardModuleUrl(mod.manifest.id);
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  openTab(createTabFromModule(mod));
}
