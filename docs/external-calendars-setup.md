# Connecting external calendars

The Calendar page can show events from Apple (iCloud), Google, and Microsoft
Outlook calendars. External events are **read-only** and fetched live for the
date range you're currently viewing (they are not stored in the database).

## Apple (iCloud) — no server setup required

1. Go to https://appleid.apple.com → **Sign-In & Security → App-Specific
   Passwords**.
2. Create a password (e.g. "Sync Calendar").
3. In the app: **Calendar → Add external calendars → Add Apple Calendar**.
4. Enter your Apple ID, the app-specific password, and leave the server as
   `https://caldav.icloud.com`.

The app-specific password is stored on your account record and used only to read
your calendars over CalDAV.

## Google Calendar

Requires a one-time OAuth app registration.

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create
   or select a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web
   application**.
4. Add the authorized redirect URI:
   - `http://localhost:3000/api/calendar/google/callback` (local dev)
   - `https://<your-domain>/api/calendar/google/callback` (production)
5. Copy the client ID and secret into `.env.local`:
   ```
   GOOGLE_CALENDAR_CLIENT_ID=...
   GOOGLE_CALENDAR_CLIENT_SECRET=...
   ```
6. Restart `npm run dev`, then **Calendar → Add external calendars → Add Google
   Calendar**.

## Microsoft Outlook

Requires a one-time app registration.

1. Open the [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID →
   App registrations → New registration**.
2. Under **Redirect URI**, choose type **Web** and enter:
   - `http://localhost:3000/api/calendar/microsoft/callback` (local dev)
   - `https://<your-domain>/api/calendar/microsoft/callback` (production)
3. **Certificates & secrets → New client secret** → copy the secret **value**
   (not the ID).
4. **API permissions → Add a permission → Microsoft Graph → Delegated
   permissions** → add `Calendars.Read`, `offline_access`, and `User.Read`.
5. Copy the **Application (client) ID** and the secret into `.env.local`:
   ```
   MICROSOFT_CALENDAR_CLIENT_ID=...
   MICROSOFT_CALENDAR_CLIENT_SECRET=...
   ```
6. Restart `npm run dev`, then **Calendar → Add external calendars → Add
   Microsoft Outlook Calendar**.

## Refreshing and errors

- Events refetch automatically when you change view or navigate months, and via
  the **Refresh events** button in the external-calendars panel.
- If a provider fails (e.g. an expired login), only that provider is flagged in
  the panel; the others still load. Reconnecting usually resolves it.

## Known limitations (current version)

These are intentional scope limits for this version, not bugs:

- **No event paging.** Up to 250 events per provider are fetched for the visible
  range. A range with more events than that will be truncated.
- **Apple recurring events show once.** Recurring iCloud events appear at their
  original start only; per-occurrence expansion is not implemented. (Google and
  Microsoft are expanded server-side, so they are unaffected.)
- **Read-only.** External events cannot be edited, moved, or deleted from this
  app; manage them in their source calendar.
- **Primary calendar only.** Google/Microsoft read the primary calendar; Apple
  reads all calendars exposed by the account. Per-sub-calendar selection is not
  available.
- **Tokens are stored unencrypted at rest** (protected by per-user row-level
  security). Encryption at rest is a planned follow-up.
