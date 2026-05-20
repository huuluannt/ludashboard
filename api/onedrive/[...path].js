import { dispatchApiRoute } from '../_lib/dispatch.js';
import accountsHandler from '../_handlers/onedrive/accounts.js';
import callbackHandler from '../_handlers/onedrive/callback.js';
import connectHandler from '../_handlers/onedrive/connect.js';
import contentHandler from '../_handlers/onedrive/content.js';
import filesHandler from '../_handlers/onedrive/files.js';

const routes = {
  '/api/onedrive/accounts': accountsHandler,
  '/api/onedrive/callback': callbackHandler,
  '/api/onedrive/connect': connectHandler,
  '/api/onedrive/content': contentHandler,
  '/api/onedrive/files': filesHandler,
};

export default async function handler(req, res) {
  await dispatchApiRoute(req, res, routes);
}
