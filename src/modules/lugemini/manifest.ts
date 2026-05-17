import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'lugemini',
  title: 'LuGemini',
  icon: 'sparkles',
  version: '1.0.0',
  category: 'AI',
  description: 'Research assistant powered by Gemini',
  offline: false,
  permissions: ['network'],
};
