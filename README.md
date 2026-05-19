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
