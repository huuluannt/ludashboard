import { consumeOAuthState, upsertCalendarAccount } from '../_lib/calendarTokenStore.js';
import { assertCalendarEnv, decodeJwtPayload, exchangeCodeForTokens } from '../_lib/googleCalendar.js';
import { getQuery } from '../_lib/http.js';

export default async function handler(req, res) {
  const query = getQuery(req);
  const code = query.get('code');
  const state = query.get('state');
  const error = query.get('error');

  if (error) {
    sendHtml(res, 400, renderCallbackHtml(false, `Google rejected the request: ${escapeHtml(error)}`));
    return;
  }

  if (!code || !state) {
    sendHtml(res, 400, renderCallbackHtml(false, 'Missing OAuth code or state.'));
    return;
  }

  try {
    assertCalendarEnv();
    const oauthState = await consumeOAuthState(state);
    if (!oauthState?.ownerId) {
      sendHtml(res, 400, renderCallbackHtml(false, 'OAuth state expired. Please reconnect from LuCalendar.'));
      return;
    }

    const tokens = await exchangeCodeForTokens(code);
    const identity = decodeJwtPayload(tokens.id_token);
    const accountId = String(identity.sub || '');
    const email = String(identity.email || '');

    if (!accountId || !email) {
      sendHtml(res, 400, renderCallbackHtml(false, 'Google did not return account identity. Reconnect and grant email access.'));
      return;
    }

    await upsertCalendarAccount(oauthState.ownerId, {
      accountId,
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
      scope: tokens.scope || '',
      connectedAt: Date.now(),
      needsReconnect: false,
    });

    sendHtml(res, 200, renderCallbackHtml(true, `Connected ${escapeHtml(email)} to LuCalendar.`));
  } catch (callbackError) {
    sendHtml(
      res,
      500,
      renderCallbackHtml(false, callbackError instanceof Error ? callbackError.message : 'Unable to connect Google Calendar.'),
    );
  }
}

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function renderCallbackHtml(success, message) {
  const status = success ? 'connected' : 'error';
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>LuCalendar ${success ? 'Connected' : 'Connection Error'}</title>
    <style>
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #f8f9fa; color: #1a1a2e; display: grid; min-height: 100vh; place-items: center; }
      main { width: min(420px, calc(100vw - 32px)); border: 1px solid #e9ecef; border-radius: 18px; background: white; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,.08); }
      h1 { margin: 0 0 8px; font-size: 18px; }
      p { margin: 0; color: #6c757d; font-size: 14px; line-height: 1.6; }
      button { margin-top: 18px; height: 36px; border: 0; border-radius: 10px; background: #1a1a2e; color: white; padding: 0 14px; font-weight: 700; cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1>${success ? 'Google Calendar connected' : 'Connection failed'}</h1>
      <p>${message}</p>
      <button type="button" onclick="window.close()">Close</button>
    </main>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'ludashboard-calendar-${status}' }, window.location.origin);
      }
      if (${success ? 'true' : 'false'}) setTimeout(() => window.close(), 900);
    </script>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]);
}

