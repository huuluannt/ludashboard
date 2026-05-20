import { updateGoogleAccount } from './googleAppTokenStore.js';

export const GOOGLE_WORKSPACE_APPS = {
  gmail: {
    appName: 'LuGmail',
    callbackPath: '/api/gmail/callback',
    redirectEnv: 'GOOGLE_GMAIL_REDIRECT_URI',
    scopes: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.modify'],
  },
  drive: {
    appName: 'LuDrive',
    callbackPath: '/api/drive/callback',
    redirectEnv: 'GOOGLE_DRIVE_REDIRECT_URI',
    scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive.metadata.readonly'],
  },
};

export function getGoogleWorkspaceConfig(appId, req) {
  const app = getAppConfig(appId);
  return {
    ...app,
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env[app.redirectEnv] || `${getRequestOrigin(req)}${app.callbackPath}`,
  };
}

export function assertGoogleWorkspaceEnv(appId, req) {
  const config = getGoogleWorkspaceConfig(appId, req);
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error(`GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and ${config.redirectEnv} are required for ${config.appName}.`);
  }
}

export function buildGoogleWorkspaceAuthUrl(appId, req, state) {
  const config = getGoogleWorkspaceConfig(appId, req);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'select_account consent');
  url.searchParams.set('include_granted_scopes', 'false');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeGoogleWorkspaceCodeForTokens(appId, req, code) {
  const config = getGoogleWorkspaceConfig(appId, req);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || `Failed to exchange Google OAuth code for ${config.appName}.`);
  }

  return data;
}

export async function refreshGoogleWorkspaceAccessToken(appId, ownerId, account) {
  const config = getGoogleWorkspaceConfig(appId);
  if (!account.refreshToken) {
    await updateGoogleAccount(appId, ownerId, account.accountId, { needsReconnect: true });
    throw new GoogleWorkspaceAuthError('Reconnect account', 401);
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: account.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    await updateGoogleAccount(appId, ownerId, account.accountId, { needsReconnect: true });
    throw new GoogleWorkspaceAuthError('Reconnect account', 401);
  }

  const expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return updateGoogleAccount(appId, ownerId, account.accountId, {
    accessToken: data.access_token,
    expiresAt,
    needsReconnect: false,
  });
}

export async function getUsableGoogleWorkspaceAccessToken(appId, ownerId, account) {
  if (!account) throw new GoogleWorkspaceAuthError('Google account was not found.', 404);
  if (account.needsReconnect) throw new GoogleWorkspaceAuthError('Reconnect account', 401);
  if (account.expiresAt && account.expiresAt - Date.now() > 60_000) {
    return account.accessToken;
  }
  const refreshed = await refreshGoogleWorkspaceAccessToken(appId, ownerId, account);
  return refreshed.accessToken;
}

export async function googleWorkspaceFetch(appId, ownerId, account, url, options = {}) {
  const accessToken = await getUsableGoogleWorkspaceAccessToken(appId, ownerId, account);
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
    await updateGoogleAccount(appId, ownerId, account.accountId, { needsReconnect: true });
    throw new GoogleWorkspaceAuthError('Reconnect account', 401);
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || `${getAppConfig(appId).appName} Google API request failed.`);
  }
  return data;
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

export function sendGoogleCallbackHtml(res, appId, success, message) {
  const app = getAppConfig(appId);
  const status = success ? 'connected' : 'error';
  const safeMessage = escapeHtml(message);
  res.statusCode = success ? 200 : 400;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${app.appName} ${success ? 'Connected' : 'Connection Error'}</title>
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
      <h1>${success ? `${app.appName} connected` : 'Connection failed'}</h1>
      <p>${safeMessage}</p>
      <button type="button" onclick="window.close()">Close</button>
    </main>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'ludashboard-${appId}-${status}' }, window.location.origin);
      }
      if (${success ? 'true' : 'false'}) setTimeout(() => window.close(), 900);
    </script>
  </body>
</html>`);
}

export class GoogleWorkspaceAuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

function getAppConfig(appId) {
  const config = GOOGLE_WORKSPACE_APPS[appId];
  if (!config) throw new Error(`Unsupported Google Workspace app: ${appId}`);
  return config;
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
