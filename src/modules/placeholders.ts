/**
 * Placeholder module manifests for future modules.
 *
 * These appear as cards in the sidebar but show a "Coming Soon"
 * state when opened. Each can be replaced by a real package later.
 */
import type { ModuleManifest } from './moduleTypes';

export const placeholderManifests: ModuleManifest[] = [
  {
    id: 'cloud-storage',
    title: 'Cloud Storage',
    icon: 'cloud',
    version: '0.0.0',
    category: 'Storage',
    description: 'Access your cloud files',
    offline: false,
    permissions: ['network'],
  },
];
