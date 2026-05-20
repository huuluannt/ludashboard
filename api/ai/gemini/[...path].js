import { dispatchApiRoute } from '../../_lib/dispatch.js';
import chatHandler from '../../_handlers/ai/gemini/chat.js';

const routes = {
  '/api/ai/gemini/chat': chatHandler,
};

export default async function handler(req, res) {
  await dispatchApiRoute(req, res, routes);
}
