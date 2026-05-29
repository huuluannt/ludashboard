import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'unit-converter',
  title: 'Unit Converter',
  icon: 'ruler',
  version: '1.0.0',
  category: 'Utilities',
  description: 'Offline conversions for everyday units',
  offline: true,
  permissions: [],
};
