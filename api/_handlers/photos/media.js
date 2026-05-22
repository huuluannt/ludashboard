import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { GoogleWorkspaceAuthError, googleWorkspaceFetch } from '../../_lib/googleWorkspace.js';
import { allowCors, getQuery, requireMethod, sendJson } from '../../_lib/http.js';
import { resolveGoogleAccounts } from '../googleApp/resolveAccounts.js';

const APP_ID = 'photos';

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET'])) return;

  const user = await requireDashboardUser(req, res, 'LuAnh');
  if (!user) return;

  try {
    const query = getQuery(req);
    const accountId = String(query.get('accountId') || 'all');
    const search = String(query.get('q') || '').trim().toLowerCase();
    const pageSize = clampNumber(Number(query.get('pageSize') || 50), 10, 100);
    const accounts = await resolveGoogleAccounts(APP_ID, user.id, accountId);
    const mediaItems = [];
    const errors = [];

    for (const account of accounts) {
      try {
        mediaItems.push(...(await listMediaForAccount(user.id, account, pageSize)));
      } catch (error) {
        errors.push({
          accountId: account.accountId,
          email: account.email,
          error: error instanceof Error ? error.message : 'Unable to load Google Photos.',
          needsReconnect: error instanceof GoogleWorkspaceAuthError,
        });
      }
    }

    const filtered = search
      ? mediaItems.filter((item) => `${item.filename} ${item.description} ${item.mimeType}`.toLowerCase().includes(search))
      : mediaItems;
    filtered.sort((a, b) => Date.parse(b.creationTime || '') - Date.parse(a.creationTime || ''));
    sendJson(res, 200, { mediaItems: filtered, errors });
  } catch (error) {
    if (error instanceof GoogleWorkspaceAuthError) {
      sendJson(res, error.status, { error: error.message, needsReconnect: true });
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'LuAnh media request failed.' });
  }
}

async function listMediaForAccount(ownerId, account, pageSize) {
  const url = new URL('https://photoslibrary.googleapis.com/v1/mediaItems');
  url.searchParams.set('pageSize', String(pageSize));
  const data = await googleWorkspaceFetch(APP_ID, ownerId, account, url.toString());
  return (data.mediaItems || []).map((item) => normalizeMediaItem(item, account));
}

function normalizeMediaItem(item, account) {
  const metadata = item.mediaMetadata || {};
  return {
    id: item.id || '',
    filename: item.filename || '',
    description: item.description || '',
    baseUrl: item.baseUrl || '',
    mimeType: item.mimeType || '',
    productUrl: item.productUrl || '',
    creationTime: metadata.creationTime || '',
    width: metadata.width || '',
    height: metadata.height || '',
    accountId: account.accountId,
    accountEmail: account.email,
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
