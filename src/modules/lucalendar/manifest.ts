import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'lucalendar',
  title: 'LuCalendar',
  icon: 'calendar',
  version: '1.0.0',
  category: 'Calendar',
  description: 'Personal Google Calendar month view',
  offline: false,
  permissions: ['calendar', 'network'],
};

