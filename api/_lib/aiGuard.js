export const FREE_QUOTA_MESSAGE = 'Free quota/rate limit reached. Please try again later.';

const cooldownStore = globalThis.__luAiCooldownStore ?? new Map();
globalThis.__luAiCooldownStore = cooldownStore;

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return {};
  return JSON.parse(text);
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function allowCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  return false;
}

export function requirePost(req, res) {
  if (req.method === 'POST') return true;
  sendJson(res, 405, { error: 'Method not allowed.' });
  return false;
}

export function getRequesterKey(req, namespace) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const address = forwardedFor || req.socket?.remoteAddress || 'local';
  return `${namespace}:${address}`;
}

export function checkCooldown(key, cooldownMs) {
  const now = Date.now();
  const lastRequestAt = cooldownStore.get(key) || 0;
  const remainingMs = cooldownMs - (now - lastRequestAt);
  if (remainingMs > 0) return remainingMs;

  cooldownStore.set(key, now);
  return 0;
}

export function sanitizeMessages(value, options) {
  const messages = Array.isArray(value) ? value : [];
  const allowedRoles = new Set(['user', 'assistant']);
  const cleaned = messages
    .filter((message) => message && allowedRoles.has(message.role) && typeof message.content === 'string')
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-options.maxMessages);

  if (cleaned.length === 0) {
    throw new Error('Message cannot be empty.');
  }

  const totalChars = cleaned.reduce((sum, message) => sum + message.content.length, 0);
  if (totalChars > options.maxPromptLength) {
    throw new Error(`Prompt is too long. Maximum ${options.maxPromptLength.toLocaleString()} characters.`);
  }

  return cleaned;
}

export function isQuotaError(status, text) {
  const normalized = text.toLowerCase();
  return (
    status === 429 ||
    normalized.includes('rate limit') ||
    normalized.includes('quota') ||
    normalized.includes('too many requests') ||
    normalized.includes('resource_exhausted')
  );
}

export function getUpstreamErrorMessage(status, text) {
  if (isQuotaError(status, text)) return FREE_QUOTA_MESSAGE;
  if (status === 401 || status === 403) return 'API key is invalid or does not have access to this model.';
  if (status === 404) return 'Selected AI model was not found. Check the model environment variable.';
  return 'AI provider request failed. Please try again later.';
}
