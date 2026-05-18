import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'cloud-storage',
  title: 'Cloud Storage',
  icon: 'cloud',
  version: '1.0.0',
  category: 'Storage',
  description: 'Save, search, sync, and reopen personal files',
  offline: false,
  permissions: ['network', 'storage'],
};
