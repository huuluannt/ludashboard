import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { getCalendarAccount, listCalendarAccounts } from '../../_lib/calendarTokenStore.js';
import { CalendarAuthError, googleCalendarFetch } from '../../_lib/googleCalendar.js';
import { listCalendarsForAccount } from './calendars.js';
import { allowCors, getQuery, readJsonBody, requireMethod, sendJson } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;

  const user = await requireDashboardUser(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      await handleListEvents(req, res, user.id);
      return;
    }

    if (req.method === 'POST') {
      await handleCreateEvent(req, res, user.id);
      return;
    }

    if (req.method === 'PATCH') {
      await handleUpdateEvent(req, res, user.id);
      return;
    }

    await handleDeleteEvent(req, res, user.id);
  } catch (error) {
    if (error instanceof CalendarAuthError) {
      sendJson(res, error.status, { error: error.message, needsReconnect: true });
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Calendar events request failed.' });
  }
}

async function handleListEvents(req, res, ownerId) {
  const query = getQuery(req);
  const timeMin = query.get('timeMin');
  const timeMax = query.get('timeMax');
  const selectedAccountId = query.get('accountId') || 'all';

  if (!timeMin || !timeMax) {
    sendJson(res, 400, { error: 'timeMin and timeMax are required.' });
    return;
  }

  const publicAccounts = await listCalendarAccounts(ownerId);
  const accountIds =
    selectedAccountId === 'all'
      ? publicAccounts.map((account) => account.accountId)
      : [selectedAccountId];

  const events = [];
  const errors = [];

  for (const accountId of accountIds) {
    const account = await getCalendarAccount(ownerId, accountId);
    if (!account) continue;

    try {
      const calendars = await listCalendarsForAccount(ownerId, account);
      for (const calendar of calendars.filter((item) => item.selected !== false)) {
        const calendarEvents = await listEventsForCalendar(ownerId, account, calendar, timeMin, timeMax);
        events.push(...calendarEvents);
      }
    } catch (error) {
      errors.push({
        accountId,
        email: account.email,
        error: error instanceof Error ? error.message : 'Unable to load events.',
        needsReconnect: error instanceof CalendarAuthError,
      });
    }
  }

  events.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  sendJson(res, 200, { events, errors });
}

async function handleCreateEvent(req, res, ownerId) {
  const body = await readJsonBody(req);
  const accountId = String(body.accountId || '');
  const calendarId = String(body.calendarId || '');
  const title = String(body.title || '').trim();
  const date = String(body.date || '');
  const startTime = String(body.startTime || '');
  const endTime = String(body.endTime || '');
  const description = String(body.description || '').trim();
  const timeZone = String(body.timeZone || 'UTC');
  const allDay = Boolean(body.allDay);

  if (!accountId || !calendarId || !title || !date || (!allDay && (!startTime || !endTime))) {
    sendJson(res, 400, { error: 'title, date, start time, end time, account, and calendar are required.' });
    return;
  }

  const account = await getCalendarAccount(ownerId, accountId);
  if (!account) {
    sendJson(res, 404, { error: 'Calendar account was not found.' });
    return;
  }

  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('sendUpdates', 'none');
  const data = await googleCalendarFetch(ownerId, account, url.toString(), {
    method: 'POST',
    body: JSON.stringify(buildGoogleEventPayload({ title, description, date, startTime, endTime, allDay, timeZone })),
  });

  sendJson(res, 200, {
    event: normalizeGoogleEvent(data, account, { id: calendarId, summary: calendarId }),
  });
}

async function handleUpdateEvent(req, res, ownerId) {
  const body = await readJsonBody(req);
  const accountId = String(body.accountId || '');
  const calendarId = String(body.calendarId || '');
  const eventId = String(body.eventId || '');
  const title = String(body.title || '').trim();
  const date = String(body.date || '');
  const startTime = String(body.startTime || '');
  const endTime = String(body.endTime || '');
  const description = String(body.description || '').trim();
  const timeZone = String(body.timeZone || 'UTC');
  const allDay = Boolean(body.allDay);

  if (!accountId || !calendarId || !eventId || !title || !date || (!allDay && (!startTime || !endTime))) {
    sendJson(res, 400, { error: 'event, title, date, account, and calendar are required.' });
    return;
  }

  const account = await getCalendarAccount(ownerId, accountId);
  if (!account) {
    sendJson(res, 404, { error: 'Calendar account was not found.' });
    return;
  }

  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  url.searchParams.set('sendUpdates', 'none');
  const data = await googleCalendarFetch(ownerId, account, url.toString(), {
    method: 'PATCH',
    body: JSON.stringify(buildGoogleEventPayload({ title, description, date, startTime, endTime, allDay, timeZone })),
  });

  sendJson(res, 200, {
    event: normalizeGoogleEvent(data, account, { id: calendarId, summary: body.calendarSummary || calendarId, backgroundColor: body.color }),
  });
}

async function handleDeleteEvent(req, res, ownerId) {
  const query = getQuery(req);
  const body = req.headers['content-type']?.includes('application/json') ? await readJsonBody(req) : {};
  const accountId = String(query.get('accountId') || body.accountId || '');
  const calendarId = String(query.get('calendarId') || body.calendarId || '');
  const eventId = String(query.get('eventId') || body.eventId || '');

  if (!accountId || !calendarId || !eventId) {
    sendJson(res, 400, { error: 'accountId, calendarId, and eventId are required.' });
    return;
  }

  const account = await getCalendarAccount(ownerId, accountId);
  if (!account) {
    sendJson(res, 404, { error: 'Calendar account was not found.' });
    return;
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  await googleCalendarFetch(ownerId, account, url, { method: 'DELETE' });
  sendJson(res, 200, { ok: true });
}

async function listEventsForCalendar(ownerId, account, calendar, timeMin, timeMax) {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`);
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '2500');
  url.searchParams.set('showDeleted', 'false');

  const data = await googleCalendarFetch(ownerId, account, url.toString());
  return (data.items || []).map((event) => normalizeGoogleEvent(event, account, calendar));
}

function normalizeGoogleEvent(event, account, calendar) {
  const start = event.start?.dateTime || event.start?.date || '';
  const end = event.end?.dateTime || event.end?.date || '';
  return {
    id: event.id,
    calendarId: calendar.id,
    calendarSummary: calendar.summary,
    accountId: account.accountId,
    accountEmail: account.email,
    title: event.summary || '(No title)',
    description: event.description || '',
    start,
    end,
    allDay: Boolean(event.start?.date),
    htmlLink: event.htmlLink || '',
    color: calendar.backgroundColor || '#4361ee',
    sortKey: start || event.created || '',
  };
}

function normalizeTime(value) {
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '09:00';
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function buildGoogleEventPayload({ title, description, date, startTime, endTime, allDay, timeZone }) {
  if (allDay) {
    return {
      summary: title,
      description,
      visibility: 'private',
      start: { date },
      end: { date: addOneDayKey(date) },
    };
  }

  return {
    summary: title,
    description,
    visibility: 'private',
    start: {
      dateTime: `${date}T${normalizeTime(startTime)}:00`,
      timeZone,
    },
    end: {
      dateTime: `${date}T${normalizeTime(endTime)}:00`,
      timeZone,
    },
  };
}

function addOneDayKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dateKey;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
