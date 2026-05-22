import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'lukeep',
  title: 'LuKeep',
  icon: 'sticky-note',
  version: '1.0.0',
  category: 'Google',
  description: 'Native Google Keep note reader',
  offline: false,
  permissions: ['keep', 'network'],
};
