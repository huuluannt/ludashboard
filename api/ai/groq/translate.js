import {
  FREE_QUOTA_MESSAGE,
  allowCors,
  checkCooldown,
  getRequesterKey,
  getUpstreamErrorMessage,
  readJsonBody,
  requirePost,
  sendJson,
} from '../../_lib/aiGuard.js';

const SYSTEM_PROMPT = [
  'You are a precise Vietnamese-English translator inside LuDashboard.',
  'Detect whether the user input is Vietnamese or English.',
  'If the input is Vietnamese, translate it into natural English.',
  'If the input is English, translate it into natural Vietnamese.',
  'Return only the translation. Do not add explanations, labels, quotes, or markdown.',
].join(' ');

const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const MAX_TEXT_LENGTH = 3000;
const MAX_OUTPUT_TOKENS = 700;
const COOLDOWN_MS = 1200;

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!requirePost(req, res)) return;

  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  if (!apiKey) {
    sendJson(res, 500, { error: 'GROQ_API_KEY is not configured.' });
    return;
  }

  const cooldownMs = checkCooldown(getRequesterKey(req, 'groq-translate'), COOLDOWN_MS);
  if (cooldownMs > 0) {
    sendJson(res, 429, { error: `Please wait ${Math.ceil(cooldownMs / 1000)}s before translating again.` });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const text = String(body.text || '').trim();

    if (!text) {
      sendJson(res, 400, { error: 'Text cannot be empty.' });
      return;
    }

    if (text.length > MAX_TEXT_LENGTH) {
      sendJson(res, 400, { error: `Text is too long. Maximum ${MAX_TEXT_LENGTH.toLocaleString()} characters.` });
      return;
    }

    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.1,
        stream: false,
      }),
    });

    const responseText = await upstream.text();
    if (!upstream.ok) {
      sendJson(res, upstream.status, {
        error: getUpstreamErrorMessage(upstream.status, responseText),
      });
      return;
    }

    const data = JSON.parse(responseText);
    const translation = data.choices?.[0]?.message?.content?.trim();
    if (!translation) {
      sendJson(res, 502, { error: 'Groq returned an empty translation.' });
      return;
    }

    sendJson(res, 200, {
      translation,
      model: data.model || model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request.';
    sendJson(res, 500, {
      error: message || FREE_QUOTA_MESSAGE,
    });
  }
}
