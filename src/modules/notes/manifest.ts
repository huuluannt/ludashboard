import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'notes',
  title: 'Notes',
  icon: 'sticky-note',
  version: '1.0.0',
  category: 'Productivity',
  description: 'Quick notes with local persistence',
  offline: true,
  permissions: [],
};
