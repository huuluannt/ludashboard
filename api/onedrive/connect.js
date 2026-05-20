import { requireDashboardUser } from '../_lib/dashboardAuth.js';
import { createMicrosoftOAuthState } from '../_lib/microsoftTokenStore.js';
import { assertMicrosoftEnv, buildMicrosoftAuthUrl, MICROSOFT_ONEDRIVE_SCOPES } from '../_lib/microsoftGraph.js';
import { allowCors, requireMethod, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (allowCors(req, res, ['POST', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['POST'])) return;

  const user = await requireDashboardUser(req, res, 'LuOnedrive');
  if (!user) return;

  try {
    assertMicrosoftEnv(req);
    const state = await createMicrosoftOAuthState(user.id);
    sendJson(res, 200, {
      authUrl: buildMicrosoftAuthUrl(req, state),
      scopes: MICROSOFT_ONEDRIVE_SCOPES,
    });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unable to start LuOnedrive connection.' });
  }
}
