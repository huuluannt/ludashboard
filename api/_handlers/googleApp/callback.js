import { consumeGoogleOAuthState, upsertGoogleAccount } from '../../_lib/googleAppTokenStore.js';
import {
  assertGoogleWorkspaceEnv,
  decodeJwtPayload,
  exchangeGoogleWorkspaceCodeForTokens,
  GOOGLE_WORKSPACE_APPS,
  sendGoogleCallbackHtml,
} from '../../_lib/googleWorkspace.js';
import { getQuery } from '../../_lib/http.js';

export function createGoogleCallbackHandler(appId) {
  const appName = GOOGLE_WORKSPACE_APPS[appId]?.appName || 'Google module';

  return async function handler(req, res) {
    const query = getQuery(req);
    const code = query.get('code');
    const state = query.get('state');
    const error = query.get('error');

    if (error) {
      sendGoogleCallbackHtml(res, appId, false, `Google rejected the request: ${error}`);
      return;
    }

    if (!code || !state) {
      sendGoogleCallbackHtml(res, appId, false, 'Missing OAuth code or state.');
      return;
    }

    try {
      assertGoogleWorkspaceEnv(appId, req);
      const oauthState = await consumeGoogleOAuthState(appId, state);
      if (!oauthState?.ownerId) {
        sendGoogleCallbackHtml(res, appId, false, `OAuth state expired. Please reconnect from ${appName}.`);
        return;
      }

      const tokens = await exchangeGoogleWorkspaceCodeForTokens(appId, req, code);
      const identity = decodeJwtPayload(tokens.id_token);
      const accountId = String(identity.sub || '');
      const email = String(identity.email || '');

      if (!accountId || !email) {
        sendGoogleCallbackHtml(res, appId, false, 'Google did not return account identity. Reconnect and grant email access.');
        return;
      }

      await upsertGoogleAccount(appId, oauthState.ownerId, {
        accountId,
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
        scope: tokens.scope || '',
        connectedAt: Date.now(),
        needsReconnect: false,
      });

      sendGoogleCallbackHtml(res, appId, true, `Connected ${email} to ${appName}.`);
    } catch (callbackError) {
      res.statusCode = 500;
      sendGoogleCallbackHtml(
        res,
        appId,
        false,
        callbackError instanceof Error ? callbackError.message : `Unable to connect ${appName}.`,
      );
    }
  };
}
