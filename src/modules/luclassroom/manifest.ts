import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'luclassroom',
  title: 'LuClassroom',
  icon: 'notebook-pen',
  version: '1.0.0',
  category: 'Google',
  description: 'Google Classroom courses and posts',
  offline: false,
  permissions: ['classroom', 'network'],
};
