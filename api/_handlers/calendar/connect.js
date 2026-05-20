import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { createOAuthState } from '../../_lib/calendarTokenStore.js';
import { assertCalendarEnv, buildGoogleCalendarAuthUrl, GOOGLE_OAUTH_SCOPES } from '../../_lib/googleCalendar.js';
import { allowCors, requireMethod, sendJson } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (allowCors(req, res, ['POST', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['POST'])) return;

  const user = await requireDashboardUser(req, res);
  if (!user) return;

  try {
    assertCalendarEnv();
    const state = await createOAuthState(user.id);
    sendJson(res, 200, {
      authUrl: buildGoogleCalendarAuthUrl(state),
      scopes: GOOGLE_OAUTH_SCOPES,
    });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unable to start Google Calendar connection.' });
  }
}
