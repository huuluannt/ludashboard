import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { listGoogleAccounts, removeGoogleAccount } from '../../_lib/googleAppTokenStore.js';
import { GOOGLE_WORKSPACE_APPS } from '../../_lib/googleWorkspace.js';
import { allowCors, getQuery, readJsonBody, requireMethod, sendJson } from '../../_lib/http.js';

export function createGoogleAccountsHandler(appId) {
  const appName = GOOGLE_WORKSPACE_APPS[appId]?.appName || 'Google module';

  return async function handler(req, res) {
    if (allowCors(req, res, ['GET', 'DELETE', 'OPTIONS'])) return;
    if (!requireMethod(req, res, ['GET', 'DELETE'])) return;

    const user = await requireDashboardUser(req, res, appName);
    if (!user) return;

    try {
      if (req.method === 'GET') {
        sendJson(res, 200, { accounts: await listGoogleAccounts(appId, user.id) });
        return;
      }

      const query = getQuery(req);
      const body = await readJsonBody(req);
      const accountId = String(query.get('accountId') || body.accountId || '');
      if (!accountId) {
        sendJson(res, 400, { error: 'accountId is required.' });
        return;
      }

      await removeGoogleAccount(appId, user.id, accountId);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : `${appName} account request failed.` });
    }
  };
}
