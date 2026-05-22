import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { createGoogleOAuthState } from '../../_lib/googleAppTokenStore.js';
import {
  assertGoogleWorkspaceEnv,
  buildGoogleWorkspaceAuthUrl,
  GOOGLE_WORKSPACE_APPS,
} from '../../_lib/googleWorkspace.js';
import { allowCors, requireMethod, sendJson } from '../../_lib/http.js';

export function createGoogleConnectHandler(appId) {
  const appName = GOOGLE_WORKSPACE_APPS[appId]?.appName || 'Google module';

  return async function handler(req, res) {
    if (allowCors(req, res, ['POST', 'OPTIONS'])) return;
    if (!requireMethod(req, res, ['POST'])) return;

    const user = await requireDashboardUser(req, res, appName);
    if (!user) return;

    try {
      assertGoogleWorkspaceEnv(appId, req);
      const state = await createGoogleOAuthState(appId, user.id);
      sendJson(res, 200, {
        authUrl: buildGoogleWorkspaceAuthUrl(appId, req, state),
        scopes: GOOGLE_WORKSPACE_APPS[appId].scopes,
      });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : `Unable to start ${appName} connection.` });
    }
  };
}
