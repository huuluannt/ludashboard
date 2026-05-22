import { dispatchApiRoute } from '../_lib/dispatch.js';
import { createGoogleAccountsHandler } from '../_handlers/googleApp/accounts.js';
import { createGoogleCallbackHandler } from '../_handlers/googleApp/callback.js';
import { createGoogleConnectHandler } from '../_handlers/googleApp/connect.js';
import mediaHandler from '../_handlers/photos/media.js';

const routes = {
  '/api/photos/accounts': createGoogleAccountsHandler('photos'),
  '/api/photos/callback': createGoogleCallbackHandler('photos'),
  '/api/photos/connect': createGoogleConnectHandler('photos'),
  '/api/photos/media': mediaHandler,
};

export default async function handler(req, res) {
  await dispatchApiRoute(req, res, routes);
}
