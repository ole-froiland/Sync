# External Calendars: Fetch & Display Events — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make connected Apple/Google/Microsoft calendars show their real events on the Calendar page, merged read-only with the user's local events.

**Architecture:** A provider-agnostic adapter layer (`lib/calendar/providers/`) exposes a pure mapper + a `fetchEvents` per provider. A new `GET /api/calendar/events` route loads the user's connections, calls each adapter for the visible date range (refreshing OAuth tokens as needed), and returns a merged event list plus per-provider errors. The Calendar page fetches that range on load/navigation/refresh and renders external events as read-only.

**Tech Stack:** Next.js 16 (App Router route handlers), Supabase (`@supabase/ssr`), TypeScript, `tsdav` (CalDAV), `node-ical` (ICS parsing), Vitest (new test runner).

**Spec:** `docs/superpowers/specs/2026-05-30-external-calendars-sync-design.md`

---

## Notes for the implementer

- **Next 16 caveat:** `AGENTS.md` warns this Next version has breaking changes. Route-handler conventions are already established in this repo — mirror existing routes like `app/api/calendar/status/route.ts` (async `createClient()`, `NextResponse.json`) and `app/api/calendar/[provider]/disconnect/route.ts` (`{ params }: { params: Promise<...> }`). If anything looks off, read `node_modules/next/dist/docs/01-app`.
- **Secrets:** never hardcode client IDs/secrets. They come from `.env.local`.
- **No credentials needed to build.** All unit tests run against sample data with no network. Live verification (Apple/Google/Microsoft) happens at the end and needs the user.

---

## File Structure

**New files**
- `vitest.config.ts` — test runner config (path alias support)
- `lib/calendar/providers/types.ts` — shared types + adapter interface
- `lib/calendar/providers/google.ts` — Google adapter (`mapGoogleEvents` + `fetchEvents`)
- `lib/calendar/providers/microsoft.ts` — Microsoft adapter (`mapMicrosoftEvents` + `fetchEvents`)
- `lib/calendar/providers/apple.ts` — Apple adapter (`parseAppleIcs` + `fetchEvents`)
- `lib/calendar/token.ts` — `isExpired`, `buildRefreshRequest`, `getValidAccessToken`
- `lib/calendar/range.ts` — `visibleRange`, `externalToCalendarEvent` (pure helpers for the page)
- `app/api/calendar/events/route.ts` — events API
- `lib/calendar/providers/google.test.ts`
- `lib/calendar/providers/microsoft.test.ts`
- `lib/calendar/providers/apple.test.ts`
- `lib/calendar/token.test.ts`
- `lib/calendar/range.test.ts`

**Modified files**
- `package.json` — add deps + `test` script
- `app/(app)/calendar/page.tsx` — fetch + render external events, refresh button, error surfacing

---

## Task 1: Set up test runner and dependencies

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/calendar/__smoke__.test.ts` (temporary)

- [ ] **Step 1: Install dependencies**

```bash
npm install node-ical tsdav
npm install -D vitest vite-tsconfig-paths
```

- [ ] **Step 2: Add the test script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
  },
})
```

- [ ] **Step 4: Add a smoke test to prove the runner + `@/` alias work**

Create `lib/calendar/__smoke__.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('test runner', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run the smoke test**

Run: `npm test`
Expected: PASS (1 test passed).

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm lib/calendar/__smoke__.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test runner and calendar deps (node-ical, tsdav)"
```

---

## Task 2: Shared provider types

**Files:**
- Create: `lib/calendar/providers/types.ts`

- [ ] **Step 1: Write the types**

```ts
export type CalendarProvider = 'apple' | 'microsoft' | 'google'

export type ExternalEvent = {
  id: string // globally unique, e.g. "google:<eventId>"
  title: string
  start: string // ISO 8601
  end: string // ISO 8601
  allDay: boolean
  provider: CalendarProvider
  location?: string
}

export type CalendarConnectionRow = {
  id: string
  user_id: string
  provider: CalendarProvider
  provider_account_id: string | null
  provider_account_name: string | null
  provider_email: string | null
  access_token: string | null
  refresh_token: string | null
  token_type: string | null
  scope: string | null
  expires_at: string | null
  caldav_server_url: string | null
  caldav_username: string | null
  caldav_app_password: string | null
  status: string
}

export interface CalendarProviderAdapter {
  fetchEvents(
    connection: CalendarConnectionRow,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<ExternalEvent[]>
}
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors referencing this file.

```bash
git add lib/calendar/providers/types.ts
git commit -m "feat: add shared calendar provider types"
```

---

## Task 3: Google adapter

**Files:**
- Create: `lib/calendar/providers/google.ts`
- Test: `lib/calendar/providers/google.test.ts`

- [ ] **Step 1: Write the failing test for `mapGoogleEvents`**

`lib/calendar/providers/google.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapGoogleEvents } from './google'

describe('mapGoogleEvents', () => {
  it('maps a timed event', () => {
    const out = mapGoogleEvents([
      {
        id: 'abc',
        summary: 'Sprint planning',
        location: 'Room 1',
        status: 'confirmed',
        start: { dateTime: '2026-05-12T09:00:00+02:00' },
        end: { dateTime: '2026-05-12T10:00:00+02:00' },
      },
    ])
    expect(out).toEqual([
      {
        id: 'google:abc',
        title: 'Sprint planning',
        start: '2026-05-12T09:00:00+02:00',
        end: '2026-05-12T10:00:00+02:00',
        allDay: false,
        provider: 'google',
        location: 'Room 1',
      },
    ])
  })

  it('maps an all-day event using date fields', () => {
    const out = mapGoogleEvents([
      { id: 'd1', summary: 'Holiday', start: { date: '2026-05-17' }, end: { date: '2026-05-18' } },
    ])
    expect(out[0].allDay).toBe(true)
    expect(out[0].start).toBe('2026-05-17')
  })

  it('falls back to a placeholder title and drops cancelled events', () => {
    const out = mapGoogleEvents([
      { id: 'x', status: 'cancelled', start: { dateTime: '2026-05-12T09:00:00Z' }, end: { dateTime: '2026-05-12T10:00:00Z' } },
      { id: 'y', start: { dateTime: '2026-05-12T11:00:00Z' }, end: { dateTime: '2026-05-12T12:00:00Z' } },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('(No title)')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- google`
Expected: FAIL — cannot find `mapGoogleEvents`.

- [ ] **Step 3: Implement `lib/calendar/providers/google.ts`**

```ts
import { getValidAccessToken } from '@/lib/calendar/token'
import type { CalendarConnectionRow, ExternalEvent } from './types'

type GoogleDate = { dateTime?: string; date?: string }
type GoogleEvent = {
  id: string
  summary?: string
  location?: string
  status?: string
  start?: GoogleDate
  end?: GoogleDate
}

export function mapGoogleEvents(items: GoogleEvent[]): ExternalEvent[] {
  return items
    .filter((item) => item.status !== 'cancelled')
    .map((item) => {
      const allDay = Boolean(item.start?.date && !item.start?.dateTime)
      return {
        id: `google:${item.id}`,
        title: item.summary ?? '(No title)',
        start: item.start?.dateTime ?? item.start?.date ?? '',
        end: item.end?.dateTime ?? item.end?.date ?? '',
        allDay,
        provider: 'google' as const,
        location: item.location || undefined,
      }
    })
    .filter((event) => event.start && event.end)
}

export async function fetchEvents(
  connection: CalendarConnectionRow,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<ExternalEvent[]> {
  const token = await getValidAccessToken(connection)
  const params = new URLSearchParams({
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) {
    throw new Error(`Google Calendar API error: ${res.status}`)
  }
  const data = (await res.json()) as { items?: GoogleEvent[] }
  return mapGoogleEvents(data.items ?? [])
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- google`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/providers/google.ts lib/calendar/providers/google.test.ts
git commit -m "feat: add Google Calendar adapter"
```

---

## Task 4: Microsoft adapter

**Files:**
- Create: `lib/calendar/providers/microsoft.ts`
- Test: `lib/calendar/providers/microsoft.test.ts`

- [ ] **Step 1: Write the failing test for `mapMicrosoftEvents`**

`lib/calendar/providers/microsoft.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapMicrosoftEvents } from './microsoft'

describe('mapMicrosoftEvents', () => {
  it('maps a timed event and forces UTC Z suffix', () => {
    const out = mapMicrosoftEvents([
      {
        id: 'm1',
        subject: 'Standup',
        isAllDay: false,
        location: { displayName: 'Teams' },
        start: { dateTime: '2026-05-12T07:00:00.0000000', timeZone: 'UTC' },
        end: { dateTime: '2026-05-12T07:30:00.0000000', timeZone: 'UTC' },
      },
    ])
    expect(out).toEqual([
      {
        id: 'microsoft:m1',
        title: 'Standup',
        start: '2026-05-12T07:00:00.0000000Z',
        end: '2026-05-12T07:30:00.0000000Z',
        allDay: false,
        provider: 'microsoft',
        location: 'Teams',
      },
    ])
  })

  it('handles all-day and missing subject/location', () => {
    const out = mapMicrosoftEvents([
      {
        id: 'm2',
        isAllDay: true,
        start: { dateTime: '2026-05-17T00:00:00.0000000', timeZone: 'UTC' },
        end: { dateTime: '2026-05-18T00:00:00.0000000', timeZone: 'UTC' },
      },
    ])
    expect(out[0].allDay).toBe(true)
    expect(out[0].title).toBe('(No title)')
    expect(out[0].location).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- microsoft`
Expected: FAIL — cannot find `mapMicrosoftEvents`.

- [ ] **Step 3: Implement `lib/calendar/providers/microsoft.ts`**

```ts
import { getValidAccessToken } from '@/lib/calendar/token'
import type { CalendarConnectionRow, ExternalEvent } from './types'

type MsDateTime = { dateTime: string; timeZone: string }
type MsEvent = {
  id: string
  subject?: string
  isAllDay?: boolean
  location?: { displayName?: string }
  start: MsDateTime
  end: MsDateTime
}

// Graph returns dateTime without an offset; we request UTC via the Prefer
// header in fetchEvents, so append Z to make it a valid ISO instant.
function toIso(dt: MsDateTime): string {
  return dt.dateTime.endsWith('Z') ? dt.dateTime : `${dt.dateTime}Z`
}

export function mapMicrosoftEvents(value: MsEvent[]): ExternalEvent[] {
  return value.map((event) => ({
    id: `microsoft:${event.id}`,
    title: event.subject ?? '(No title)',
    start: toIso(event.start),
    end: toIso(event.end),
    allDay: Boolean(event.isAllDay),
    provider: 'microsoft' as const,
    location: event.location?.displayName || undefined,
  }))
}

export async function fetchEvents(
  connection: CalendarConnectionRow,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<ExternalEvent[]> {
  const token = await getValidAccessToken(connection)
  const params = new URLSearchParams({
    startDateTime: rangeStart.toISOString(),
    endDateTime: rangeEnd.toISOString(),
    $top: '250',
    $orderby: 'start/dateTime',
  })
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    },
  )
  if (!res.ok) {
    throw new Error(`Microsoft Graph API error: ${res.status}`)
  }
  const data = (await res.json()) as { value?: MsEvent[] }
  return mapMicrosoftEvents(data.value ?? [])
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- microsoft`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/providers/microsoft.ts lib/calendar/providers/microsoft.test.ts
git commit -m "feat: add Microsoft Outlook calendar adapter"
```

---

## Task 5: Apple adapter (CalDAV + ICS)

**Files:**
- Create: `lib/calendar/providers/apple.ts`
- Test: `lib/calendar/providers/apple.test.ts`

- [ ] **Step 1: Write the failing test for `parseAppleIcs`**

`lib/calendar/providers/apple.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseAppleIcs } from './apple'

const TIMED_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-1@icloud.com
SUMMARY:Dentist
LOCATION:Clinic
DTSTART:20260512T090000Z
DTEND:20260512T093000Z
END:VEVENT
END:VCALENDAR`

const ALLDAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-2@icloud.com
SUMMARY:Vacation
DTSTART;VALUE=DATE:20260601
DTEND;VALUE=DATE:20260602
END:VEVENT
END:VCALENDAR`

describe('parseAppleIcs', () => {
  it('parses a timed VEVENT', () => {
    const out = parseAppleIcs(TIMED_ICS)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('apple:evt-1@icloud.com')
    expect(out[0].title).toBe('Dentist')
    expect(out[0].location).toBe('Clinic')
    expect(out[0].allDay).toBe(false)
    expect(new Date(out[0].start).toISOString()).toBe('2026-05-12T09:00:00.000Z')
    expect(out[0].provider).toBe('apple')
  })

  it('parses an all-day VEVENT', () => {
    const out = parseAppleIcs(ALLDAY_ICS)
    expect(out[0].allDay).toBe(true)
    expect(out[0].title).toBe('Vacation')
  })

  it('returns [] for an ICS with no events', () => {
    expect(parseAppleIcs('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- apple`
Expected: FAIL — cannot find `parseAppleIcs`.

- [ ] **Step 3: Implement `lib/calendar/providers/apple.ts`**

```ts
import { createDAVClient } from 'tsdav'
import nodeIcal from 'node-ical'
import type { CalendarConnectionRow, ExternalEvent } from './types'

type VEvent = {
  type: string
  uid?: string
  summary?: string
  location?: string
  start?: Date
  end?: Date
  datetype?: string
}

export function parseAppleIcs(ics: string): ExternalEvent[] {
  const parsed = nodeIcal.sync.parseICS(ics) as Record<string, VEvent>
  const events: ExternalEvent[] = []
  for (const key of Object.keys(parsed)) {
    const component = parsed[key]
    if (component.type !== 'VEVENT' || !component.start) continue
    const start = component.start
    const end = component.end ?? component.start
    events.push({
      id: `apple:${component.uid ?? key}`,
      title: component.summary ?? '(No title)',
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      allDay: component.datetype === 'date',
      provider: 'apple',
      location: component.location || undefined,
    })
  }
  return events
}

export async function fetchEvents(
  connection: CalendarConnectionRow,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<ExternalEvent[]> {
  if (!connection.caldav_username || !connection.caldav_app_password) {
    throw new Error('Apple CalDAV credentials are missing')
  }

  const client = await createDAVClient({
    serverUrl: connection.caldav_server_url ?? 'https://caldav.icloud.com',
    credentials: {
      username: connection.caldav_username,
      password: connection.caldav_app_password,
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })

  const calendars = await client.fetchCalendars()
  const events: ExternalEvent[] = []

  for (const calendar of calendars) {
    const objects = await client.fetchCalendarObjects({
      calendar,
      timeRange: {
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
      },
    })
    for (const object of objects) {
      if (object.data) {
        events.push(...parseAppleIcs(object.data))
      }
    }
  }

  return events
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- apple`
Expected: PASS (3 tests).

> If `node-ical`'s default import shape differs under the repo's TS config, use `import * as nodeIcal from 'node-ical'` and re-run. Confirm the working import before committing.

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/providers/apple.ts lib/calendar/providers/apple.test.ts
git commit -m "feat: add Apple CalDAV calendar adapter"
```

---

## Task 6: Token refresh helper

**Files:**
- Create: `lib/calendar/token.ts`
- Test: `lib/calendar/token.test.ts`

- [ ] **Step 1: Write the failing test for the pure helpers**

`lib/calendar/token.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isExpired, buildRefreshRequest } from './token'

describe('isExpired', () => {
  it('is true when expiry is within the skew window', () => {
    expect(isExpired(new Date(Date.now() + 30_000).toISOString())).toBe(true)
  })

  it('is false when expiry is comfortably in the future', () => {
    expect(isExpired(new Date(Date.now() + 600_000).toISOString())).toBe(false)
  })

  it('is true when expiry is null (force refresh)', () => {
    expect(isExpired(null)).toBe(true)
  })
})

describe('buildRefreshRequest', () => {
  it('builds a Google refresh request', () => {
    const req = buildRefreshRequest('google', 'rt', 'cid', 'secret')
    expect(req.url).toBe('https://oauth2.googleapis.com/token')
    expect(req.body.get('grant_type')).toBe('refresh_token')
    expect(req.body.get('refresh_token')).toBe('rt')
    expect(req.body.get('client_id')).toBe('cid')
    expect(req.body.get('client_secret')).toBe('secret')
  })

  it('builds a Microsoft refresh request with scope', () => {
    const req = buildRefreshRequest('microsoft', 'rt', 'cid', 'secret')
    expect(req.url).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token')
    expect(req.body.get('scope')).toBe('offline_access User.Read Calendars.Read')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- token`
Expected: FAIL — cannot find `isExpired` / `buildRefreshRequest`.

- [ ] **Step 3: Implement `lib/calendar/token.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import type { CalendarConnectionRow, CalendarProvider } from './providers/types'

const SKEW_MS = 60_000

const TOKEN_URLS: Record<'google' | 'microsoft', string> = {
  google: 'https://oauth2.googleapis.com/token',
  microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
}

export function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() - Date.now() < SKEW_MS
}

export function buildRefreshRequest(
  provider: 'google' | 'microsoft',
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): { url: string; body: URLSearchParams } {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  if (provider === 'microsoft') {
    body.set('scope', 'offline_access User.Read Calendars.Read')
  }
  return { url: TOKEN_URLS[provider], body }
}

function clientCredentials(provider: 'google' | 'microsoft') {
  if (provider === 'google') {
    return {
      clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    }
  }
  return {
    clientId: process.env.MICROSOFT_CALENDAR_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET,
  }
}

type RefreshResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error_description?: string
  error?: string
}

export async function getValidAccessToken(
  connection: CalendarConnectionRow,
): Promise<string> {
  const provider = connection.provider as CalendarProvider
  if (provider === 'apple') {
    throw new Error('Apple connections do not use OAuth access tokens')
  }

  if (connection.access_token && !isExpired(connection.expires_at)) {
    return connection.access_token
  }

  if (!connection.refresh_token) {
    if (connection.access_token) return connection.access_token
    throw new Error('No refresh token available; reconnect the calendar')
  }

  const { clientId, clientSecret } = clientCredentials(provider)
  if (!clientId || !clientSecret) {
    throw new Error(`${provider} OAuth is not configured on this server`)
  }

  const { url, body } = buildRefreshRequest(
    provider,
    connection.refresh_token,
    clientId,
    clientSecret,
  )
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = (await res.json()) as RefreshResponse
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'Token refresh failed')
  }

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null

  const supabase = await createClient()
  await supabase
    .from('calendar_connections')
    .update({
      access_token: data.access_token,
      expires_at: expiresAt,
      status: 'connected',
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    })
    .eq('id', connection.id)

  return data.access_token
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- token`
Expected: PASS (5 tests).

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors.

```bash
git add lib/calendar/token.ts lib/calendar/token.test.ts
git commit -m "feat: add OAuth token refresh helper for calendar providers"
```

---

## Task 7: Events API route

**Files:**
- Create: `app/api/calendar/events/route.ts`

> No automated test here (it needs Supabase + network). Verify by type-check and a manual curl after Task 9. The provider logic it calls is already unit-tested.

- [ ] **Step 1: Implement `app/api/calendar/events/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as google from '@/lib/calendar/providers/google'
import * as microsoft from '@/lib/calendar/providers/microsoft'
import * as apple from '@/lib/calendar/providers/apple'
import type {
  CalendarConnectionRow,
  CalendarProvider,
  ExternalEvent,
} from '@/lib/calendar/providers/types'

const adapters: Record<
  CalendarProvider,
  (c: CalendarConnectionRow, s: Date, e: Date) => Promise<ExternalEvent[]>
> = {
  google: google.fetchEvents,
  microsoft: microsoft.fetchEvents,
  apple: apple.fetchEvents,
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')

  if (!startParam || !endParam) {
    return NextResponse.json({ error: 'start and end are required' }, { status: 400 })
  }

  const rangeStart = new Date(startParam)
  const rangeEnd = new Date(endParam)
  if (Number.isNaN(+rangeStart) || Number.isNaN(+rangeEnd)) {
    return NextResponse.json({ error: 'Invalid start or end' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: connections, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const events: ExternalEvent[] = []
  const providerErrors: { provider: string; message: string }[] = []

  await Promise.all(
    (connections ?? []).map(async (connection: CalendarConnectionRow) => {
      const adapter = adapters[connection.provider]
      if (!adapter) return
      try {
        const result = await adapter(connection, rangeStart, rangeEnd)
        events.push(...result)
      } catch (caught) {
        providerErrors.push({
          provider: connection.provider,
          message: caught instanceof Error ? caught.message : 'Fetch failed',
        })
        await supabase
          .from('calendar_connections')
          .update({ status: 'error' })
          .eq('id', connection.id)
      }
    }),
  )

  return NextResponse.json({ events, providerErrors })
}
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors.

```bash
git add app/api/calendar/events/route.ts
git commit -m "feat: add calendar events API route"
```

---

## Task 8: Page helpers (visible range + event mapping)

**Files:**
- Create: `lib/calendar/range.ts`
- Test: `lib/calendar/range.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/calendar/range.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { visibleRange, externalToCalendarEvent } from './range'

describe('visibleRange', () => {
  it('covers the whole 6-week month grid for month view', () => {
    const { start, end } = visibleRange('month', new Date(2026, 4, 15))
    // May 2026 grid (Mon-start) begins Apr 27, ends Jun 7; with 1-day buffer.
    expect(start.getTime()).toBeLessThanOrEqual(new Date(2026, 3, 27).getTime())
    expect(end.getTime()).toBeGreaterThanOrEqual(new Date(2026, 5, 7).getTime())
  })

  it('returns a 1-day span (plus buffer) for day view', () => {
    const { start, end } = visibleRange('day', new Date(2026, 4, 15))
    expect(end.getTime() - start.getTime()).toBeLessThanOrEqual(4 * 24 * 60 * 60 * 1000)
  })
})

describe('externalToCalendarEvent', () => {
  it('maps an external event to a read-only calendar event with a provider tone', () => {
    const ev = externalToCalendarEvent({
      id: 'google:abc',
      title: 'Sync',
      start: '2026-05-12T09:00:00Z',
      end: '2026-05-12T10:00:00Z',
      allDay: false,
      provider: 'google',
    })
    expect(ev.external).toBe(true)
    expect(ev.provider).toBe('google')
    expect(ev.tone).toBe('sky')
    expect(ev.id).toBe('google:abc')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- range`
Expected: FAIL — cannot find `visibleRange` / `externalToCalendarEvent`.

- [ ] **Step 3: Implement `lib/calendar/range.ts`**

```ts
import type { ExternalEvent, CalendarProvider } from './providers/types'

export type CalendarView = 'month' | 'week' | 'day'

export type RenderableEvent = {
  id: string
  title: string
  start: string
  end: string
  tone: 'violet' | 'emerald' | 'amber' | 'sky'
  kind: 'focus' | 'meeting' | 'launch' | 'deadline'
  note?: string
  external?: boolean
  provider?: CalendarProvider
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeekMonday(date: Date): Date {
  const start = startOfDay(date)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

// Mirrors the grid the Calendar page renders, with a 1-day buffer each side.
export function visibleRange(view: CalendarView, viewDate: Date): { start: Date; end: Date } {
  if (view === 'day') {
    const start = startOfDay(viewDate)
    return { start: new Date(+start - DAY_MS), end: new Date(+start + 2 * DAY_MS) }
  }
  if (view === 'week') {
    const start = startOfWeekMonday(viewDate)
    return { start: new Date(+start - DAY_MS), end: new Date(+start + 8 * DAY_MS) }
  }
  // month: 6-week grid starting on the Monday on/before the 1st
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const gridStart = startOfWeekMonday(first)
  return { start: new Date(+gridStart - DAY_MS), end: new Date(+gridStart + 43 * DAY_MS) }
}

const PROVIDER_TONE: Record<CalendarProvider, RenderableEvent['tone']> = {
  google: 'sky',
  microsoft: 'violet',
  apple: 'amber',
}

export function externalToCalendarEvent(event: ExternalEvent): RenderableEvent {
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    tone: PROVIDER_TONE[event.provider],
    kind: 'meeting',
    note: event.location,
    external: true,
    provider: event.provider,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- range`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/range.ts lib/calendar/range.test.ts
git commit -m "feat: add visible-range and external-event mapping helpers"
```

---

## Task 9: Wire external events into the Calendar page

**Files:**
- Modify: `app/(app)/calendar/page.tsx`

> This is a client component; there is no component-test harness, so verify via type-check, lint, and a manual run. The pure logic it relies on is already tested in Task 8.

- [ ] **Step 1: Extend the `CalendarEvent` type and import helpers**

At the top of the file, add to the imports:

```ts
import { visibleRange, externalToCalendarEvent } from '@/lib/calendar/range'
import type { ExternalEvent } from '@/lib/calendar/providers/types'
```

Update the `CalendarEvent` type (around line 23) to add the read-only flag and provider:

```ts
type CalendarEvent = {
  id: string
  title: string
  start: string
  end: string
  tone: 'violet' | 'emerald' | 'amber' | 'sky'
  kind: 'focus' | 'meeting' | 'launch' | 'deadline'
  note?: string
  external?: boolean
  provider?: CalendarProvider
}
```

- [ ] **Step 2: Add state for external events and errors**

After the `providerStatuses` state (around line 240), add:

```ts
  const [externalEvents, setExternalEvents] = useState<CalendarEvent[]>([])
  const [externalLoading, setExternalLoading] = useState(false)
  const [providerErrors, setProviderErrors] = useState<{ provider: string; message: string }[]>([])
```

- [ ] **Step 3: Add the fetch function and effect**

Add this function alongside `refreshProviderStatus` (around line 347):

```ts
  async function fetchExternalEvents() {
    setExternalLoading(true)
    try {
      const { start, end } = visibleRange(view, viewDate)
      const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() })
      const res = await fetch(`/api/calendar/events?${params}`)
      if (!res.ok) throw new Error('Could not load external events.')
      const body = (await res.json()) as {
        events?: ExternalEvent[]
        providerErrors?: { provider: string; message: string }[]
      }
      setExternalEvents((body.events ?? []).map(externalToCalendarEvent))
      setProviderErrors(body.providerErrors ?? [])
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : 'Could not load external events.')
    } finally {
      setExternalLoading(false)
    }
  }
```

Add an effect (near the other effects, around line 286) that refetches when the visible range changes:

```ts
  useEffect(() => {
    void fetchExternalEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, viewDate])
```

- [ ] **Step 4: Merge external events into the render source**

Change `filteredEvents` (around line 288) to combine local and external events:

```ts
  const filteredEvents = useMemo(
    () => [...events, ...externalEvents].filter((event) => eventMatches(event, searchQuery)),
    [events, externalEvents, searchQuery]
  )
```

- [ ] **Step 5: Make external events read-only in the month pill**

In `renderEventPill` (around line 512), make external events non-draggable and badge them. Replace the `draggable` prop and add a provider label:

```tsx
      <div
        key={event.id}
        draggable={view === 'month' && !event.external}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
        onDragStart={(dragEvent) => !event.external && handleEventDragStart(dragEvent, event)}
        className={`rounded-md px-2 py-1 text-[11px] ring-1 ${event.external ? 'cursor-default opacity-90' : 'cursor-grab active:cursor-grabbing'} ${toneClasses(event.tone, isSearchHit)}`}
      >
        <p className="truncate font-semibold">
          {event.external && <span className="mr-1 opacity-60">●</span>}
          {event.title}
        </p>
```

(Keep the existing compact-time `<p>` block below unchanged.)

- [ ] **Step 6: Guard the drag/move handlers against external events**

In `handleEventDragStart` (around line 443), bail out for external events:

```ts
  function handleEventDragStart(event: DragEvent<HTMLDivElement>, calendarEvent: CalendarEvent) {
    if (calendarEvent.external) return
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-sync-calendar-event', calendarEvent.id)
  }
```

In `moveEventToDay` (around line 454), only update local events (external ids are not in `events`, so they are already safe, but make it explicit):

```ts
  function moveEventToDay(eventId: string, day: Date, hour?: number) {
    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== eventId || event.external) return event
        // ...unchanged body...
```

- [ ] **Step 7: Add a Refresh button + render provider errors**

In the "Add external calendars" panel header area (inside the `externalOpen` block, around line 845), add a refresh button at the top of the list:

```tsx
              {externalOpen && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void fetchExternalEvents()}
                      loading={externalLoading}
                    >
                      Refresh events
                    </Button>
                  </div>
                  {providerErrors.length > 0 && (
                    <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                      {providerErrors.map((pe) => (
                        <p key={pe.provider}>
                          {providerMeta[pe.provider as CalendarProvider]?.label ?? pe.provider}: {pe.message}
                        </p>
                      ))}
                    </div>
                  )}
                  {(['apple', 'microsoft', 'google'] as CalendarProvider[]).map((provider) => {
                    // ...unchanged provider card body...
```

(Ensure the closing tags still match — you are adding two blocks before the existing `.map`.)

- [ ] **Step 8: Refetch external events after connect/disconnect**

In `disconnectProvider` (around line 536), after `await refreshProviderStatus()` add:

```ts
    await fetchExternalEvents()
```

And in the mount effect that handles `calendar_connected` query param (around line 269), the existing `refreshProviderStatus` effect already runs; no change needed beyond Step 3's effect, which fetches on mount.

- [ ] **Step 9: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npm run lint`
Expected: no new errors in `app/(app)/calendar/page.tsx`.

- [ ] **Step 10: Commit**

```bash
git add "app/(app)/calendar/page.tsx"
git commit -m "feat: render external calendar events read-only on the calendar page"
```

---

## Task 10: Setup guide + env documentation

**Files:**
- Create: `docs/external-calendars-setup.md`

- [ ] **Step 1: Write the setup guide**

Create `docs/external-calendars-setup.md` with concrete steps:

```markdown
# Connecting external calendars

External events are read-only and fetched live for the dates you're viewing.

## Apple (iCloud) — no setup required
1. Go to https://appleid.apple.com → Sign-In & Security → App-Specific Passwords.
2. Create a password (e.g. "Sync Calendar").
3. In the app: Calendar → Add external calendars → Add Apple Calendar.
4. Enter your Apple ID, the app-specific password, and leave the server as
   `https://caldav.icloud.com`.

## Google Calendar
1. Google Cloud Console → create/select a project.
2. APIs & Services → Library → enable "Google Calendar API".
3. APIs & Services → Credentials → Create credentials → OAuth client ID → Web
   application.
4. Authorized redirect URI:
   `http://localhost:3000/api/calendar/google/callback`
   (and your production URL: `https://<domain>/api/calendar/google/callback`).
5. Copy the client ID and secret into `.env.local`:
   ```
   GOOGLE_CALENDAR_CLIENT_ID=...
   GOOGLE_CALENDAR_CLIENT_SECRET=...
   ```
6. Restart `npm run dev`. Then Calendar → Add Google Calendar.

## Microsoft Outlook
1. Azure Portal → Microsoft Entra ID → App registrations → New registration.
2. Redirect URI (type "Web"):
   `http://localhost:3000/api/calendar/microsoft/callback`.
3. Certificates & secrets → New client secret → copy the value.
4. API permissions → Microsoft Graph → Delegated → add `Calendars.Read`,
   `offline_access`, `User.Read`.
5. Copy the Application (client) ID and secret into `.env.local`:
   ```
   MICROSOFT_CALENDAR_CLIENT_ID=...
   MICROSOFT_CALENDAR_CLIENT_SECRET=...
   ```
6. Restart `npm run dev`. Then Calendar → Add Microsoft Outlook Calendar.
```

- [ ] **Step 2: Commit**

```bash
git add docs/external-calendars-setup.md
git commit -m "docs: add external calendar setup guide"
```

---

## Task 11: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all adapter/token/range tests pass.

- [ ] **Step 2: Type-check and lint the whole project**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual live check (requires the user)**

1. User generates an Apple app-specific password and connects Apple Calendar in
   the UI.
2. Confirm real iCloud events appear on the Calendar page for the current view,
   styled read-only (not draggable).
3. If the user has configured Google/Microsoft OAuth in `.env.local`, connect
   each and confirm their events appear too.
4. Toggle "Refresh events" and navigate months to confirm refetch.

- [ ] **Step 5: Final commit (if any cleanup was needed)**

```bash
git add -A
git commit -m "chore: external calendar sync verification cleanup"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** adapter layer (Tasks 3–5), token refresh (Task 6), events API (Task 7), frontend read-only render + refresh + error surfacing (Tasks 8–9), setup guide (Task 10), testing (per-task + Task 11). All spec sections mapped.
- **Out-of-scope items** (two-way sync, sub-calendar selection, encryption, cron/cache) are intentionally excluded.
- **Type consistency:** `ExternalEvent`, `CalendarConnectionRow`, `CalendarProvider` defined in Task 2 and reused verbatim in Tasks 3–8; `getValidAccessToken` defined in Task 6 and consumed in Tasks 3–4; `RenderableEvent` fields match the page's extended `CalendarEvent`.
- **No placeholders:** every code step contains complete code.
