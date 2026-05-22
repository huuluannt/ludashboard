import { dispatchApiRoute } from '../_lib/dispatch.js';
import { createGoogleAccountsHandler } from '../_handlers/googleApp/accounts.js';
import { createGoogleCallbackHandler } from '../_handlers/googleApp/callback.js';
import { createGoogleConnectHandler } from '../_handlers/googleApp/connect.js';
import notesHandler from '../_handlers/keep/notes.js';

const routes = {
  '/api/keep/accounts': createGoogleAccountsHandler('keep'),
  '/api/keep/callback': createGoogleCallbackHandler('keep'),
  '/api/keep/connect': createGoogleConnectHandler('keep'),
  '/api/keep/notes': notesHandler,
};

export default async function handler(req, res) {
  await dispatchApiRoute(req, res, routes);
}
