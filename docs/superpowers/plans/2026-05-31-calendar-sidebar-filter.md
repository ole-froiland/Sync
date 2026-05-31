# Calendar Sidebar Per-Calendar Filtering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the calendar sidebar's "Calendar pulse" and inline "Add external calendars" cards with a single **Calendars** panel that filters events per calendar (Sync, Google, Apple by real name), moves connection management into a **Manage** modal, and removes the mock seed events.

**Architecture:** Tag every event with a `calendarId`/`calendarName` at the adapter layer; derive a grouped, coloured calendar list on the page; keep a persisted `hiddenCalendarIds` set; filter the rendered event list (grid + search) by it. UI changes are confined to `app/(app)/calendar/page.tsx`; the data model touches `lib/calendar/*`.

**Tech Stack:** Next.js 16 (App Router), React, TypeScript, Tailwind, Vitest. Spec: `docs/superpowers/specs/2026-05-31-calendar-sidebar-filter-design.md`.

---

### Task 1: Add calendar identity to the event data model + adapters

**Files:**
- Modify: `lib/calendar/providers/types.ts` (add fields to `ExternalEvent`)
- Modify: `lib/calendar/providers/google.ts` (`mapGoogleEvents`, `fetchEvents`)
- Modify: `lib/calendar/providers/microsoft.ts` (`mapMicrosoftEvents`, `fetchEvents`)
- Modify: `lib/calendar/providers/apple.ts` (`parseAppleIcs`, `fetchEvents`)
- Test: `lib/calendar/providers/google.test.ts`, `microsoft.test.ts`, `apple.test.ts`

- [ ] **Step 1: Add the fields to the `ExternalEvent` type**

In `lib/calendar/providers/types.ts`, add two required fields to `ExternalEvent`:

```ts
export type ExternalEvent = {
  id: string // globally unique, e.g. "google:<eventId>"
  title: string
  start: string // ISO 8601
  end: string // ISO 8601
  allDay: boolean
  provider: CalendarProvider
  calendarId: string // stable key for filtering, e.g. "primary" or a CalDAV URL
  calendarName: string // display label, e.g. "Trening"
  location?: string
}
```

- [ ] **Step 2: Update the Google mapper test (failing)**

In `lib/calendar/providers/google.test.ts`, update the first assertion's expected object to include the new fields, and pass calendar args:

```ts
const out = mapGoogleEvents([
  {
    id: 'abc',
    summary: 'Sprint planning',
    location: 'Room 1',
    status: 'confirmed',
    start: { dateTime: '2026-05-12T09:00:00+02:00' },
    end: { dateTime: '2026-05-12T10:00:00+02:00' },
  },
], 'primary', 'Primary')
expect(out[0].calendarId).toBe('primary')
expect(out[0].calendarName).toBe('Primary')
```

- [ ] **Step 3: Run the Google test to verify it fails**

Run: `npx vitest run lib/calendar/providers/google.test.ts`
Expected: FAIL — `mapGoogleEvents` ignores the 2nd/3rd args and `calendarId` is undefined.

- [ ] **Step 4: Implement Google mapper + fetch**

In `lib/calendar/providers/google.ts`, change `mapGoogleEvents` to accept calendar identity and set it on each event:

```ts
export function mapGoogleEvents(
  items: GoogleEvent[],
  calendarId = 'primary',
  calendarName = 'Primary',
): ExternalEvent[] {
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
        calendarId,
        calendarName,
        location: item.location || undefined,
      }
    })
    .filter((event) => event.start && event.end)
}
```

In the same file's `fetchEvents`, the existing call `return mapGoogleEvents(data.items ?? [])` stays valid (defaults apply). Leave it as-is.

- [ ] **Step 5: Run the Google test to verify it passes**

Run: `npx vitest run lib/calendar/providers/google.test.ts`
Expected: PASS

- [ ] **Step 6: Update the Microsoft mapper test (failing)**

In `lib/calendar/providers/microsoft.test.ts`, pass calendar args to the first `mapMicrosoftEvents` call and assert the fields:

```ts
const out = mapMicrosoftEvents(value, 'primary', 'Outlook')
expect(out[0].calendarId).toBe('primary')
expect(out[0].calendarName).toBe('Outlook')
```

(Use whatever local `value` variable that test already defines for the call.)

- [ ] **Step 7: Run the Microsoft test to verify it fails**

Run: `npx vitest run lib/calendar/providers/microsoft.test.ts`
Expected: FAIL — `calendarId` undefined.

- [ ] **Step 8: Implement Microsoft mapper**

In `lib/calendar/providers/microsoft.ts`:

```ts
export function mapMicrosoftEvents(
  value: MsEvent[],
  calendarId = 'primary',
  calendarName = 'Outlook',
): ExternalEvent[] {
  return value.map((event) => ({
    id: `microsoft:${event.id}`,
    title: event.subject ?? '(No title)',
    start: toIso(event.start),
    end: toIso(event.end),
    allDay: Boolean(event.isAllDay),
    provider: 'microsoft' as const,
    calendarId,
    calendarName,
    location: event.location?.displayName || undefined,
  }))
}
```

`fetchEvents`'s existing `return mapMicrosoftEvents(data.value ?? [])` stays valid.

- [ ] **Step 9: Run the Microsoft test to verify it passes**

Run: `npx vitest run lib/calendar/providers/microsoft.test.ts`
Expected: PASS

- [ ] **Step 10: Update the Apple test (failing)**

In `lib/calendar/providers/apple.test.ts`, the parser now takes calendar identity as the 2nd/3rd args (range moves to 4th/5th). Update the first test and add an identity assertion:

```ts
it('parses a timed VEVENT', () => {
  const out = parseAppleIcs(TIMED_ICS, 'cal-url-1', 'Trening')
  expect(out).toHaveLength(1)
  expect(out[0].id).toBe('apple:evt-1@icloud.com')
  expect(out[0].calendarId).toBe('cal-url-1')
  expect(out[0].calendarName).toBe('Trening')
  expect(out[0].provider).toBe('apple')
})
```

Also update the recurrence tests that pass a range so the range is the 4th/5th arg, e.g.:

```ts
const out = parseAppleIcs(RECURRING_ICS, 'cal-url-1', 'Trening',
  new Date('2026-05-01T00:00:00Z'), new Date('2026-05-08T00:00:00Z'))
```

**Every** `parseAppleIcs(...)` call in the file must now pass `calendarId, calendarName` as the 2nd/3rd args, with any range as the 4th/5th. That includes the non-recurring tests too: `parseAppleIcs(ALLDAY_ICS, 'cal-url-1', 'Trening')` and `parseAppleIcs('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR', 'cal-url-1', 'Trening')`. For the no-range fallback test use `parseAppleIcs(RECURRING_ICS, 'cal-url-1', 'Trening')`.

- [ ] **Step 11: Run the Apple test to verify it fails**

Run: `npx vitest run lib/calendar/providers/apple.test.ts`
Expected: FAIL — signature mismatch / `calendarId` undefined.

- [ ] **Step 12: Implement Apple parser + fetch threading**

In `lib/calendar/providers/apple.ts`, change `parseAppleIcs` and `buildEvent` to carry identity. New `parseAppleIcs` signature and the `buildEvent` helper:

```ts
function buildEvent(
  source: VEvent,
  start: Date,
  end: Date,
  id: string,
  calendarId: string,
  calendarName: string,
): ExternalEvent {
  const allDay = source.datetype === 'date'
  return {
    id,
    title: source.summary ?? '(No title)',
    start: allDay ? toLocalDateKey(start) : new Date(start).toISOString(),
    end: allDay ? toLocalDateKey(end) : new Date(end).toISOString(),
    allDay,
    provider: 'apple',
    calendarId,
    calendarName,
    location: source.location || undefined,
  }
}

export function parseAppleIcs(
  ics: string,
  calendarId: string,
  calendarName: string,
  rangeStart?: Date,
  rangeEnd?: Date,
): ExternalEvent[] {
  const parsed = nodeIcal.sync.parseICS(ics) as Record<string, VEvent>
  const events: ExternalEvent[] = []
  for (const key of Object.keys(parsed)) {
    const component = parsed[key]
    if (component.type !== 'VEVENT' || !component.start) continue
    const baseId = component.uid ?? key
    const start = component.start
    const end = component.end ?? component.start

    if (component.rrule && rangeStart && rangeEnd) {
      const durationMs = end.getTime() - start.getTime()
      for (const occ of component.rrule.between(rangeStart, rangeEnd, true)) {
        if (isExcluded(component.exdate, occ)) continue
        const override = findOverride(component.recurrences, occ)
        const id = `apple:${baseId}:${occ.toISOString()}`
        if (override?.start) {
          events.push(buildEvent(override, override.start, override.end ?? override.start, id, calendarId, calendarName))
        } else {
          events.push(buildEvent(component, occ, new Date(occ.getTime() + durationMs), id, calendarId, calendarName))
        }
      }
      continue
    }

    events.push(buildEvent(component, start, end, `apple:${baseId}`, calendarId, calendarName))
  }
  return events
}
```

In the same file's `fetchEvents`, pass each calendar's identity into the parser. The calendar loop already has `calendar`; CalDAV calendars expose `url` and `displayName`:

```ts
  for (const calendar of calendars) {
    const calendarId = String(calendar.url)
    const calendarName =
      typeof calendar.displayName === 'string' && calendar.displayName
        ? calendar.displayName
        : 'Calendar'
    const objects = await client.fetchCalendarObjects({
      calendar,
      timeRange: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
    })
    for (const object of objects) {
      if (object.data) {
        events.push(...parseAppleIcs(object.data, calendarId, calendarName, rangeStart, rangeEnd))
      }
    }
  }
```

- [ ] **Step 13: Run the Apple test to verify it passes**

Run: `npx vitest run lib/calendar/providers/apple.test.ts`
Expected: PASS

- [ ] **Step 14: Run the full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests PASS, no type errors. (The gather-events test still passes because it builds its own `event()` objects — update that helper if tsc flags missing `calendarId`/`calendarName`: add `calendarId: provider, calendarName: provider` to the `event()` factory in `lib/calendar/gather-events.test.ts`.)

- [ ] **Step 15: Commit**

```bash
git add lib/calendar/providers
git commit -m "feat: tag external events with calendarId/calendarName"
```

---

### Task 2: Carry calendar identity onto the rendered event type

**Files:**
- Modify: `lib/calendar/range.ts` (`RenderableEvent`, `externalToCalendarEvent`)
- Modify: `app/(app)/calendar/page.tsx` (`CalendarEvent` type)

- [ ] **Step 1: Add fields to `RenderableEvent` and map them**

In `lib/calendar/range.ts`, add `calendarId?: string` and `calendarName?: string` to `RenderableEvent`, and set them in `externalToCalendarEvent`:

```ts
export type RenderableEvent = {
  id: string
  title: string
  start: string
  end: string
  tone: 'violet' | 'emerald' | 'amber' | 'sky'
  kind: 'focus' | 'meeting' | 'launch' | 'deadline'
  note?: string
  external?: boolean
  allDay?: boolean
  provider?: CalendarProvider
  calendarId?: string
  calendarName?: string
}
```

In `externalToCalendarEvent`, add to the returned object:

```ts
    provider: event.provider,
    calendarId: event.calendarId,
    calendarName: event.calendarName,
```

- [ ] **Step 2: Mirror the fields on the page's `CalendarEvent` type**

In `app/(app)/calendar/page.tsx`, add the same two optional fields to the `CalendarEvent` type definition (after `provider?: CalendarProvider`):

```ts
  provider?: CalendarProvider
  calendarId?: string
  calendarName?: string
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the `.map(externalToCalendarEvent)` assignment to `CalendarEvent[]` still matches).

- [ ] **Step 4: Commit**

```bash
git add lib/calendar/range.ts "app/(app)/calendar/page.tsx"
git commit -m "feat: carry calendarId/calendarName onto rendered events"
```

---

### Task 3: Calendar-list + filter helper (pure, tested)

**Files:**
- Create: `lib/calendar/calendar-filter.ts`
- Test: `lib/calendar/calendar-filter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/calendar/calendar-filter.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildCalendarList, filterByCalendars, eventCalendarId } from './calendar-filter'

type E = {
  id: string
  provider?: 'google' | 'apple' | 'microsoft'
  calendarId?: string
  calendarName?: string
}

const events: E[] = [
  { id: 'a', provider: 'apple', calendarId: 'url-trening', calendarName: 'Trening' },
  { id: 'b', provider: 'apple', calendarId: 'url-jobb', calendarName: 'Jobb' },
  { id: 'c', provider: 'google', calendarId: 'primary', calendarName: 'Primary' },
  { id: 'd' }, // local Sync block
]

describe('eventCalendarId', () => {
  it('uses calendarId for external and "sync" for local', () => {
    expect(eventCalendarId(events[0])).toBe('url-trening')
    expect(eventCalendarId(events[3])).toBe('sync')
  })
})

describe('buildCalendarList', () => {
  it('lists distinct calendars grouped sync→google→apple, sorted by name', () => {
    const list = buildCalendarList(events)
    expect(list.map((c) => c.id)).toEqual(['sync', 'primary', 'url-jobb', 'url-trening'])
    expect(list.map((c) => c.source)).toEqual(['sync', 'google', 'apple', 'apple'])
    expect(list.find((c) => c.id === 'sync')?.name).toBe('Sync blocks')
  })

  it('assigns a stable colour per calendar id regardless of order', () => {
    const a = buildCalendarList(events)
    const b = buildCalendarList([...events].reverse())
    const colorOf = (list: ReturnType<typeof buildCalendarList>, id: string) =>
      list.find((c) => c.id === id)?.color
    expect(colorOf(a, 'url-trening')).toBe(colorOf(b, 'url-trening'))
  })
})

describe('filterByCalendars', () => {
  it('drops events whose calendar is hidden', () => {
    const out = filterByCalendars(events, new Set(['url-trening', 'sync']))
    expect(out.map((e) => e.id)).toEqual(['b', 'c'])
  })

  it('keeps everything when nothing is hidden', () => {
    expect(filterByCalendars(events, new Set())).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/calendar/calendar-filter.test.ts`
Expected: FAIL — `Cannot find module './calendar-filter'`.

- [ ] **Step 3: Implement the helper**

Create `lib/calendar/calendar-filter.ts`:

```ts
import type { CalendarProvider } from './providers/types'

export type CalendarSource = 'sync' | CalendarProvider

export type CalendarEntry = {
  id: string
  name: string
  source: CalendarSource
  color: string
}

type FilterableEvent = {
  provider?: CalendarProvider
  calendarId?: string
  calendarName?: string
}

const SOURCE_ORDER: Record<CalendarSource, number> = {
  sync: 0,
  google: 1,
  apple: 2,
  microsoft: 3,
}

const SOURCE_FALLBACK_NAME: Record<CalendarSource, string> = {
  sync: 'Sync blocks',
  google: 'Google',
  apple: 'Apple',
  microsoft: 'Outlook',
}

// Distinct, readable dot colours. Picked by a stable hash of the calendar id.
const PALETTE = ['#a78bfa', '#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#22d3ee', '#fb7185', '#a3e635']

function hashColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export function eventSource(event: FilterableEvent): CalendarSource {
  return event.provider ?? 'sync'
}

export function eventCalendarId(event: FilterableEvent): string {
  return event.provider ? event.calendarId ?? `${event.provider}:primary` : 'sync'
}

export function buildCalendarList(events: FilterableEvent[]): CalendarEntry[] {
  const byId = new Map<string, CalendarEntry>()
  for (const event of events) {
    const id = eventCalendarId(event)
    if (byId.has(id)) continue
    const source = eventSource(event)
    const name = event.provider
      ? event.calendarName ?? SOURCE_FALLBACK_NAME[source]
      : SOURCE_FALLBACK_NAME.sync
    byId.set(id, { id, name, source, color: hashColor(id) })
  }
  return [...byId.values()].sort((a, b) =>
    SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] || a.name.localeCompare(b.name),
  )
}

export function filterByCalendars<T extends FilterableEvent>(
  events: T[],
  hiddenIds: Set<string>,
): T[] {
  if (hiddenIds.size === 0) return events
  return events.filter((event) => !hiddenIds.has(eventCalendarId(event)))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/calendar/calendar-filter.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/calendar-filter.ts lib/calendar/calendar-filter.test.ts
git commit -m "feat: add calendar list + filter helper"
```

---

### Task 4: Wire filter state into the calendar page

**Files:**
- Modify: `app/(app)/calendar/page.tsx`

- [ ] **Step 1: Add imports + state**

Near the other `lib/calendar` imports in `app/(app)/calendar/page.tsx`, add:

```ts
import { buildCalendarList, filterByCalendars } from '@/lib/calendar/calendar-filter'
```

Add a storage key constant next to `STORAGE_KEY`:

```ts
const HIDDEN_CALENDARS_KEY = 'sync-calendar-hidden-calendars'
```

Add state inside `CalendarPage` (next to the other `useState` calls):

```ts
  const [hiddenCalendarIds, setHiddenCalendarIds] = useState<Set<string>>(new Set())
```

- [ ] **Step 2: Load + persist hidden set**

In the existing mount `useEffect` (the `queueMicrotask` block that reads `STORAGE_KEY`), after the events load, add:

```ts
      const rawHidden = window.localStorage.getItem(HIDDEN_CALENDARS_KEY)
      if (rawHidden) {
        try {
          const parsed = JSON.parse(rawHidden) as string[]
          if (Array.isArray(parsed)) setHiddenCalendarIds(new Set(parsed))
        } catch {}
      }
```

Add a persistence effect next to the events-persist effect:

```ts
  useEffect(() => {
    window.localStorage.setItem(HIDDEN_CALENDARS_KEY, JSON.stringify([...hiddenCalendarIds]))
  }, [hiddenCalendarIds])
```

- [ ] **Step 3: Derive the calendar list and apply the filter**

Add a memo for the calendar list built from ALL loaded events (so hidden calendars still show a row):

```ts
  const calendarList = useMemo(
    () => buildCalendarList([...events, ...externalEvents]),
    [events, externalEvents],
  )
```

Change `filteredEvents` so the calendar filter runs before search (covers grid + search):

```ts
  const filteredEvents = useMemo(
    () =>
      filterByCalendars([...events, ...externalEvents], hiddenCalendarIds).filter((event) =>
        eventMatches(event, searchQuery),
      ),
    [events, externalEvents, searchQuery, hiddenCalendarIds],
  )
```

- [ ] **Step 4: Add toggle handlers**

Add these functions inside the component (near other handlers):

```ts
  function toggleCalendar(id: string) {
    setHiddenCalendarIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function showAllCalendars() {
    setHiddenCalendarIds(new Set())
  }

  function hideAllCalendars() {
    setHiddenCalendarIds(new Set(calendarList.map((c) => c.id)))
  }
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`monthEvents` may now be reported unused once Task 5 removes the pulse card — that is handled there. If eslint blocks this commit because the new `toggleCalendar`/`showAllCalendars`/`hideAllCalendars` handlers are not referenced until Task 5, fold this commit into the end of Task 5 instead.)

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/calendar/page.tsx"
git commit -m "feat: per-calendar filter state on the calendar page"
```

---

### Task 5: Replace "Calendar pulse" with the Calendars filter panel

**Files:**
- Modify: `app/(app)/calendar/page.tsx`

- [ ] **Step 1: Remove the Calendar pulse section**

In the `<aside>`, delete the entire `<section>` that renders "Calendar pulse" (the card containing `<CalendarDays>`, the `{monthEvents.length} visible blocks this month` text, and the two `<Metric>` calls).

- [ ] **Step 2: Add the Calendars panel in its place**

Insert this `<section>` as the first child of the `<aside>`:

```tsx
            <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Calendars</h3>
                <button
                  type="button"
                  onClick={() => setManageOpen(true)}
                  className="flex items-center gap-1 text-xs text-gray-500 transition hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-300"
                >
                  <Settings size={13} /> Manage
                </button>
              </div>

              {calendarList.length === 0 ? (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  No events to filter yet.
                </p>
              ) : (
                <>
                  <div className="mt-3 space-y-3">
                    {(['sync', 'google', 'apple', 'microsoft'] as const).map((source) => {
                      const rows = calendarList.filter((c) => c.source === source)
                      if (rows.length === 0) return null
                      return (
                        <div key={source}>
                          {source !== 'sync' && (
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                              {source === 'google' ? 'Google' : source === 'apple' ? 'Apple' : 'Outlook'}
                            </p>
                          )}
                          {rows.map((cal) => {
                            const visible = !hiddenCalendarIds.has(cal.id)
                            return (
                              <label key={cal.id} className="flex cursor-pointer items-center gap-2 py-1">
                                <input
                                  type="checkbox"
                                  checked={visible}
                                  onChange={() => toggleCalendar(cal.id)}
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cal.color }} />
                                <span className="truncate text-sm text-gray-700 dark:text-gray-200">{cal.name}</span>
                              </label>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex gap-3 border-t border-gray-100 pt-2 text-xs dark:border-gray-800">
                    <button type="button" onClick={showAllCalendars} className="text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-300">
                      Show all
                    </button>
                    <button type="button" onClick={hideAllCalendars} className="text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-300">
                      Hide all
                    </button>
                  </div>
                </>
              )}
            </section>
```

- [ ] **Step 3: Add the `Settings` icon import + `manageOpen` state**

In the `lucide-react` import block add `Settings,` (keep alphabetical-ish order). Add state near the other modal flags:

```ts
  const [manageOpen, setManageOpen] = useState(false)
```

(`setManageOpen` is consumed here and the modal is added in Task 6.)

- [ ] **Step 4: Remove the now-unused `Metric` component and `monthEvents` if unused**

Search the file for `Metric` — if its only remaining references were the deleted pulse card, delete the `Metric` function definition. Search for `monthEvents` — if unused after the pulse removal, delete its `useMemo`. Leave them if still referenced elsewhere.

- [ ] **Step 5: Typecheck + lint + build**

Run: `npx tsc --noEmit && npx eslint "app/(app)/calendar/page.tsx" && npm run build`
Expected: clean typecheck, no lint errors, `✓ Compiled successfully`. (Build will still pass even though the Manage modal isn't wired yet — `manageOpen` is set but only read in Task 6; if eslint flags `manageOpen`/`setManageOpen` as unused, proceed to Task 6 before committing.)

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/calendar/page.tsx"
git commit -m "feat: replace calendar pulse with the Calendars filter panel"
```

---

### Task 6: Move connect/disconnect into a Manage modal; remove inline external panel

**Files:**
- Modify: `app/(app)/calendar/page.tsx`

- [ ] **Step 1: Delete the inline "Add external calendars" section**

Remove the entire `<section>` containing the "Add external calendars" checkbox `<label>` and its `{externalOpen && (...)}` block (the Refresh button, provider-error notices, and the per-provider connect/disconnect cards).

- [ ] **Step 2: Add a Manage modal with that content**

Add this `Modal` near the end of the returned JSX (alongside the existing Apple-credentials modal). It reuses the existing handlers `fetchExternalEvents`, `externalLoading`, `providerErrors`, `providerMeta`, `providerStatus`, `disconnectProvider`, `connectProvider`:

```tsx
      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Manage calendars">
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="secondary" onClick={() => void fetchExternalEvents()} loading={externalLoading}>
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
            const status = providerStatus(provider)
            return (
              <div key={provider} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {providerMeta[provider].label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {status?.connected ? status.account ?? 'Connected' : providerMeta[provider].description}
                    </p>
                  </div>
                  {status?.connected && <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />}
                </div>
                <div className="mt-3 flex gap-2">
                  {status?.connected ? (
                    <Button type="button" size="sm" variant="secondary" className="w-full" onClick={() => void disconnectProvider(provider)}>
                      Disconnect
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="secondary" className="w-full" onClick={() => connectProvider(provider)}>
                      {provider === 'apple' && <Apple size={14} />}
                      {providerMeta[provider].button}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>
```

- [ ] **Step 3: Remove the now-unused `externalOpen` state**

The inline panel was the only consumer of `externalOpen`/`setExternalOpen`. Two call sites remain in the mount effect: `if (params.get('calendar_connected')) setExternalOpen(true)`. Replace that line with `if (params.get('calendar_connected')) setManageOpen(true)` so a fresh connection opens the Manage modal, then delete the `externalOpen` state declaration.

- [ ] **Step 4: Typecheck + lint + build**

Run: `npx tsc --noEmit && npx eslint "app/(app)/calendar/page.tsx" && npm run build`
Expected: clean. Confirm no unused-var warnings for `externalOpen`, `manageOpen`.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/calendar/page.tsx"
git commit -m "feat: move calendar connect/disconnect into a Manage modal"
```

---

### Task 7: Remove mock seed events + purge persisted copies

**Files:**
- Modify: `app/(app)/calendar/page.tsx`

- [ ] **Step 1: Empty the seed array**

Replace the `seedEvents` array contents with an empty array:

```ts
const seedEvents: CalendarEvent[] = []
```

- [ ] **Step 2: Purge previously-persisted seed ids on load**

In the mount `useEffect`, where events are read from `STORAGE_KEY`, filter out the known seed ids before setting state:

```ts
      const rawEvents = window.localStorage.getItem(STORAGE_KEY)
      if (rawEvents) {
        try {
          const parsed = JSON.parse(rawEvents) as CalendarEvent[]
          const SEED_IDS = new Set(['cal-1', 'cal-2', 'cal-3', 'cal-4'])
          const cleaned = Array.isArray(parsed) ? parsed.filter((e) => !SEED_IDS.has(e.id)) : []
          if (cleaned.length > 0) setEvents(cleaned)
          else setEvents([])
        } catch {}
      }
```

- [ ] **Step 3: Typecheck + lint + build + full test suite**

Run: `npx tsc --noEmit && npx eslint "app/(app)/calendar/page.tsx" && npm run build && npx vitest run`
Expected: all clean, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/calendar/page.tsx"
git commit -m "chore: remove mock seed calendar events and purge saved copies"
```

---

### Task 8: Final verification + push

- [ ] **Step 1: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npx eslint "app/(app)/calendar/page.tsx" lib/calendar && npm run build`
Expected: all tests pass, no type/lint errors, build compiles.

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Manual smoke test after Netlify deploy**

- Calendars panel lists Sync + Google + each Apple calendar by name, each with a coloured dot.
- Unticking "Trening" hides the workouts from both the grid and Search; re-ticking restores them; the choice survives a reload.
- "Show all / Hide all" works.
- "⚙ Manage" opens the modal; connect/disconnect/refresh still work; provider errors appear there.
- The four mock blocks (Sprint planning, Ship unread badge, Deep work, Feedback review) are gone.
- Top toolbar and Notes are unchanged; dragging an event between days still works.
```
