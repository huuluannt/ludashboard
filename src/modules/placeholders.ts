/**
 * Placeholder module manifests for future modules.
 *
 * These appear as cards in the sidebar but show a "Coming Soon"
 * state when opened. Each can be replaced by a real package later.
 */
import type { ModuleManifest } from './moduleTypes';

export const placeholderManifests: ModuleManifest[] = [
  {
    id: 'pdf-tools',
    title: 'PDF Tools',
    icon: 'file-text',
    version: '0.0.0',
    category: 'Productivity',
    description: 'Merge, split, and edit PDF files',
    offline: false,
    permissions: [],
  },
  {
    id: 'unit-converter',
    title: 'Unit Converter',
    icon: 'ruler',
    version: '0.0.0',
    category: 'Utilities',
    description: 'Convert between units of measurement',
    offline: true,
    permissions: [],
  },
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
  {
    id: 'world-clock',
    title: 'World Clock',
    icon: 'globe',
    version: '0.0.0',
    category: 'Utilities',
    description: 'Track time across timezones',
    offline: true,
    permissions: [],
  },
];
