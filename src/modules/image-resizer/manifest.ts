import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'image-resizer',
  title: 'Image Resizer',
  icon: 'image',
  version: '1.0.0',
  category: 'Media',
  description: 'Resize and compress images locally',
  offline: true,
  permissions: [],
};
