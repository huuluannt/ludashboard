import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'ludrive',
  title: 'LuDrive',
  icon: 'hard-drive',
  version: '1.0.0',
  category: 'Google',
  description: 'Native Google Drive browser and search',
  offline: false,
  permissions: ['drive', 'network'],
};
