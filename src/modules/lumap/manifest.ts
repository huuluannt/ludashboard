import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'lumap',
  title: 'LuMap',
  icon: 'map-pin',
  version: '1.0.0',
  category: 'Maps',
  description: 'Save and revisit Google Maps places',
  offline: false,
  permissions: ['maps'],
};
