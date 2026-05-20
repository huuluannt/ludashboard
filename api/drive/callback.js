import { consumeGoogleOAuthState, upsertGoogleAccount } from '../_lib/googleAppTokenStore.js';
import {
  assertGoogleWorkspaceEnv,
  decodeJwtPayload,
  exchangeGoogleWorkspaceCodeForTokens,
  sendGoogleCallbackHtml,
} from '../_lib/googleWorkspace.js';
import { getQuery } from '../_lib/http.js';

const APP_ID = 'drive';

export default async function handler(req, res) {
  const query = getQuery(req);
  const code = query.get('code');
  const state = query.get('state');
  const error = query.get('error');

  if (error) {
    sendGoogleCallbackHtml(res, APP_ID, false, `Google rejected the request: ${error}`);
    return;
  }

  if (!code || !state) {
    sendGoogleCallbackHtml(res, APP_ID, false, 'Missing OAuth code or state.');
    return;
  }

  try {
    assertGoogleWorkspaceEnv(APP_ID, req);
    const oauthState = await consumeGoogleOAuthState(APP_ID, state);
    if (!oauthState?.ownerId) {
      sendGoogleCallbackHtml(res, APP_ID, false, 'OAuth state expired. Please reconnect from LuDrive.');
      return;
    }

    const tokens = await exchangeGoogleWorkspaceCodeForTokens(APP_ID, req, code);
    const identity = decodeJwtPayload(tokens.id_token);
    const accountId = String(identity.sub || '');
    const email = String(identity.email || '');

    if (!accountId || !email) {
      sendGoogleCallbackHtml(res, APP_ID, false, 'Google did not return account identity. Reconnect and grant email access.');
      return;
    }

    await upsertGoogleAccount(APP_ID, oauthState.ownerId, {
      accountId,
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
      scope: tokens.scope || '',
      connectedAt: Date.now(),
      needsReconnect: false,
    });

    sendGoogleCallbackHtml(res, APP_ID, true, `Connected ${email} to LuDrive.`);
  } catch (callbackError) {
    res.statusCode = 500;
    sendGoogleCallbackHtml(
      res,
      APP_ID,
      false,
      callbackError instanceof Error ? callbackError.message : 'Unable to connect LuDrive.',
    );
  }
}
