import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'lugmail',
  title: 'LuGmail',
  icon: 'mail',
  version: '1.0.0',
  category: 'Google',
  description: 'Native Gmail inbox and message actions',
  offline: false,
  permissions: ['mail', 'network'],
};
