import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'luanh',
  title: 'LuAnh',
  icon: 'images',
  version: '1.0.0',
  category: 'Google',
  description: 'Native Google Photos viewer',
  offline: false,
  permissions: ['photos', 'network'],
};
