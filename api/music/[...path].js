import { dispatchApiRoute } from '../_lib/dispatch.js';
import searchHandler from '../_handlers/music/search.js';

const routes = {
  '/api/music/search': searchHandler,
};

export default async function handler(req, res) {
  await dispatchApiRoute(req, res, routes);
}
