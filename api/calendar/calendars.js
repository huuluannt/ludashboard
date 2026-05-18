import { requireDashboardUser } from '../_lib/dashboardAuth.js';
import { getCalendarAccount } from '../_lib/calendarTokenStore.js';
import { CalendarAuthError, googleCalendarFetch } from '../_lib/googleCalendar.js';
import { allowCors, getQuery, requireMethod, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET'])) return;

  const user = await requireDashboardUser(req, res);
  if (!user) return;

  const accountId = String(getQuery(req).get('accountId') || '');
  if (!accountId) {
    sendJson(res, 400, { error: 'accountId is required.' });
    return;
  }

  try {
    const account = await getCalendarAccount(user.id, accountId);
    if (!account) {
      sendJson(res, 404, { error: 'Calendar account was not found.' });
      return;
    }

    const calendars = await listCalendarsForAccount(user.id, account);
    sendJson(res, 200, { calendars });
  } catch (error) {
    if (error instanceof CalendarAuthError) {
      sendJson(res, error.status, { error: error.message, needsReconnect: true });
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unable to list calendars.' });
  }
}

export async function listCalendarsForAccount(ownerId, account) {
  const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
  url.searchParams.set('maxResults', '250');
  url.searchParams.set('showDeleted', 'false');
  const data = await googleCalendarFetch(ownerId, account, url.toString());
  return (data.items || []).map((calendar) => ({
    id: calendar.id,
    summary: calendar.summary,
    primary: Boolean(calendar.primary),
    accessRole: calendar.accessRole,
    backgroundColor: calendar.backgroundColor,
    foregroundColor: calendar.foregroundColor,
    selected: calendar.selected !== false,
  }));
}

