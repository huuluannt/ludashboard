export interface CalendarAccount {
  accountId: string;
  email: string;
  connectedAt: number;
  updatedAt?: number;
  expiresAt?: number;
  needsReconnect?: boolean;
}

export interface CalendarInfo {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
  backgroundColor?: string;
  foregroundColor?: string;
  selected?: boolean;
}

export interface LuCalendarEvent {
  id: string;
  calendarId: string;
  calendarSummary: string;
  accountId: string;
  accountEmail: string;
  title: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink?: string;
  color?: string;
  sortKey: string;
}

export interface VisibleDay {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
}

