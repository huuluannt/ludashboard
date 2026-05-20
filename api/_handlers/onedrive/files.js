import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { getMicrosoftAccount, listMicrosoftAccounts } from '../../_lib/microsoftTokenStore.js';
import { MicrosoftGraphAuthError, microsoftGraphFetch, oneDriveApiUrl } from '../../_lib/microsoftGraph.js';
import { allowCors, getQuery, requireMethod, sendJson } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET'])) return;

  const user = await requireDashboardUser(req, res, 'LuOnedrive');
  if (!user) return;

  try {
    const query = getQuery(req);
    const accountId = String(query.get('accountId') || 'all');
    const search = String(query.get('q') || '').trim();
    const parentId = String(query.get('parentId') || '');
    const pageSize = clampNumber(Number(query.get('pageSize') || 60), 10, 100);
    const accounts = await resolveAccounts(user.id, accountId);
    const files = [];
    const errors = [];

    for (const account of accounts) {
      try {
        files.push(...(await listFilesForAccount(user.id, account, { search, parentId, pageSize })));
      } catch (error) {
        errors.push({
          accountId: account.accountId,
          email: account.email,
          error: error instanceof Error ? error.message : 'Unable to load OneDrive files.',
          needsReconnect: error instanceof MicrosoftGraphAuthError,
        });
      }
    }

    files.sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name));
    sendJson(res, 200, { files, errors });
  } catch (error) {
    if (error instanceof MicrosoftGraphAuthError) {
      sendJson(res, error.status, { error: error.message, needsReconnect: true });
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'LuOnedrive files request failed.' });
  }
}

async function resolveAccounts(ownerId, accountId) {
  const publicAccounts = await listMicrosoftAccounts(ownerId);
  const accountIds = accountId === 'all' ? publicAccounts.map((account) => account.accountId) : [accountId];
  const accounts = await Promise.all(accountIds.map((id) => getMicrosoftAccount(ownerId, id)));
  return accounts.filter(Boolean);
}

async function listFilesForAccount(ownerId, account, { search, parentId, pageSize }) {
  const url = buildListUrl({ search, parentId, pageSize });
  const data = await microsoftGraphFetch(ownerId, account, url.toString());
  return (data.value || []).map((file) => normalizeFile(file, account));
}

function buildListUrl({ search, parentId, pageSize }) {
  const path = search
    ? `/me/drive/root/search(q='${escapeODataString(search)}')`
    : parentId
      ? `/me/drive/items/${encodeURIComponent(parentId)}/children`
      : '/me/drive/root/children';
  const url = new URL(oneDriveApiUrl(path));
  url.searchParams.set('$top', String(pageSize));
  url.searchParams.set('$select', 'id,name,size,file,folder,package,webUrl,lastModifiedDateTime,createdDateTime,parentReference,photo,image,video');
  if (!search) url.searchParams.set('$orderby', 'name');
  return url;
}

function normalizeFile(file, account) {
  const mimeType = file.file?.mimeType || '';
  const isFolder = Boolean(file.folder || file.package);
  return {
    id: file.id,
    name: file.name || '(Untitled)',
    size: typeof file.size === 'number' ? file.size : null,
    mimeType,
    isFolder,
    isImage: Boolean(file.image || file.photo || mimeType.startsWith('image/')),
    isVideo: Boolean(file.video || mimeType.startsWith('video/')),
    webUrl: file.webUrl || '',
    lastModifiedDateTime: file.lastModifiedDateTime || '',
    createdDateTime: file.createdDateTime || '',
    parentId: file.parentReference?.id || '',
    driveId: file.parentReference?.driveId || '',
    path: file.parentReference?.path || '',
    accountId: account.accountId,
    accountEmail: account.email,
  };
}

function escapeODataString(value) {
  return String(value).replace(/'/g, "''");
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
