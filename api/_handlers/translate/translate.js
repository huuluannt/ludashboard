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
    const target = String(body.target || 'auto-pair').trim();

    if (!text) {
      sendJson(res, 400, { error: 'q is required.' });
      return;
    }
    if (!target) {
      sendJson(res, 400, { error: 'target is required.' });
      return;
    }

    const detectedLanguage = source || (target === 'auto-pair' ? await detectLanguage(apiKey, text) : '');
    const resolvedTarget = target === 'auto-pair' ? resolveAutoPairTarget(detectedLanguage) : target;

    if (!resolvedTarget) {
      sendJson(res, 400, { error: 'target is required.' });
      return;
    }

    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target: resolvedTarget,
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
      detectedSourceLanguage: translation.detectedSourceLanguage || detectedLanguage || source || '',
      targetLanguage: resolvedTarget,
    });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'LuDich translation request failed.' });
  }
}

async function detectLanguage(apiKey, text) {
  const response = await fetch(`https://translation.googleapis.com/language/translate/v2/detect?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Google Translate language detection failed.');
  }

  return String(data?.data?.detections?.[0]?.[0]?.language || '');
}

function resolveAutoPairTarget(detectedLanguage) {
  return String(detectedLanguage || '').toLowerCase().startsWith('vi') ? 'en' : 'vi';
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
