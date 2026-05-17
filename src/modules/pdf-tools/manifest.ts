import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'pdf-tools',
  title: 'PDF Tools',
  icon: 'file-text',
  version: '1.0.0',
  category: 'Productivity',
  description: 'Merge, extract, and rotate local PDF files',
  offline: true,
  permissions: [],
};
