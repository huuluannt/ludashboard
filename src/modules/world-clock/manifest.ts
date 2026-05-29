import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'world-clock',
  title: 'World Clock',
  icon: 'globe',
  version: '1.0.0',
  category: 'Utilities',
  description: 'Track and compare time across time zones',
  offline: true,
  permissions: [],
};
