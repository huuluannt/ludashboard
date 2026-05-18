import { sendJson } from './http.js';

export async function requireDashboardUser(req, res) {
  const authHeader = String(req.headers.authorization || '');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    sendJson(res, 401, { error: 'Sign in to LuDashboard before using LuCalendar.' });
    return null;
  }

  const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!firebaseApiKey) {
    sendJson(res, 500, { error: 'VITE_FIREBASE_API_KEY is not configured on the server.' });
    return null;
  }

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: match[1] }),
    });

    const data = await response.json();
    const user = data?.users?.[0];
    if (!response.ok || !user?.localId) {
      sendJson(res, 401, { error: 'LuDashboard session is invalid. Please sign in again.' });
      return null;
    }

    return {
      id: user.localId,
      email: user.email || '',
    };
  } catch {
    sendJson(res, 401, { error: 'Unable to verify LuDashboard session.' });
    return null;
  }
}

