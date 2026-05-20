import { dispatchApiRoute } from '../_lib/dispatch.js';
import accountsHandler from '../_handlers/calendar/accounts.js';
import calendarsHandler from '../_handlers/calendar/calendars.js';
import callbackHandler from '../_handlers/calendar/callback.js';
import connectHandler from '../_handlers/calendar/connect.js';
import eventsHandler from '../_handlers/calendar/events.js';

const routes = {
  '/api/calendar/accounts': accountsHandler,
  '/api/calendar/calendars': calendarsHandler,
  '/api/calendar/callback': callbackHandler,
  '/api/calendar/connect': connectHandler,
  '/api/calendar/events': eventsHandler,
};

export default async function handler(req, res) {
  await dispatchApiRoute(req, res, routes);
}
