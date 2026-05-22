import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { GoogleWorkspaceAuthError, googleWorkspaceFetch } from '../../_lib/googleWorkspace.js';
import { allowCors, getQuery, readJsonBody, requireMethod, sendJson } from '../../_lib/http.js';
import { resolveGoogleAccounts } from '../googleApp/resolveAccounts.js';

const APP_ID = 'photos';

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'POST', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET', 'POST'])) return;

  const user = await requireDashboardUser(req, res, 'LuAnh');
  if (!user) return;

  try {
    if (req.method === 'POST') {
      await createSession(req, res, user.id);
      return;
    }
    await getSession(req, res, user.id);
  } catch (error) {
    if (error instanceof GoogleWorkspaceAuthError) {
      sendJson(res, error.status, { error: error.message, needsReconnect: true });
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'LuAnh Photos Picker session request failed.' });
  }
}

async function createSession(req, res, ownerId) {
  const body = await readJsonBody(req);
  const account = await getRequestedAccount(ownerId, body.accountId);
  const maxItemCount = clampNumber(Number(body.maxItemCount || 200), 1, 2000);
  const data = await googleWorkspaceFetch(APP_ID, ownerId, account, 'https://photospicker.googleapis.com/v1/sessions', {
    method: 'POST',
    body: JSON.stringify({
      pickingConfig: {
        maxItemCount: String(maxItemCount),
      },
    }),
  });

  sendJson(res, 200, {
    session: normalizeSession(data, account),
  });
}

async function getSession(req, res, ownerId) {
  const query = getQuery(req);
  const account = await getRequestedAccount(ownerId, String(query.get('accountId') || ''));
  const sessionId = String(query.get('sessionId') || '');
  if (!sessionId) {
    sendJson(res, 400, { error: 'A Photos Picker sessionId is required.' });
    return;
  }

  const data = await googleWorkspaceFetch(APP_ID, ownerId, account, `https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(sessionId)}`);
  sendJson(res, 200, {
    session: normalizeSession(data, account),
  });
}

async function getRequestedAccount(ownerId, accountId) {
  if (!accountId || accountId === 'all') {
    const accounts = await resolveGoogleAccounts(APP_ID, ownerId, 'all');
    if (!accounts.length) throw new GoogleWorkspaceAuthError('Connect Google Photos first.', 404);
    return accounts[0];
  }

  const [account] = await resolveGoogleAccounts(APP_ID, ownerId, accountId);
  if (!account) throw new GoogleWorkspaceAuthError('Google Photos account was not found.', 404);
  return account;
}

function normalizeSession(session, account) {
  return {
    id: session.id || '',
    pickerUri: session.pickerUri || '',
    expireTime: session.expireTime || '',
    mediaItemsSet: Boolean(session.mediaItemsSet),
    pollingConfig: session.pollingConfig || null,
    accountId: account.accountId,
    accountEmail: account.email,
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
