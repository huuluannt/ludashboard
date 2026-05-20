import { requireDashboardUser } from '../_lib/dashboardAuth.js';
import { createGoogleOAuthState } from '../_lib/googleAppTokenStore.js';
import {
  assertGoogleWorkspaceEnv,
  buildGoogleWorkspaceAuthUrl,
  GOOGLE_WORKSPACE_APPS,
} from '../_lib/googleWorkspace.js';
import { allowCors, requireMethod, sendJson } from '../_lib/http.js';

const APP_ID = 'drive';

export default async function handler(req, res) {
  if (allowCors(req, res, ['POST', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['POST'])) return;

  const user = await requireDashboardUser(req, res, 'LuDrive');
  if (!user) return;

  try {
    assertGoogleWorkspaceEnv(APP_ID, req);
    const state = await createGoogleOAuthState(APP_ID, user.id);
    sendJson(res, 200, {
      authUrl: buildGoogleWorkspaceAuthUrl(APP_ID, req, state),
      scopes: GOOGLE_WORKSPACE_APPS[APP_ID].scopes,
    });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unable to start LuDrive connection.' });
  }
}
