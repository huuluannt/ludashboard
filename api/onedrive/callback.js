import { consumeMicrosoftOAuthState, upsertMicrosoftAccount } from '../_lib/microsoftTokenStore.js';
import {
  assertMicrosoftEnv,
  decodeJwtPayload,
  exchangeMicrosoftCodeForTokens,
  fetchMicrosoftProfile,
  sendMicrosoftCallbackHtml,
} from '../_lib/microsoftGraph.js';
import { getQuery } from '../_lib/http.js';

export default async function handler(req, res) {
  const query = getQuery(req);
  const code = query.get('code');
  const state = query.get('state');
  const error = query.get('error');
  const errorDescription = query.get('error_description');

  if (error) {
    sendMicrosoftCallbackHtml(res, false, `Microsoft rejected the request: ${errorDescription || error}`);
    return;
  }

  if (!code || !state) {
    sendMicrosoftCallbackHtml(res, false, 'Missing OAuth code or state.');
    return;
  }

  try {
    assertMicrosoftEnv(req);
    const oauthState = await consumeMicrosoftOAuthState(state);
    if (!oauthState?.ownerId) {
      sendMicrosoftCallbackHtml(res, false, 'OAuth state expired. Please reconnect from LuOnedrive.');
      return;
    }

    const tokens = await exchangeMicrosoftCodeForTokens(req, code);
    const identity = decodeJwtPayload(tokens.id_token);
    const profile = await fetchMicrosoftProfile(tokens.access_token);
    const accountId = String(profile.id || identity.oid || identity.sub || '');
    const email = String(profile.mail || profile.userPrincipalName || identity.preferred_username || identity.email || '');
    const name = String(profile.displayName || identity.name || email || 'Microsoft account');

    if (!accountId || !email) {
      sendMicrosoftCallbackHtml(res, false, 'Microsoft did not return account identity. Reconnect and grant profile access.');
      return;
    }

    await upsertMicrosoftAccount(oauthState.ownerId, {
      accountId,
      email,
      name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
      scope: tokens.scope || '',
      connectedAt: Date.now(),
      needsReconnect: false,
    });

    sendMicrosoftCallbackHtml(res, true, `Connected ${email} to LuOnedrive.`);
  } catch (callbackError) {
    res.statusCode = 500;
    sendMicrosoftCallbackHtml(
      res,
      false,
      callbackError instanceof Error ? callbackError.message : 'Unable to connect LuOnedrive.',
    );
  }
}
