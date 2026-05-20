import { updateMicrosoftAccount } from './microsoftTokenStore.js';

export const MICROSOFT_ONEDRIVE_SCOPES = [
  'openid',
  'email',
  'profile',
  'offline_access',
  'User.Read',
  'Files.Read',
];

const MICROSOFT_AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';

export function getMicrosoftEnv(req) {
  return {
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    redirectUri: process.env.MICROSOFT_ONEDRIVE_REDIRECT_URI || `${getRequestOrigin(req)}/api/onedrive/callback`,
  };
}

export function assertMicrosoftEnv(req) {
  const { clientId, clientSecret, redirectUri } = getMicrosoftEnv(req);
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_ONEDRIVE_REDIRECT_URI are required for LuOnedrive.');
  }
}

export function buildMicrosoftAuthUrl(req, state) {
  const { clientId, redirectUri } = getMicrosoftEnv(req);
  const url = new URL(`${MICROSOFT_AUTHORITY}/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', MICROSOFT_ONEDRIVE_SCOPES.join(' '));
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeMicrosoftCodeForTokens(req, code) {
  const { clientId, clientSecret, redirectUri } = getMicrosoftEnv(req);
  const response = await fetch(`${MICROSOFT_AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: MICROSOFT_ONEDRIVE_SCOPES.join(' '),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || 'Failed to exchange Microsoft OAuth code.');
  }

  return data;
}

export async function refreshMicrosoftAccessToken(ownerId, account) {
  const { clientId, clientSecret } = getMicrosoftEnv();
  if (!account.refreshToken) {
    await updateMicrosoftAccount(ownerId, account.accountId, { needsReconnect: true });
    throw new MicrosoftGraphAuthError('Reconnect account', 401);
  }

  const response = await fetch(`${MICROSOFT_AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refreshToken,
      grant_type: 'refresh_token',
      scope: MICROSOFT_ONEDRIVE_SCOPES.join(' '),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    await updateMicrosoftAccount(ownerId, account.accountId, { needsReconnect: true });
    throw new MicrosoftGraphAuthError('Reconnect account', 401);
  }

  const expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return updateMicrosoftAccount(ownerId, account.accountId, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || account.refreshToken,
    expiresAt,
    needsReconnect: false,
  });
}

export async function getUsableMicrosoftAccessToken(ownerId, account) {
  if (!account) throw new MicrosoftGraphAuthError('Microsoft account was not found.', 404);
  if (account.needsReconnect) throw new MicrosoftGraphAuthError('Reconnect account', 401);
  if (account.expiresAt && account.expiresAt - Date.now() > 60_000) {
    return account.accessToken;
  }
  const refreshed = await refreshMicrosoftAccessToken(ownerId, account);
  return refreshed.accessToken;
}

export async function microsoftGraphFetch(ownerId, account, url, options = {}) {
  const accessToken = await getUsableMicrosoftAccessToken(ownerId, account);
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${accessToken}`,
  };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (response.status === 401 || response.status === 403) {
    await updateMicrosoftAccount(ownerId, account.accountId, { needsReconnect: true });
    throw new MicrosoftGraphAuthError('Reconnect account', 401);
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Microsoft Graph request failed.');
  }
  return data;
}

export async function microsoftGraphContentFetch(ownerId, account, url) {
  const accessToken = await getUsableMicrosoftAccessToken(ownerId, account);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    redirect: 'follow',
  });

  if (response.status === 401 || response.status === 403) {
    await updateMicrosoftAccount(ownerId, account.accountId, { needsReconnect: true });
    throw new MicrosoftGraphAuthError('Reconnect account', 401);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Unable to load OneDrive file content.');
  }
  return response;
}

export async function fetchMicrosoftProfile(accessToken) {
  const response = await fetch(`${GRAPH_ROOT}/me?$select=id,displayName,userPrincipalName,mail`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Unable to read Microsoft profile.');
  }
  return data;
}

export function oneDriveApiUrl(path) {
  return `${GRAPH_ROOT}${path}`;
}

export function decodeJwtPayload(jwt) {
  const [, payload] = String(jwt || '').split('.');
  if (!payload) return {};
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

export function sendMicrosoftCallbackHtml(res, success, message) {
  const status = success ? 'connected' : 'error';
  const safeMessage = escapeHtml(message);
  res.statusCode = success ? 200 : 400;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>LuOnedrive ${success ? 'Connected' : 'Connection Error'}</title>
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
      <h1>${success ? 'LuOnedrive connected' : 'Connection failed'}</h1>
      <p>${safeMessage}</p>
      <button type="button" onclick="window.close()">Close</button>
    </main>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'ludashboard-onedrive-${status}' }, window.location.origin);
      }
      if (${success ? 'true' : 'false'}) setTimeout(() => window.close(), 900);
    </script>
  </body>
</html>`);
}

export class MicrosoftGraphAuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

function getRequestOrigin(req) {
  if (!req?.headers) return '';
  const host = firstHeader(req.headers['x-forwarded-host']) || firstHeader(req.headers.host) || '';
  const proto = firstHeader(req.headers['x-forwarded-proto']) || (host.startsWith('localhost') ? 'http' : 'https');
  return host ? `${proto}://${host}` : '';
}

function firstHeader(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || '').split(',')[0].trim();
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
