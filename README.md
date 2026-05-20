# LuDashboard

## LuCalendar Google Calendar Setup

LuCalendar is a native module that connects Google Calendar accounts independently from the main LuDashboard login. LuDashboard login only protects the calendar API routes; Google Calendar accounts are connected inside LuCalendar.

1. Open Google Cloud Console and select your project.
2. Enable **Google Calendar API**.
3. Go to **APIs & Services > Credentials**.
4. Create an **OAuth Client ID** with application type **Web application**.
5. Add the redirect URI:

```text
http://localhost:5173/api/calendar/callback
```

6. Add the required Calendar scopes:

```text
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.calendarlist.readonly
```

LuCalendar also requests `openid email` so it can store the connected Google account id and email. It does not request Google Meet scopes.

7. Set server-side environment variables:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:5173/api/calendar/callback
```

LuCalendar requests offline access with `access_type=offline` and `prompt=select_account consent` so the server can refresh Google Calendar access tokens. Tokens are stored server-side only in Upstash Redis; LuCalendar does not write token data to the filesystem.

### LuCalendar on Vercel

Vercel Functions cannot persist files under the deployed app directory. LuCalendar uses Upstash Redis for server-side persistent token storage.

Recommended when Google Cloud blocks service account private keys: use Vercel KV or Upstash Redis. Add these variables in Vercel Project Settings > Environment Variables:

```env
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

If you create Redis directly in Upstash, these names are also supported:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Optional namespace:

```env
LUCALENDAR_REDIS_PREFIX=ludashboard:lucalendar
```

Recommended token encryption secret:

```env
LUCALENDAR_TOKEN_SECRET=
```

LuCalendar stores Google OAuth state and encrypted account tokens as server-side Redis values. The refresh tokens are never sent to the frontend. If `LUCALENDAR_TOKEN_SECRET` is omitted, LuCalendar derives encryption from the Upstash token, but a separate stable secret is preferred.

If the OAuth popup opens LuDashboard inside `/api/calendar/callback`, the browser is likely still controlled by an old service worker. Redeploy the latest build, then hard refresh once or clear site data so the updated service worker can stop intercepting `/api/*` callback navigations.

## LuGmail and LuDrive Google API Setup

LuGmail and LuDrive follow the same account model as LuCalendar: the main LuDashboard login protects the API routes, while each module connects Google accounts separately through OAuth. OAuth tokens are stored server-side only in Upstash Redis.

Enable the APIs you want in Google Cloud Console:

```text
Gmail API
Google Drive API
```

Add these redirect URIs to the same Web application OAuth Client ID:

```text
http://localhost:5173/api/gmail/callback
http://localhost:5173/api/drive/callback
```

For Vercel production, also add your deployed callback URLs:

```text
https://your-domain.vercel.app/api/gmail/callback
https://your-domain.vercel.app/api/drive/callback
```

Required scopes:

```text
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/drive.metadata.readonly
```

LuGmail uses `gmail.modify` so it can read messages and perform lightweight actions like archive, mark read/unread, and star/unstar. LuDrive uses `drive.metadata.readonly` so it can browse/search metadata and open files in Google Drive without editing or deleting Drive files. Both modules also request `openid email` so LuDashboard can identify connected accounts.

Environment variables:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_GMAIL_REDIRECT_URI=http://localhost:5173/api/gmail/callback
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:5173/api/drive/callback

KV_REST_API_URL=
KV_REST_API_TOKEN=
LUGMAIL_REDIS_PREFIX=ludashboard:lugmail
LUDRIVE_REDIS_PREFIX=ludashboard:ludrive
GOOGLE_TOKEN_SECRET=
```

On Vercel, set `GOOGLE_GMAIL_REDIRECT_URI` and `GOOGLE_DRIVE_REDIRECT_URI` to the production callback URLs. Gmail scopes can be marked sensitive by Google; for personal use before app verification, add your Gmail address under OAuth consent screen test users.

## LuOnedrive Microsoft Graph Setup

LuOnedrive is a native OneDrive browser that connects Microsoft accounts separately from the LuDashboard login. It uses Microsoft Graph with delegated read-only file access, then proxies preview/download requests through LuDashboard APIs so Microsoft access tokens are never exposed to the frontend.

Create or update an app registration in Microsoft Entra admin center:

1. Go to **Applications > App registrations**.
2. Create an app registration. For personal OneDrive, choose an account type that includes personal Microsoft accounts.
3. Add a **Web** redirect URI:

```text
http://localhost:5173/api/onedrive/callback
```

For Vercel production, also add:

```text
https://your-domain.vercel.app/api/onedrive/callback
```

Delegated Microsoft Graph permissions:

```text
User.Read
Files.Read
offline_access
openid
email
profile
```

Environment variables:

```env
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_ONEDRIVE_REDIRECT_URI=http://localhost:5173/api/onedrive/callback

KV_REST_API_URL=
KV_REST_API_TOKEN=
LUONEDRIVE_REDIS_PREFIX=ludashboard:luonedrive
MICROSOFT_TOKEN_SECRET=
```

LuOnedrive can list folders, search files, preview images/PDF/text/audio/video when Microsoft Graph can return the file content, download files, and open items in OneDrive. It does not request write/delete permissions in this first version.
