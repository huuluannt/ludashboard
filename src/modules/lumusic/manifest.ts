import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'lumusic',
  title: 'LuMusic',
  icon: 'music',
  version: '1.0.0',
  category: 'Media',
  description: 'Native music search, queue, playlists, and mini player',
  offline: false,
  permissions: ['youtube-api-key', 'youtube-iframe-player'],
};
