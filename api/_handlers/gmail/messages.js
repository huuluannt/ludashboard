import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { getGoogleAccount, listGoogleAccounts } from '../../_lib/googleAppTokenStore.js';
import { GoogleWorkspaceAuthError, googleWorkspaceFetch } from '../../_lib/googleWorkspace.js';
import { allowCors, getQuery, readJsonBody, requireMethod, sendJson } from '../../_lib/http.js';

const APP_ID = 'gmail';
const METADATA_HEADERS = ['From', 'To', 'Subject', 'Date'];

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'PATCH', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET', 'PATCH'])) return;

  const user = await requireDashboardUser(req, res, 'LuGmail');
  if (!user) return;

  try {
    if (req.method === 'GET') {
      await handleGetMessages(req, res, user.id);
      return;
    }

    await handleMessageAction(req, res, user.id);
  } catch (error) {
    if (error instanceof GoogleWorkspaceAuthError) {
      sendJson(res, error.status, { error: error.message, needsReconnect: true });
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'LuGmail messages request failed.' });
  }
}

async function handleGetMessages(req, res, ownerId) {
  const query = getQuery(req);
  const messageId = String(query.get('messageId') || '');
  const accountId = String(query.get('accountId') || 'all');

  if (messageId) {
    if (!accountId || accountId === 'all') {
      sendJson(res, 400, { error: 'accountId is required when loading one Gmail message.' });
      return;
    }
    const account = await getGoogleAccount(APP_ID, ownerId, accountId);
    if (!account) {
      sendJson(res, 404, { error: 'LuGmail account was not found.' });
      return;
    }
    const message = await fetchMessageDetail(ownerId, account, messageId);
    sendJson(res, 200, { message });
    return;
  }

  const requestedAccounts = await resolveAccounts(ownerId, accountId);
  const q = String(query.get('q') || '').trim();
  const labelId = String(query.get('labelId') || 'INBOX');
  const maxResults = clampNumber(Number(query.get('maxResults') || 15), 5, 30);
  const messages = [];
  const errors = [];

  for (const account of requestedAccounts) {
    try {
      const accountMessages = await listMessagesForAccount(ownerId, account, { q, labelId, maxResults });
      messages.push(...accountMessages);
    } catch (error) {
      errors.push({
        accountId: account.accountId,
        email: account.email,
        error: error instanceof Error ? error.message : 'Unable to load Gmail messages.',
        needsReconnect: error instanceof GoogleWorkspaceAuthError,
      });
    }
  }

  messages.sort((a, b) => Number(b.internalDate || 0) - Number(a.internalDate || 0));
  sendJson(res, 200, { messages, errors });
}

async function handleMessageAction(req, res, ownerId) {
  const body = await readJsonBody(req);
  const accountId = String(body.accountId || '');
  const messageId = String(body.messageId || '');
  const action = String(body.action || '');

  if (!accountId || !messageId || !action) {
    sendJson(res, 400, { error: 'accountId, messageId, and action are required.' });
    return;
  }

  const account = await getGoogleAccount(APP_ID, ownerId, accountId);
  if (!account) {
    sendJson(res, 404, { error: 'LuGmail account was not found.' });
    return;
  }

  const modifyBody = getModifyBody(action);
  if (!modifyBody) {
    sendJson(res, 400, { error: 'Unsupported Gmail action.' });
    return;
  }

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`;
  const data = await googleWorkspaceFetch(APP_ID, ownerId, account, url, {
    method: 'POST',
    body: JSON.stringify(modifyBody),
  });

  sendJson(res, 200, { message: normalizeMessage(data, account), ok: true });
}

async function resolveAccounts(ownerId, accountId) {
  const publicAccounts = await listGoogleAccounts(APP_ID, ownerId);
  const accountIds = accountId === 'all' ? publicAccounts.map((account) => account.accountId) : [accountId];
  const accounts = await Promise.all(accountIds.map((id) => getGoogleAccount(APP_ID, ownerId, id)));
  return accounts.filter(Boolean);
}

async function listMessagesForAccount(ownerId, account, { q, labelId, maxResults }) {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('maxResults', String(maxResults));
  if (labelId && labelId !== 'all') url.searchParams.append('labelIds', labelId);
  if (q) url.searchParams.set('q', q);

  const data = await googleWorkspaceFetch(APP_ID, ownerId, account, url.toString());
  const messageRefs = data.messages || [];
  const messages = await Promise.all(
    messageRefs.map((message) => fetchMessageMetadata(ownerId, account, message.id)),
  );
  return messages.filter(Boolean);
}

async function fetchMessageMetadata(ownerId, account, messageId) {
  const url = buildMessageUrl(messageId, 'metadata');
  for (const header of METADATA_HEADERS) url.searchParams.append('metadataHeaders', header);
  const message = await googleWorkspaceFetch(APP_ID, ownerId, account, url.toString());
  return normalizeMessage(message, account);
}

async function fetchMessageDetail(ownerId, account, messageId) {
  const url = buildMessageUrl(messageId, 'full');
  const message = await googleWorkspaceFetch(APP_ID, ownerId, account, url.toString());
  return normalizeMessage(message, account, { includeBody: true });
}

function buildMessageUrl(messageId, format) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`);
  url.searchParams.set('format', format);
  return url;
}

function normalizeMessage(message, account, options = {}) {
  const headers = parseHeaders(message.payload?.headers || []);
  const labelIds = Array.isArray(message.labelIds) ? message.labelIds : [];
  return {
    id: message.id,
    threadId: message.threadId,
    accountId: account.accountId,
    accountEmail: account.email,
    subject: headers.subject || '(No subject)',
    from: headers.from || '',
    to: headers.to || '',
    date: headers.date || '',
    internalDate: message.internalDate || '',
    snippet: message.snippet || '',
    labelIds,
    unread: labelIds.includes('UNREAD'),
    starred: labelIds.includes('STARRED'),
    bodyText: options.includeBody ? extractBodyText(message.payload) : '',
  };
}

function parseHeaders(headers) {
  return headers.reduce((result, header) => {
    const name = String(header.name || '').toLowerCase();
    if (name) result[name] = String(header.value || '');
    return result;
  }, {});
}

function extractBodyText(payload) {
  const plain = findBodyPart(payload, 'text/plain');
  if (plain) return decodeMessageBody(plain);
  const html = findBodyPart(payload, 'text/html');
  if (!html) return '';
  return stripHtml(decodeMessageBody(html));
}

function findBodyPart(part, mimeType) {
  if (!part) return '';
  if (part.mimeType === mimeType && part.body?.data) return part.body.data;
  for (const child of part.parts || []) {
    const found = findBodyPart(child, mimeType);
    if (found) return found;
  }
  return '';
}

function decodeMessageBody(value) {
  try {
    return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function stripHtml(value) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function getModifyBody(action) {
  if (action === 'archive') return { removeLabelIds: ['INBOX'] };
  if (action === 'markRead') return { removeLabelIds: ['UNREAD'] };
  if (action === 'markUnread') return { addLabelIds: ['UNREAD'] };
  if (action === 'star') return { addLabelIds: ['STARRED'] };
  if (action === 'unstar') return { removeLabelIds: ['STARRED'] };
  return null;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
