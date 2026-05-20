import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { getMicrosoftAccount } from '../../_lib/microsoftTokenStore.js';
import { MicrosoftGraphAuthError, microsoftGraphContentFetch, oneDriveApiUrl } from '../../_lib/microsoftGraph.js';
import { allowCors, getQuery, requireMethod, sendJson } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET'])) return;

  const user = await requireDashboardUser(req, res, 'LuOnedrive');
  if (!user) return;

  const query = getQuery(req);
  const accountId = String(query.get('accountId') || '');
  const itemId = String(query.get('itemId') || '');

  if (!accountId || !itemId) {
    sendJson(res, 400, { error: 'accountId and itemId are required.' });
    return;
  }

  try {
    const account = await getMicrosoftAccount(user.id, accountId);
    if (!account) {
      sendJson(res, 404, { error: 'LuOnedrive account was not found.' });
      return;
    }

    const response = await microsoftGraphContentFetch(
      user.id,
      account,
      oneDriveApiUrl(`/me/drive/items/${encodeURIComponent(itemId)}/content`),
    );
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    if (error instanceof MicrosoftGraphAuthError) {
      sendJson(res, error.status, { error: error.message, needsReconnect: true });
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unable to load OneDrive file content.' });
  }
}
