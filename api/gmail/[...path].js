import { dispatchApiRoute } from '../_lib/dispatch.js';
import accountsHandler from '../_handlers/gmail/accounts.js';
import callbackHandler from '../_handlers/gmail/callback.js';
import connectHandler from '../_handlers/gmail/connect.js';
import labelsHandler from '../_handlers/gmail/labels.js';
import messagesHandler from '../_handlers/gmail/messages.js';

const routes = {
  '/api/gmail/accounts': accountsHandler,
  '/api/gmail/callback': callbackHandler,
  '/api/gmail/connect': connectHandler,
  '/api/gmail/labels': labelsHandler,
  '/api/gmail/messages': messagesHandler,
};

export default async function handler(req, res) {
  await dispatchApiRoute(req, res, routes);
}
