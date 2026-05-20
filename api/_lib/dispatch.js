import { sendJson } from './http.js';

export function getApiPath(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  return url.pathname.replace(/\/+$/, '') || '/';
}

export async function dispatchApiRoute(req, res, routes) {
  const handler = routes[getApiPath(req)];
  if (!handler) {
    sendJson(res, 404, { error: 'API route not found.' });
    return;
  }

  await handler(req, res);
}
