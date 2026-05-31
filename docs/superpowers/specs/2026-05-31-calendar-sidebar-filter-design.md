# Calendar sidebar redesign: per-calendar filtering

**Date:** 2026-05-31
**Status:** Approved (design)

## Goal

Make the calendar page tidier and filterable without changing the parts the user
already likes (the top toolbar and the Notes panel). Specifically:

1. Remove the **Calendar pulse** card (Focus/Meetings counts) — not wanted.
2. Shrink the **Add external calendars** panel — it is useful but takes too much
   vertical space sitting open in the sidebar.
3. Add **filtering** so the user can show/hide events by calendar — e.g. "only
   Google" or "only the Trening (workout) calendar".
4. Remove the **mock seed events** (Sprint planning, Ship unread badge, Deep
   work, Feedback review) and purge them from saved data.

## Non-goals

- No change to the top toolbar (search, Month/Week/Day, Today, nav, Add block).
- No change to the Notes panel.
- No change to event rendering or drag-to-move-between-days.
- Real per-provider calendar colours and Google multi-calendar fetching are
  **future enhancements**, not part of this work (see Open/Deferred below).

## Design overview

Replace the two top sidebar cards (Calendar pulse + Add external calendars) with
a single **Calendars** panel that does both filtering and connection management.
Notes stays below it, unchanged.

```
┌─ Calendars ───────────── ⚙ Manage ─┐
│ ☑ ● Sync blocks                     │
│ Google                              │
│  ☑ ● Primary                        │
│ Apple                               │
│  ☑ ● Trening                        │
│  ☑ ● Jobb                           │
│  ☑ ● Privat                         │
│ ─ Show all · Hide all ─             │
└─────────────────────────────────────┘
┌─ Notes (unchanged) ─────────────────┐
```

- Each calendar is a row: colour dot + name + checkbox.
- Calendars are grouped by source: **Sync** (local blocks), then **Google**,
  **Apple**, **Microsoft** — only groups that have events in the current view
  appear. Within a group, rows are sorted by name.
- Unchecking a calendar hides its events **everywhere** — both the grid and the
  Search results (a hidden calendar is fully "off").
- "Show all / Hide all" toggles every calendar at once.
- **⚙ Manage** opens a modal containing today's connect / disconnect / refresh
  controls (moved out of the always-open inline panel). Provider errors (the
  amber per-provider notices) also live in this modal.
- Filtering is purely client-side over already-fetched events — no re-fetch when
  toggling.

## Components and data flow

### 1. Calendar identity on events

Extend the event data so every event knows which calendar it belongs to.

`ExternalEvent` (in `lib/calendar/providers/types.ts`) gains:
- `calendarId: string` — stable key used for filter state.
- `calendarName: string` — display label.

Adapters populate them:
- **Apple** (`apple.ts`): already iterates `client.fetchCalendars()`. Use each
  calendar's `url` as `calendarId` and `displayName` as `calendarName`; thread
  them into `parseAppleIcs` so every parsed event is tagged.
- **Google** (`google.ts`): single `primary` calendar for now —
  `calendarId: 'primary'`, `calendarName` from the calendar's `summary` if
  available, else `'Google'`.
- **Microsoft** (`microsoft.ts`): `calendarId: 'primary'`,
  `calendarName: 'Outlook'`.

`externalToCalendarEvent` (in `lib/calendar/range.ts`) carries `calendarId` and
`calendarName` onto the UI `CalendarEvent`.

Local Sync events get a synthetic identity at read time: `calendarId: 'sync'`,
`calendarName: 'Sync blocks'`, `source: 'sync'`. (Stored local events do not need
new persisted fields; the identity is assigned when building the calendar list
and when filtering.)

A derived `source` for each event = `provider ?? 'sync'`.

### 2. Calendar list + filter state (calendar page)

- Derive the **available calendars** from the currently loaded events: distinct
  by `calendarId`, each with `{ id, name, source, color }`. Colour is assigned
  deterministically from a small fixed palette keyed by `calendarId` (stable
  across renders). Group/sort as described above.
- `hiddenCalendarIds: Set<string>`, persisted to `localStorage`
  (`sync-calendar-hidden-calendars`). New/unknown calendars default to visible.
- `filteredEvents` excludes events whose `calendarId` is in `hiddenCalendarIds`,
  applied **before** the search filter so both grid and search respect it.

### 3. Sidebar UI

- Remove the Calendar pulse `<section>` and the `Metric` usage there (and the
  `Metric` component if it becomes unused).
- Remove the inline "Add external calendars" checkbox panel.
- Add a **Calendars** `<section>`: the grouped checkbox list + Show all/Hide all
  + a "⚙ Manage" button.
- Add a **Manage calendars** `Modal` holding the existing connect/disconnect/
  refresh UI and provider-error notices (reuse the current markup/handlers:
  `connectProvider`, `disconnectProvider`, `fetchExternalEvents`,
  `providerStatuses`, `providerErrors`).

### 4. Mock-data removal

- `seedEvents` becomes `[]` (new users start empty).
- One-time purge on load: drop any persisted events whose id is one of the known
  seed ids (`cal-1`, `cal-2`, `cal-3`, `cal-4`) so the user's existing saved
  copies disappear. Real user-created events (timestamp-based ids) are untouched.

## Testing

- Unit-test the pure pieces (the project's pattern — test helpers, not the page):
  - Apple adapter tags events with `calendarId`/`calendarName` per source
    calendar (extend `apple.test.ts`).
  - A `buildCalendarList(events)` helper: groups/sorts sources correctly and
    assigns stable colours — new small tested helper in `lib/calendar/`.
  - A `filterByCalendars(events, hiddenIds)` helper: hides only matching
    calendars; unknown ids default visible.
- Manual check after deploy: toggling Trening hides workouts in grid + search;
  Manage modal connect/disconnect still works; seed blocks are gone.

## Open / deferred (future, not this work)

- Real provider calendar colours (Apple `calendar-color`, Google
  `backgroundColor`) instead of the assigned palette.
- Google multi-calendar (list `calendarList`, fetch per calendar) so Google also
  splits into named sub-calendars.
- Showing connected calendars that currently have zero events in view (the list
  is derived from loaded events, so an empty calendar shows no row).
