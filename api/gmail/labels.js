import { requireDashboardUser } from '../_lib/dashboardAuth.js';
import { getGoogleAccount } from '../_lib/googleAppTokenStore.js';
import { GoogleWorkspaceAuthError, googleWorkspaceFetch } from '../_lib/googleWorkspace.js';
import { allowCors, getQuery, requireMethod, sendJson } from '../_lib/http.js';

const APP_ID = 'gmail';

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET'])) return;

  const user = await requireDashboardUser(req, res, 'LuGmail');
  if (!user) return;

  const accountId = String(getQuery(req).get('accountId') || '');
  if (!accountId) {
    sendJson(res, 400, { error: 'accountId is required.' });
    return;
  }

  try {
    const account = await getGoogleAccount(APP_ID, user.id, accountId);
    if (!account) {
      sendJson(res, 404, { error: 'LuGmail account was not found.' });
      return;
    }

    const data = await googleWorkspaceFetch(APP_ID, user.id, account, 'https://gmail.googleapis.com/gmail/v1/users/me/labels');
    const labels = (data.labels || [])
      .map((label) => ({
        id: label.id,
        name: label.name,
        type: label.type,
        messageListVisibility: label.messageListVisibility,
        labelListVisibility: label.labelListVisibility,
      }))
      .sort((a, b) => systemLabelRank(a.id) - systemLabelRank(b.id) || a.name.localeCompare(b.name));

    sendJson(res, 200, { labels });
  } catch (error) {
    if (error instanceof GoogleWorkspaceAuthError) {
      sendJson(res, error.status, { error: error.message, needsReconnect: true });
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unable to list Gmail labels.' });
  }
}

function systemLabelRank(id) {
  return ['INBOX', 'UNREAD', 'STARRED', 'SENT', 'DRAFT', 'IMPORTANT', 'TRASH', 'SPAM'].indexOf(id) + 1 || 99;
}
