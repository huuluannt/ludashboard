import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { GoogleWorkspaceAuthError, googleWorkspaceFetch } from '../../_lib/googleWorkspace.js';
import { allowCors, getQuery, requireMethod, sendJson } from '../../_lib/http.js';
import { resolveGoogleAccounts } from '../googleApp/resolveAccounts.js';

const APP_ID = 'keep';

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET'])) return;

  const user = await requireDashboardUser(req, res, 'LuKeep');
  if (!user) return;

  try {
    const query = getQuery(req);
    const accountId = String(query.get('accountId') || 'all');
    const search = String(query.get('q') || '').trim().toLowerCase();
    const pageSize = clampNumber(Number(query.get('pageSize') || 50), 10, 100);
    const accounts = await resolveGoogleAccounts(APP_ID, user.id, accountId);
    const notes = [];
    const errors = [];

    for (const account of accounts) {
      try {
        notes.push(...(await listNotesForAccount(user.id, account, pageSize)));
      } catch (error) {
        errors.push({
          accountId: account.accountId,
          email: account.email,
          error: error instanceof Error ? error.message : 'Unable to load Google Keep notes.',
          needsReconnect: error instanceof GoogleWorkspaceAuthError,
        });
      }
    }

    const activeNotes = notes.filter((note) => !note.trashed);
    const filtered = search
      ? activeNotes.filter((note) => `${note.title} ${note.text}`.toLowerCase().includes(search))
      : activeNotes;
    filtered.sort((a, b) => Date.parse(b.updateTime || '') - Date.parse(a.updateTime || ''));
    sendJson(res, 200, { notes: filtered, errors });
  } catch (error) {
    if (error instanceof GoogleWorkspaceAuthError) {
      sendJson(res, error.status, { error: error.message, needsReconnect: true });
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'LuKeep notes request failed.' });
  }
}

async function listNotesForAccount(ownerId, account, pageSize) {
  const url = new URL('https://keep.googleapis.com/v1/notes');
  url.searchParams.set('pageSize', String(pageSize));
  const data = await googleWorkspaceFetch(APP_ID, ownerId, account, url.toString());
  return (data.notes || []).map((note) => normalizeNote(note, account));
}

function normalizeNote(note, account) {
  return {
    name: note.name || '',
    title: note.title || '',
    text: extractNoteText(note),
    trashed: Boolean(note.trashed),
    createTime: note.createTime || '',
    updateTime: note.updateTime || '',
    accountId: account.accountId,
    accountEmail: account.email,
  };
}

function extractNoteText(note) {
  if (typeof note.body?.text?.text === 'string') return note.body.text.text;
  if (typeof note.body?.textContent === 'string') return note.body.textContent;
  if (Array.isArray(note.body?.list?.listItems)) {
    return note.body.list.listItems
      .map((item) => item.text?.text || item.textContent || '')
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
