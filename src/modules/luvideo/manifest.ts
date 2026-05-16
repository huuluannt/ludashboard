import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'luvideo',
  title: 'LuVideo',
  icon: 'play-circle',
  version: '1.0.0',
  category: 'Media',
  description: 'Minimal YouTube mini player with search and autoplay.',
  offline: false,
  permissions: ['youtube-api-key', 'youtube-iframe-player'],
};
