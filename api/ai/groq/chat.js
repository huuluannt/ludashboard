import {
  FREE_QUOTA_MESSAGE,
  allowCors,
  checkCooldown,
  getRequesterKey,
  getUpstreamErrorMessage,
  readJsonBody,
  requirePost,
  sanitizeMessages,
  sendJson,
} from '../../_lib/aiGuard.js';

const SYSTEM_PROMPT =
  'You are LuChat, a fast assistant inside LuDashboard. Answer concisely, clearly, and practically. Help the user with productivity, coding, writing, and dashboard tasks.';

const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const MAX_PROMPT_LENGTH = 12000;
const MAX_OUTPUT_TOKENS = 1024;
const MAX_MESSAGES = 20;
const COOLDOWN_MS = 2500;

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!requirePost(req, res)) return;

  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  if (!apiKey) {
    sendJson(res, 500, { error: 'GROQ_API_KEY is not configured.' });
    return;
  }

  const cooldownMs = checkCooldown(getRequesterKey(req, 'groq'), COOLDOWN_MS);
  if (cooldownMs > 0) {
    sendJson(res, 429, { error: `Please wait ${Math.ceil(cooldownMs / 1000)}s before sending another request.` });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const messages = sanitizeMessages(body.messages, {
      maxMessages: MAX_MESSAGES,
      maxPromptLength: MAX_PROMPT_LENGTH,
    });

    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.35,
        stream: false,
      }),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      sendJson(res, upstream.status, {
        error: getUpstreamErrorMessage(upstream.status, text),
      });
      return;
    }

    const data = JSON.parse(text);
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      sendJson(res, 502, { error: 'Groq returned an empty response.' });
      return;
    }

    sendJson(res, 200, {
      message: { role: 'assistant', content },
      model: data.model || model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request.';
    sendJson(res, message.includes('too long') || message.includes('empty') ? 400 : 500, {
      error: message || FREE_QUOTA_MESSAGE,
    });
  }
}
