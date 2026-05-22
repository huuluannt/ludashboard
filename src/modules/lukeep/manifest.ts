import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'lukeep',
  title: 'LuKeep',
  icon: 'sticky-note',
  version: '1.0.0',
  category: 'Google',
  description: 'Google Keep API access status',
  offline: false,
  permissions: ['keep', 'network'],
};
