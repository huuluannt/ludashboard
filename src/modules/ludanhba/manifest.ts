import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'ludanhba',
  title: 'LuDanhba',
  icon: 'user',
  version: '1.0.0',
  category: 'Google',
  description: 'Native Google Contacts reader',
  offline: false,
  permissions: ['contacts', 'network'],
};
