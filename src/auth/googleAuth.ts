/**
 * Google OAuth configuration.
 *
 * Replace GOOGLE_CLIENT_ID with your actual client ID from
 * the Google Cloud Console → APIs & Services → Credentials.
 *
 * For local development you can leave this as-is; the login
 * button will show a demo/mock flow.
 */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export async function fetchGoogleUserInfo(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Google user info');
  const data = await res.json();
  return {
    id: data.sub || data.email, // Use email as fallback
    name: data.name,
    email: data.email,
    picture: data.picture,
  };
}
