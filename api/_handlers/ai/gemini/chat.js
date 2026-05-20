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
} from '../../../_lib/aiGuard.js';

const SYSTEM_PROMPT =
  'You are LuGemini, a research-oriented assistant inside LuDashboard. Provide accurate, structured, evidence-aware answers. If information is uncertain, say so clearly.';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_PROMPT_LENGTH = 50000;
const MAX_OUTPUT_TOKENS = 2048;
const MAX_MESSAGES = 24;
const COOLDOWN_MS = 4000;

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!requirePost(req, res)) return;

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  if (!apiKey) {
    sendJson(res, 500, { error: 'GEMINI_API_KEY is not configured.' });
    return;
  }

  const cooldownMs = checkCooldown(getRequesterKey(req, 'gemini'), COOLDOWN_MS);
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

    const contents = messages.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents,
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            temperature: 0.35,
          },
        }),
      },
    );

    const text = await upstream.text();
    if (!upstream.ok) {
      sendJson(res, upstream.status, {
        error: getUpstreamErrorMessage(upstream.status, text),
      });
      return;
    }

    const data = JSON.parse(text);
    const content = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    if (!content) {
      sendJson(res, 502, { error: 'Gemini returned an empty response.' });
      return;
    }

    sendJson(res, 200, {
      message: { role: 'assistant', content },
      model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request.';
    sendJson(res, message.includes('too long') || message.includes('empty') ? 400 : 500, {
      error: message || FREE_QUOTA_MESSAGE,
    });
  }
}
