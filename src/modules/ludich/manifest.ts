import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'ludich',
  title: 'LuDich',
  icon: 'languages',
  version: '1.0.0',
  category: 'Google',
  description: 'Google Translate API text translation',
  offline: false,
  permissions: ['translate', 'network'],
};
