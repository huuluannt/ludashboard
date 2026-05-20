import { dispatchApiRoute } from '../_lib/dispatch.js';
import accountsHandler from '../_handlers/drive/accounts.js';
import callbackHandler from '../_handlers/drive/callback.js';
import connectHandler from '../_handlers/drive/connect.js';
import filesHandler from '../_handlers/drive/files.js';

const routes = {
  '/api/drive/accounts': accountsHandler,
  '/api/drive/callback': callbackHandler,
  '/api/drive/connect': connectHandler,
  '/api/drive/files': filesHandler,
};

export default async function handler(req, res) {
  await dispatchApiRoute(req, res, routes);
}
