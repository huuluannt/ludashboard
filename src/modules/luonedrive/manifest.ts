import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'luonedrive',
  title: 'LuOnedrive',
  icon: 'cloud',
  version: '1.0.0',
  category: 'Microsoft',
  description: 'Native OneDrive browser and file preview',
  offline: false,
  permissions: ['files', 'network'],
};
