import { requireDashboardUser } from '../_lib/dashboardAuth.js';
import { getGoogleAccount, listGoogleAccounts } from '../_lib/googleAppTokenStore.js';
import { GoogleWorkspaceAuthError, googleWorkspaceFetch } from '../_lib/googleWorkspace.js';
import { allowCors, getQuery, requireMethod, sendJson } from '../_lib/http.js';

const APP_ID = 'drive';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET'])) return;

  const user = await requireDashboardUser(req, res, 'LuDrive');
  if (!user) return;

  try {
    const query = getQuery(req);
    const accountId = String(query.get('accountId') || 'all');
    const search = String(query.get('q') || '').trim();
    const parentId = String(query.get('parentId') || '');
    const pageSize = clampNumber(Number(query.get('pageSize') || 40), 10, 100);
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
          error: error instanceof Error ? error.message : 'Unable to load Drive files.',
          needsReconnect: error instanceof GoogleWorkspaceAuthError,
        });
      }
    }

    files.sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name));
    sendJson(res, 200, { files, errors });
  } catch (error) {
    if (error instanceof GoogleWorkspaceAuthError) {
      sendJson(res, error.status, { error: error.message, needsReconnect: true });
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'LuDrive files request failed.' });
  }
}

async function resolveAccounts(ownerId, accountId) {
  const publicAccounts = await listGoogleAccounts(APP_ID, ownerId);
  const accountIds = accountId === 'all' ? publicAccounts.map((account) => account.accountId) : [accountId];
  const accounts = await Promise.all(accountIds.map((id) => getGoogleAccount(APP_ID, ownerId, id)));
  return accounts.filter(Boolean);
}

async function listFilesForAccount(ownerId, account, { search, parentId, pageSize }) {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,parents,starred),nextPageToken');
  url.searchParams.set('orderBy', 'folder,name');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  url.searchParams.set('q', buildDriveQuery(search, parentId));

  const data = await googleWorkspaceFetch(APP_ID, ownerId, account, url.toString());
  return (data.files || []).map((file) => normalizeFile(file, account));
}

function buildDriveQuery(search, parentId) {
  const clauses = ['trashed = false'];
  if (search) {
    clauses.push(`name contains '${escapeDriveQuery(search)}'`);
  } else if (parentId) {
    clauses.push(`'${escapeDriveQuery(parentId)}' in parents`);
  } else {
    clauses.push(`'root' in parents`);
  }
  return clauses.join(' and ');
}

function normalizeFile(file, account) {
  const isFolder = file.mimeType === FOLDER_MIME_TYPE;
  return {
    id: file.id,
    name: file.name || '(Untitled)',
    mimeType: file.mimeType || '',
    isFolder,
    modifiedTime: file.modifiedTime || '',
    size: file.size ? Number(file.size) : null,
    webViewLink: file.webViewLink || '',
    iconLink: file.iconLink || '',
    parents: file.parents || [],
    starred: Boolean(file.starred),
    accountId: account.accountId,
    accountEmail: account.email,
  };
}

function escapeDriveQuery(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
