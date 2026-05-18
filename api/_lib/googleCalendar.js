import { updateCalendarAccount } from './calendarTokenStore.js';

export const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
export const CALENDAR_LIST_SCOPE = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';
export const GOOGLE_OAUTH_SCOPES = ['openid', 'email', CALENDAR_EVENTS_SCOPE, CALENDAR_LIST_SCOPE];

export function getGoogleCalendarEnv() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI || '',
  };
}

export function buildGoogleCalendarAuthUrl(state) {
  const { clientId, redirectUri } = getGoogleCalendarEnv();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_OAUTH_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'select_account consent');
  url.searchParams.set('include_granted_scopes', 'false');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCodeForTokens(code) {
  const { clientId, clientSecret, redirectUri } = getGoogleCalendarEnv();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || 'Failed to exchange Google OAuth code.');
  }

  return data;
}

export async function refreshCalendarAccessToken(ownerId, account) {
  const { clientId, clientSecret } = getGoogleCalendarEnv();
  if (!account.refreshToken) {
    await updateCalendarAccount(ownerId, account.accountId, { needsReconnect: true });
    throw new CalendarAuthError('Reconnect account', 401);
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    await updateCalendarAccount(ownerId, account.accountId, { needsReconnect: true });
    throw new CalendarAuthError('Reconnect account', 401);
  }

  const expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return updateCalendarAccount(ownerId, account.accountId, {
    accessToken: data.access_token,
    expiresAt,
    needsReconnect: false,
  });
}

export async function getUsableAccessToken(ownerId, account) {
  if (!account) throw new CalendarAuthError('Calendar account was not found.', 404);
  if (account.needsReconnect) throw new CalendarAuthError('Reconnect account', 401);
  if (account.expiresAt && account.expiresAt - Date.now() > 60_000) {
    return account.accessToken;
  }
  const refreshed = await refreshCalendarAccessToken(ownerId, account);
  return refreshed.accessToken;
}

export async function googleCalendarFetch(ownerId, account, url, options = {}) {
  const accessToken = await getUsableAccessToken(ownerId, account);
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${accessToken}`,
  };
  if (options.body) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (response.status === 401 || response.status === 403) {
    await updateCalendarAccount(ownerId, account.accountId, { needsReconnect: true });
    throw new CalendarAuthError('Reconnect account', 401);
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Google Calendar request failed.');
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

export function assertCalendarEnv() {
  const { clientId, clientSecret, redirectUri } = getGoogleCalendarEnv();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI are required.');
  }
}

export class CalendarAuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}
