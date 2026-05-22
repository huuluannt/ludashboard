import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { allowCors, readJsonBody, requireMethod, sendJson } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (allowCors(req, res, ['POST', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['POST'])) return;

  const user = await requireDashboardUser(req, res, 'LuDich');
  if (!user) return;

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY || process.env.GOOGLE_CLOUD_API_KEY || '';
  if (!apiKey) {
    sendJson(res, 500, { error: 'GOOGLE_TRANSLATE_API_KEY is required for LuDich.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const text = String(body.q || '').trim();
    const source = String(body.source || '').trim();
    const target = String(body.target || 'vi').trim();

    if (!text) {
      sendJson(res, 400, { error: 'q is required.' });
      return;
    }
    if (!target) {
      sendJson(res, 400, { error: 'target is required.' });
      return;
    }

    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target,
        format: 'text',
        ...(source ? { source } : {}),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || 'Google Translate API request failed.');
    }

    const translation = data?.data?.translations?.[0] || {};
    sendJson(res, 200, {
      translatedText: decodeHtmlEntities(translation.translatedText || ''),
      detectedSourceLanguage: translation.detectedSourceLanguage || source || '',
    });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'LuDich translation request failed.' });
  }
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
