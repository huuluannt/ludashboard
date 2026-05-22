import { dispatchApiRoute } from '../_lib/dispatch.js';
import { createGoogleAccountsHandler } from '../_handlers/googleApp/accounts.js';
import { createGoogleCallbackHandler } from '../_handlers/googleApp/callback.js';
import { createGoogleConnectHandler } from '../_handlers/googleApp/connect.js';
import peopleHandler from '../_handlers/contacts/people.js';

const routes = {
  '/api/contacts/accounts': createGoogleAccountsHandler('contacts'),
  '/api/contacts/callback': createGoogleCallbackHandler('contacts'),
  '/api/contacts/connect': createGoogleConnectHandler('contacts'),
  '/api/contacts/people': peopleHandler,
};

export default async function handler(req, res) {
  await dispatchApiRoute(req, res, routes);
}
