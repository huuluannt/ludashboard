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

LuCalendar requests offline access with `access_type=offline` and `prompt=select_account consent` so the server can refresh Google Calendar access tokens. Tokens are stored server-side only, by default in:

```text
.ludashboard/lucalendar-token-store.json
```

You can override the token store location with:

```env
LUCALENDAR_TOKEN_STORE_PATH=
```

Do not commit the token store file.

### LuCalendar on Vercel

Vercel Functions cannot persist files under the deployed app directory. For production, configure server-side persistent token storage.

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

LuCalendar stores Google OAuth state and account tokens as server-side Redis values. The tokens are never sent to the frontend.

Alternative: configure Firestore server-side token storage with a Firebase service account:

1. Open Firebase Console > Project settings > Service accounts.
2. Make sure Cloud Firestore is enabled for the Firebase project.
3. Generate a new private key.
4. In Vercel Project Settings > Environment Variables, add the service account JSON as one line:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

You can also split it into:

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

If you use `FIREBASE_PRIVATE_KEY`, keep the escaped newlines as `\n`. LuCalendar will store Google OAuth state and account tokens in Firestore under `lucalendarOAuthStates` and `lucalendarUsers`, and those tokens are never sent to the frontend.

For quick testing only, you can set:

```env
LUCALENDAR_ALLOW_TMP_TOKEN_STORE=true
```

That uses `/tmp` on Vercel, but it is temporary scratch storage and OAuth/account tokens may disappear between function invocations or deployments. Use Firestore for real LuCalendar use.
