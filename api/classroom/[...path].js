import { dispatchApiRoute } from '../_lib/dispatch.js';
import { createGoogleAccountsHandler } from '../_handlers/googleApp/accounts.js';
import { createGoogleCallbackHandler } from '../_handlers/googleApp/callback.js';
import { createGoogleConnectHandler } from '../_handlers/googleApp/connect.js';
import coursesHandler from '../_handlers/classroom/courses.js';

const routes = {
  '/api/classroom/accounts': createGoogleAccountsHandler('classroom'),
  '/api/classroom/callback': createGoogleCallbackHandler('classroom'),
  '/api/classroom/connect': createGoogleConnectHandler('classroom'),
  '/api/classroom/courses': coursesHandler,
};

export default async function handler(req, res) {
  await dispatchApiRoute(req, res, routes);
}
