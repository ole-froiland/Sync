# Edit & delete calendar blocks

**Date:** 2026-05-31
**Status:** Approved (design)

## Goal

Let the user edit or delete their own (local "Sync") calendar blocks. Today a
block can be created (Add block / click an empty slot) but clicking an existing
block does nothing, so there is no way to fix a typo, change a time, or remove a
block.

## Non-goals

- External Google/Apple/Outlook events stay **read-only** — clicking them does
  nothing (unchanged).
- No date picker in the modal. The block stays on its day; moving it to another
  day is done by dragging (month view), which already works.
- No change to the toolbar, Notes panel, the Calendars filter, or external
  events.

## Design overview

Reuse the existing event modal in two modes — **create** (as today) and
**edit**. Clicking a local block opens the modal pre-filled with that block's
title, start, end, and type. The user changes fields and presses **Save
changes**, or presses **Delete** (a two-step confirm) to remove it.

### Interaction

- **Open edit:** clicking a local block opens the modal in edit mode. Clicking
  an external block does nothing (keep the current `stopPropagation`-only
  behavior). This applies in all three views — month (`renderEventPill`) and
  week/day (`TimelineColumn`).
- **Edit:** the modal shows the same four fields as create — title, start time,
  end time, type (Focus/Meeting/Launch/Deadline) — pre-filled from the block.
  Header reads "Edit event"; primary button reads "Save changes".
- **Delete:** a destructive-styled **Delete** button appears only in edit mode,
  on the left of the modal footer. First click changes its label to "Confirm
  delete?"; second click removes the block and closes the modal. Closing or
  reopening the modal resets this confirm state.

### Components and data flow

**1. Pure event-mutation helper** — `lib/calendar/event-mutations.ts`
(tested, mirrors how `calendar-filter.ts` is structured):
- `upsertEvent<T extends { id: string; start: string }>(events: T[], event: T): T[]`
  — replaces the event with the same `id` if present, otherwise appends; result
  sorted ascending by `start`.
- `removeEvent<T extends { id: string }>(events: T[], id: string): T[]` — returns
  events without the one matching `id`.

Generic over `{ id, start }` so it does not depend on the page's `CalendarEvent`
type.

**2. Calendar page state** — `app/(app)/calendar/page.tsx`
- New state: `editingId: string | null` (which block is being edited; `null` =
  create mode) and `confirmDelete: boolean`.
- `openCreateModal(day, time)` also resets `editingId = null` and
  `confirmDelete = false` (clean create mode).
- New `openEditModal(event)`: sets `editingId = event.id`, pre-fills
  `eventTitle/eventStart/eventEnd/eventKind` from the event (times formatted
  `HH:MM`), sets `createTarget` to the event's day + start time (so the modal
  opens with the correct date context), and resets `confirmDelete`.
- `saveEvent` branches: when `editingId` is set, build the updated event by
  spreading the existing event (to preserve fields like `note`) and overriding
  `title/start/end/tone/kind`, then `setEvents(prev => upsertEvent(prev, updated))`;
  otherwise create a new event and `upsertEvent` (append). Both paths keep the
  existing time-sanity guard (`end <= start` bumps end by an hour).
- New `deleteCurrentEvent()`: if `confirmDelete` is false, set it true and
  return; otherwise `setEvents(prev => removeEvent(prev, editingId))` and close.
- `closeEventModal()`: resets `createTarget = null`, `editingId = null`,
  `confirmDelete = false`. Used by the modal's Close/Cancel and after save/delete.
- Events still persist to `localStorage` via the existing effect on `events`.

**3. Click wiring**
- `renderEventPill` (month): change the pill `onClick` to
  `(e) => { e.stopPropagation(); if (!event.external) openEditModal(event) }`.
- `TimelineColumn` (week/day): add an optional `onEventClick?: (event) => void`
  prop; the page passes `openEditModal`. The timed event block (and the all-day
  block) call `onEventClick(event)` on click with `stopPropagation`, guarded so
  external events do nothing. (The drag handlers and `onCreate` slot behavior are
  unchanged.)

**4. Modal JSX**
- Title: `editingId ? 'Edit event' : 'Create event'`.
- Primary submit button label: `editingId ? 'Save changes' : 'Add'` (keep
  current create label).
- Delete button rendered only when `editingId` is set, left-aligned in the
  footer, red/destructive style, label `confirmDelete ? 'Confirm delete?' : 'Delete'`,
  `onClick={deleteCurrentEvent}`.
- The modal's `onClose` and the Cancel button call `closeEventModal()`.

## Error / edge handling

- Empty title still blocks save (existing guard).
- Editing never changes an event's `id`, so its calendar identity (`sync`) and
  filter behavior are unaffected.
- External events can never reach edit/delete (guarded at every click site).

## Testing

- Unit-test the pure helper (`lib/calendar/event-mutations.test.ts`):
  - `upsertEvent` appends a new id, replaces an existing id in place, and keeps
    the result sorted by `start`.
  - `removeEvent` removes the matching id and leaves others untouched.
- Manual smoke after deploy: click a Sync block → modal pre-filled → change time
  → Save updates it; Delete (two clicks) removes it; clicking a Google/Apple
  block does nothing; drag-to-move-day still works; refresh persists changes.
