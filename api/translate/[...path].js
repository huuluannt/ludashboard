import { dispatchApiRoute } from '../_lib/dispatch.js';
import translateHandler from '../_handlers/translate/translate.js';

const routes = {
  '/api/translate/translate': translateHandler,
};

export default async function handler(req, res) {
  await dispatchApiRoute(req, res, routes);
}
