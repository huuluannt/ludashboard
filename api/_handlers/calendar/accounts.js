import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { listCalendarAccounts, removeCalendarAccount } from '../../_lib/calendarTokenStore.js';
import { allowCors, getQuery, readJsonBody, requireMethod, sendJson } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'DELETE', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET', 'DELETE'])) return;

  const user = await requireDashboardUser(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      sendJson(res, 200, { accounts: await listCalendarAccounts(user.id) });
      return;
    }

    const query = getQuery(req);
    const body = await readJsonBody(req);
    const accountId = String(query.get('accountId') || body.accountId || '');
    if (!accountId) {
      sendJson(res, 400, { error: 'accountId is required.' });
      return;
    }

    await removeCalendarAccount(user.id, accountId);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Calendar account request failed.' });
  }
}

