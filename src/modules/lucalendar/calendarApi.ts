import { getAuth } from 'firebase/auth';
import { app } from '@/firebase/config';
import type { CalendarAccount, CalendarInfo, LuCalendarEvent } from './types';

interface ApiOptions extends RequestInit {
  query?: Record<string, string>;
}

export async function calendarApi<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const user = getAuth(app).currentUser;
  if (!user) throw new Error('Sign in to LuDashboard before using LuCalendar.');

  const token = await user.getIdToken();
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'LuCalendar request failed.');
  return data as T;
}

export async function startCalendarConnection() {
  return calendarApi<{ authUrl: string; scopes: string[] }>('/api/calendar/connect', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchCalendarAccounts() {
  return calendarApi<{ accounts: CalendarAccount[] }>('/api/calendar/accounts');
}

export async function removeCalendarAccount(accountId: string) {
  return calendarApi<{ ok: true }>('/api/calendar/accounts', {
    method: 'DELETE',
    query: { accountId },
  });
}

export async function fetchCalendars(accountId: string) {
  return calendarApi<{ calendars: CalendarInfo[] }>('/api/calendar/calendars', {
    query: { accountId },
  });
}

export async function fetchCalendarEvents(timeMin: string, timeMax: string, accountId: string) {
  return calendarApi<{ events: LuCalendarEvent[]; errors?: Array<{ email: string; error: string; needsReconnect?: boolean }> }>(
    '/api/calendar/events',
    {
      query: { timeMin, timeMax, accountId },
    },
  );
}

export async function createCalendarEvent(input: {
  accountId: string;
  calendarId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  allDay?: boolean;
}) {
  return calendarApi<{ event: LuCalendarEvent }>('/api/calendar/events', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }),
  });
}

export async function updateCalendarEvent(input: {
  accountId: string;
  calendarId: string;
  eventId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  allDay: boolean;
  calendarSummary?: string;
  color?: string;
}) {
  return calendarApi<{ event: LuCalendarEvent }>('/api/calendar/events', {
    method: 'PATCH',
    body: JSON.stringify({
      ...input,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }),
  });
}

export async function deleteCalendarEvent(event: LuCalendarEvent) {
  return calendarApi<{ ok: true }>('/api/calendar/events', {
    method: 'DELETE',
    query: {
      accountId: event.accountId,
      calendarId: event.calendarId,
      eventId: event.id,
    },
  });
}
