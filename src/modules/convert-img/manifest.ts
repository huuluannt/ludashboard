import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'convert-img',
  title: 'Convert IMG',
  icon: 'image',
  version: '1.0.0',
  category: 'Media',
  description: 'Convert local images to JPG, PNG, or ICO',
  offline: true,
  permissions: [],
};
