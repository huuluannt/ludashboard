import { dispatchApiRoute } from '../../_lib/dispatch.js';
import chatHandler from '../../_handlers/ai/groq/chat.js';
import translateHandler from '../../_handlers/ai/groq/translate.js';

const routes = {
  '/api/ai/groq/chat': chatHandler,
  '/api/ai/groq/translate': translateHandler,
};

export default async function handler(req, res) {
  await dispatchApiRoute(req, res, routes);
}
