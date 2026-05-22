import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'luclassroom',
  title: 'LuClassroom',
  icon: 'notebook-pen',
  version: '1.0.0',
  category: 'Google',
  description: 'Native Google Classroom course browser',
  offline: false,
  permissions: ['classroom', 'network'],
};
