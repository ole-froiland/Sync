# External Calendars: Fetch & Display Events — Design

**Date:** 2026-05-30
**Status:** Approved (design)
**Author:** brainstorming session

## Problem

The "Add external calendars" panel on the Calendar page does not work end-to-end.

Two distinct problems:

1. **Connect fails with a config error.** Clicking "Add Google Calendar" /
   "Add Microsoft Outlook Calendar" hits `/api/calendar/{provider}/connect`,
   which returns `503 { "error": "GOOGLE_CALENDAR_CLIENT_ID is not configured." }`
   (and the Microsoft equivalent) because the OAuth client env vars are unset.
2. **Connecting accomplishes nothing visible.** Even when a connection is saved
   (Apple works today; Google/Microsoft would once configured), external events
   are **never fetched or displayed**. The calendar page renders only local demo
   events from `localStorage` (`seedEvents` in
   `app/(app)/calendar/page.tsx`). There is no event-fetch layer at all.

## Goal

Connecting an external calendar (Apple, Google, Microsoft) results in that
account's real events appearing on the Calendar page, merged read-only with the
user's existing local events.

## What already exists (do not rebuild)

- DB table `public.calendar_connections` (migration
  `supabase/migrations/20260525_calendar_connections.sql`) with per-user RLS.
  Stores OAuth tokens (`access_token`, `refresh_token`, `expires_at`, `scope`)
  and CalDAV credentials (`caldav_server_url`, `caldav_username`,
  `caldav_app_password`).
- OAuth connect + callback routes for Google and Microsoft (store tokens).
- Apple CalDAV setup route `POST /api/calendar/apple/setup` (stores app password).
- Status route `GET /api/calendar/status`, disconnect route
  `DELETE /api/calendar/[provider]/disconnect`.
- UI panel in `app/(app)/calendar/page.tsx` with connect/disconnect buttons and
  the Apple credentials modal.

## Decisions (from brainstorming)

- **Scope:** Full sync — fetch and display real events, all three providers.
- **Sync model:** Fetch on page load (no new events table / no cache). The page
  requests events for the visible range on load, on period navigation, and via a
  "Refresh" button. Always fresh; simplest.
- **External events are read-only.** Visually distinct, not draggable/editable.
  Local events and the notepad drag feature stay exactly as today.
- **Apple ICS parsing:** add the `node-ical` dependency (well-tested) rather than
  hand-rolling an iCalendar parser.
- **Security (token encryption at rest):** out of scope for this change; noted
  as a follow-up.

## Architecture

### 1. Provider adapter layer — `lib/calendar/providers/`

A common interface so the API route is provider-agnostic.

```ts
// lib/calendar/providers/types.ts
export type ExternalEvent = {
  id: string            // stable per provider event
  title: string
  start: string         // ISO 8601
  end: string           // ISO 8601
  allDay: boolean
  provider: 'apple' | 'microsoft' | 'google'
  location?: string
}

export type CalendarConnectionRow = { /* row from calendar_connections */ }

export interface CalendarProviderAdapter {
  fetchEvents(
    connection: CalendarConnectionRow,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<ExternalEvent[]>
}
```

- `google.ts` — `GET https://www.googleapis.com/calendar/v3/calendars/primary/events`
  with `timeMin`, `timeMax`, `singleEvents=true`, `orderBy=startTime`. Maps items
  to `ExternalEvent`. Handles all-day (`start.date`) vs timed (`start.dateTime`).
- `microsoft.ts` — `GET https://graph.microsoft.com/v1.0/me/calendarView`
  with `startDateTime`/`endDateTime`. Maps `value[]` to `ExternalEvent`.
- `apple.ts` — CalDAV `REPORT` (`calendar-query`) against `caldav_server_url`
  with Basic auth (`caldav_username` + `caldav_app_password`), then parse the
  returned `.ics` bodies with `node-ical` into `ExternalEvent`.

Each adapter is independently unit-testable with mocked HTTP responses.

### 2. Token refresh (Google / Microsoft)

`lib/calendar/token.ts` exports `getValidAccessToken(connection): Promise<string>`:

- If `expires_at` is in the future (with a small skew buffer), return the stored
  `access_token`.
- Otherwise POST to the provider token endpoint with `grant_type=refresh_token`,
  update `access_token`/`expires_at` (and `refresh_token` if rotated) in
  `calendar_connections`, and return the new token.
- If refresh fails, throw — the API route marks that provider as errored.

Apple needs no token logic (Basic auth every request).

### 3. Events API — `GET /api/calendar/events?start=<ISO>&end=<ISO>`

- Authenticate the user; 401 if absent.
- Load the user's `calendar_connections`.
- For each connected provider, call its adapter via `getValidAccessToken` where
  relevant. Run providers independently; one failure does not block the others.
- Response shape:

```json
{
  "events": [ /* ExternalEvent[] merged across providers */ ],
  "providerErrors": [ { "provider": "google", "message": "..." } ]
}
```

- On a provider failure, also set that row's `status = 'error'` so the status
  panel reflects it.

### 4. Frontend integration — `app/(app)/calendar/page.tsx`

- Add `externalEvents` state and a fetch that calls `/api/calendar/events` for
  the current visible range (compute from view: month grid span / week / day,
  with a small buffer). Trigger on mount, on `viewDate`/`view` change, and on a
  new "Refresh" button in the external-calendars panel.
- Merge `externalEvents` into the existing render pipeline as read-only:
  - Distinct visual tone/badge per provider; no `draggable`, no click-to-edit.
  - Local events keep current create/drag/notepad behavior unchanged.
- Surface `providerErrors` inline using the existing `providerError` banner
  pattern; refresh provider status afterward so error state shows in the panel.

### 5. Setup the user must do (cannot be done in code)

Documented as a short step-by-step in this spec's appendix:

- **Google:** create OAuth client (Google Cloud Console), authorized redirect
  `<SITE_URL>/api/calendar/google/callback`, enable Calendar API → set
  `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET` in `.env.local`.
- **Microsoft:** register app (Azure / Entra ID), redirect
  `<SITE_URL>/api/calendar/microsoft/callback`, delegated permissions
  `Calendars.Read offline_access User.Read` → set
  `MICROSOFT_CALENDAR_CLIENT_ID` / `MICROSOFT_CALENDAR_CLIENT_SECRET`.
- **Apple:** generate an app-specific password at appleid.apple.com, enter it in
  the in-app modal. No registration.

`.env.example` already lists these keys with the correct callback URLs.

## Error handling

- Missing/expired token that cannot refresh → provider marked errored, others
  still returned; row `status='error'`; inline banner on the page.
- CalDAV auth failure (bad app password) → same pattern for Apple.
- Network/parse errors are caught per-provider and never crash the route.

## Testing

- Unit tests per adapter: feed a mocked provider response (Google JSON, Graph
  JSON, a sample `.ics` for Apple) and assert the mapped `ExternalEvent[]`,
  including all-day vs timed and timezone handling.
- Token refresh: test expired vs valid `expires_at` branching with a mocked
  token endpoint.
- Events route: connections with one failing provider returns the others plus a
  `providerErrors` entry.

## Out of scope (YAGNI)

- Two-way sync (creating/editing events back in the external calendar).
- Selecting which sub-calendars to include (use primary/default only).
- Encrypting tokens/app passwords at rest (follow-up).
- Background/cron sync or a cached `calendar_events` table.

## Files

**New**
- `lib/calendar/providers/types.ts`
- `lib/calendar/providers/google.ts`
- `lib/calendar/providers/microsoft.ts`
- `lib/calendar/providers/apple.ts`
- `lib/calendar/token.ts`
- `app/api/calendar/events/route.ts`
- Adapter + token unit tests

**Modified**
- `app/(app)/calendar/page.tsx` (fetch + render external read-only events,
  refresh button, error surfacing)
- `package.json` (add `node-ical`)

**Unchanged**
- DB schema, existing connect/callback/setup/status/disconnect routes.

## Appendix: OAuth app setup (to be expanded in the implementation plan / README)

Concrete click-by-click steps for Google Cloud Console and Azure app
registration, plus where to paste the resulting client ID/secret.
