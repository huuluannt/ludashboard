import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'luchat',
  title: 'LuChat',
  icon: 'bot',
  version: '1.0.0',
  category: 'AI',
  description: 'Fast AI chat powered by Groq',
  offline: false,
  permissions: ['network'],
};
