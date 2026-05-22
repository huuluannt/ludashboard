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
    const sessionId = String(query.get('sessionId') || '');
    const search = String(query.get('q') || '').trim().toLowerCase();
    const pageSize = clampNumber(Number(query.get('pageSize') || 50), 10, 100);
    if (!sessionId) {
      sendJson(res, 400, { error: 'Select photos with the Google Photos Picker first.' });
      return;
    }

    const accounts = await resolveGoogleAccounts(APP_ID, user.id, accountId === 'all' ? 'all' : accountId);
    const account = accounts[0];
    if (!account) {
      sendJson(res, 404, { error: 'Google Photos account was not found.', needsReconnect: true });
      return;
    }
    const mediaItems = [];
    const errors = [];

    try {
      mediaItems.push(...(await listMediaForAccount(user.id, account, sessionId, pageSize)));
    } catch (error) {
      errors.push({
        accountId: account.accountId,
        email: account.email,
        error: error instanceof Error ? error.message : 'Unable to load selected Google Photos.',
        needsReconnect: error instanceof GoogleWorkspaceAuthError,
      });
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

async function listMediaForAccount(ownerId, account, sessionId, pageSize) {
  const mediaItems = [];
  let pageToken = '';

  for (let page = 0; page < 5; page += 1) {
    const url = new URL('https://photospicker.googleapis.com/v1/mediaItems');
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('pageSize', String(pageSize));
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const data = await googleWorkspaceFetch(APP_ID, ownerId, account, url.toString());
    mediaItems.push(...(data.mediaItems || []).map((item) => normalizeMediaItem(item, account, sessionId)));
    pageToken = data.nextPageToken || '';
    if (!pageToken || mediaItems.length >= pageSize) break;
  }

  return mediaItems.slice(0, pageSize);
}

function normalizeMediaItem(item, account, sessionId) {
  const mediaFile = item.mediaFile || {};
  const metadata = mediaFile.mediaFileMetadata || item.mediaMetadata || {};
  return {
    id: item.id || '',
    filename: mediaFile.filename || item.filename || '',
    description: item.description || '',
    baseUrl: mediaFile.baseUrl || item.baseUrl || '',
    mimeType: mediaFile.mimeType || item.mimeType || '',
    productUrl: item.productUrl || '',
    creationTime: item.createTime || metadata.creationTime || '',
    width: metadata.width ? String(metadata.width) : '',
    height: metadata.height ? String(metadata.height) : '',
    type: item.type || '',
    sessionId,
    accountId: account.accountId,
    accountEmail: account.email,
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
