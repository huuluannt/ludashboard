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
