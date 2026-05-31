# Edit & Delete Calendar Blocks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user edit and delete their own local calendar blocks by clicking a block to open the existing event modal in an "edit" mode (pre-filled, with Save changes + a two-step Delete), while external Google/Apple blocks stay read-only.

**Architecture:** Extract the event-list mutations into a tiny tested pure helper (`upsertEvent`/`removeEvent`), then wire edit/delete into the existing modal on `app/(app)/calendar/page.tsx` via an `editingId` + `confirmDelete` state. Clicking a local block opens edit in both month (`renderEventPill`) and week/day (`TimelineColumn`) views.

**Tech Stack:** Next.js 16 (App Router), React, TypeScript, Tailwind, Vitest. Spec: `docs/superpowers/specs/2026-05-31-calendar-edit-delete-blocks-design.md`.

---

### Task 1: Pure event-mutation helper

**Files:**
- Create: `lib/calendar/event-mutations.ts`
- Test: `lib/calendar/event-mutations.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/calendar/event-mutations.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { upsertEvent, removeEvent } from './event-mutations'

type E = { id: string; start: string; title?: string }
const a: E = { id: 'a', start: '2026-05-12T09:00:00', title: 'A' }
const b: E = { id: 'b', start: '2026-05-12T11:00:00', title: 'B' }

describe('upsertEvent', () => {
  it('appends a new event and returns the list sorted by start', () => {
    const out = upsertEvent([b], a)
    expect(out.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('replaces an existing event by id and re-sorts', () => {
    const out = upsertEvent([a, b], { id: 'a', start: '2026-05-12T12:00:00', title: 'A2' })
    expect(out).toHaveLength(2)
    expect(out.map((e) => e.id)).toEqual(['b', 'a'])
    expect(out.find((e) => e.id === 'a')?.title).toBe('A2')
  })
})

describe('removeEvent', () => {
  it('removes the matching id', () => {
    expect(removeEvent([a, b], 'a').map((e) => e.id)).toEqual(['b'])
  })

  it('leaves the list unchanged when the id is not found', () => {
    expect(removeEvent([a, b], 'z').map((e) => e.id)).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/calendar/event-mutations.test.ts`
Expected: FAIL — `Cannot find module './event-mutations'`.

- [ ] **Step 3: Implement the helper**

Create `lib/calendar/event-mutations.ts`:

```ts
// Pure list operations for local calendar blocks. Generic over { id, start } so
// they don't depend on the page's CalendarEvent type.

export function upsertEvent<T extends { id: string; start: string }>(
  events: T[],
  event: T,
): T[] {
  const exists = events.some((e) => e.id === event.id)
  const next = exists
    ? events.map((e) => (e.id === event.id ? event : e))
    : [...events, event]
  return next.sort((a, b) => +new Date(a.start) - +new Date(b.start))
}

export function removeEvent<T extends { id: string }>(events: T[], id: string): T[] {
  return events.filter((e) => e.id !== id)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/calendar/event-mutations.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/event-mutations.ts lib/calendar/event-mutations.test.ts
git commit -m "feat: add upsertEvent/removeEvent helper for calendar blocks"
```

---

### Task 2: Wire edit & delete into the calendar page

**Files:**
- Modify: `app/(app)/calendar/page.tsx`

All edits are in this one file. Read the file first to locate each anchor.

- [ ] **Step 1: Import the helper**

Near the other `@/lib/calendar` imports, add:

```ts
import { upsertEvent, removeEvent } from '@/lib/calendar/event-mutations'
```

- [ ] **Step 2: Add edit/delete state**

Right after the `eventKind` state declaration (`const [eventKind, setEventKind] = useState<CalendarEvent['kind']>('meeting')`), add:

```ts
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
```

- [ ] **Step 3: Reset edit state in `openCreateModal`**

Replace the existing `openCreateModal` function with this (adds the two resets at the top):

```ts
  function openCreateModal(day: Date, time = '09:00') {
    setEditingId(null)
    setConfirmDelete(false)
    setEventTitle('')
    setEventStart(time)
    setEventEnd(endTimeFor(time))
    setEventKind('meeting')
    setCreateTarget({ date: new Date(day.getFullYear(), day.getMonth(), day.getDate()), time })
    setViewDate(day)
  }
```

- [ ] **Step 4: Add `openEditModal`, `closeEventModal`, `deleteCurrentEvent`**

Immediately after `openCreateModal`, add these three functions. (`pad` is an existing module-level helper that zero-pads numbers.)

```ts
  function openEditModal(calendarEvent: CalendarEvent) {
    if (calendarEvent.external) return
    const startDate = new Date(calendarEvent.start)
    const endDate = new Date(calendarEvent.end)
    const time = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`
    setEditingId(calendarEvent.id)
    setConfirmDelete(false)
    setEventTitle(calendarEvent.title)
    setEventStart(time)
    setEventEnd(`${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`)
    setEventKind(calendarEvent.kind)
    setCreateTarget({
      date: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()),
      time,
    })
  }

  function closeEventModal() {
    setCreateTarget(null)
    setEditingId(null)
    setConfirmDelete(false)
  }

  function deleteCurrentEvent() {
    if (!editingId) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setEvents((prev) => removeEvent(prev, editingId))
    closeEventModal()
  }
```

- [ ] **Step 5: Branch `saveEvent` for edit vs create**

Replace the existing `saveEvent` function with:

```ts
  function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!createTarget || !eventTitle.trim()) return
    const selectedKind = kindOptions.find((option) => option.kind === eventKind) ?? kindOptions[0]
    const start = dateWithTime(createTarget.date, eventStart)
    const end = dateWithTime(createTarget.date, eventEnd)
    if (+end <= +start) end.setHours(start.getHours() + 1, start.getMinutes())

    if (editingId) {
      const existing = events.find((e) => e.id === editingId)
      const updated: CalendarEvent = {
        ...existing,
        id: editingId,
        title: eventTitle.trim(),
        start: localDateTimeString(start),
        end: localDateTimeString(end),
        tone: selectedKind.tone,
        kind: selectedKind.kind,
      }
      setEvents((prev) => upsertEvent(prev, updated))
    } else {
      const newEvent: CalendarEvent = {
        id: `cal-${Date.now()}`,
        title: eventTitle.trim(),
        start: localDateTimeString(start),
        end: localDateTimeString(end),
        tone: selectedKind.tone,
        kind: selectedKind.kind,
      }
      setEvents((prev) => upsertEvent(prev, newEvent))
    }
    closeEventModal()
  }
```

- [ ] **Step 6: Update the modal (title, footer, delete button)**

In the `<Modal open={Boolean(createTarget)} ...>` block (the "Create event" modal), make three changes:

(a) Change the opening tag to use the dynamic title and the new close handler:

```tsx
      <Modal open={Boolean(createTarget)} onClose={closeEventModal} title={editingId ? 'Edit event' : 'Create event'}>
```

(b) Replace the footer `<div className="flex justify-end gap-2 pt-2"> ... </div>` (the one holding Cancel + the submit button) with:

```tsx
          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {editingId && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={deleteCurrentEvent}
                  className={confirmDelete ? 'text-red-600 dark:text-red-400' : ''}
                >
                  {confirmDelete ? 'Confirm delete?' : 'Delete'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={closeEventModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={!eventTitle.trim()}>
                {editingId ? 'Save changes' : 'Save event'}
              </Button>
            </div>
          </div>
```

- [ ] **Step 7: Open edit on click in month view (`renderEventPill`)**

In `renderEventPill`, replace the pill's `onClick={(clickEvent) => clickEvent.stopPropagation()}` with:

```tsx
        onClick={(clickEvent) => {
          clickEvent.stopPropagation()
          if (!event.external) openEditModal(event)
        }}
```

- [ ] **Step 8: Add `onEventClick` to `TimelineColumn` and wire the blocks**

In the `TimelineColumn` function component:

(a) Add `onEventClick` to the destructured props and the props type:

```tsx
function TimelineColumn({
  day,
  events,
  onCreate,
  onDropTask,
  onEventClick,
}: {
  day: Date
  events: CalendarEvent[]
  onCreate: (day: Date, time?: string) => void
  onDropTask: (event: DragEvent<HTMLElement>, day: Date, preferredHour: number) => void
  onEventClick: (event: CalendarEvent) => void
}) {
```

(b) On the timed-event block `<div key={event.id} className={...} style={...}>`, add an `onClick` and a cursor class. Replace that `<div ...>` opening tag with:

```tsx
            <div
              key={event.id}
              onClick={(e) => {
                e.stopPropagation()
                if (!event.external) onEventClick(event)
              }}
              className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md px-2 py-1 text-[11px] ring-1 ${event.external ? 'cursor-default' : 'cursor-pointer'} ${toneClasses(event.tone)}`}
              style={{ top: position.top + 2, height: Math.max(22, position.height - 4) }}
            >
```

(c) On the all-day block `<div key={event.id} className={...} style={...}>`, add the same guarded `onClick`. Replace that opening tag with:

```tsx
          <div
            key={event.id}
            onClick={(e) => {
              e.stopPropagation()
              if (!event.external) onEventClick(event)
            }}
            className={`absolute left-1 right-1 z-20 overflow-hidden rounded-md px-2 py-0.5 text-[11px] ring-1 ${toneClasses(event.tone)}`}
            style={{ top: 1 + index * 20, height: 18 }}
          >
```

- [ ] **Step 9: Pass `onEventClick` from both `TimelineColumn` usages**

There are two `<TimelineColumn ... />` usages (week view inside a map, and day view). Add `onEventClick={openEditModal}` to BOTH (alongside the existing `onCreate`/`onDropTask`/`events`/`day` props).

- [ ] **Step 10: Verify the full gate**

Run: `npx tsc --noEmit && npx eslint "app/(app)/calendar/page.tsx" && npx vitest run && npm run build`
Expected: clean typecheck, no eslint errors/warnings, all tests pass, `✓ Compiled successfully`.

- [ ] **Step 11: Commit**

```bash
git add "app/(app)/calendar/page.tsx"
git commit -m "feat: edit and delete local calendar blocks via the event modal"
```

---

### Task 3: Final verification + ship

- [ ] **Step 1: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npx eslint "app/(app)/calendar/page.tsx" lib/calendar && npm run build`
Expected: all tests pass, no type/lint errors, build compiles.

- [ ] **Step 2: Manual smoke test after deploy**

- Clicking a local Sync block opens the modal titled "Edit event", pre-filled with its title/time/type.
- Changing the time and pressing "Save changes" updates the block in place (no duplicate).
- The Delete button shows "Delete", then "Confirm delete?" on first click, and removes the block on the second click.
- Cancel / closing the modal leaves the block unchanged and resets the delete confirm.
- Clicking a Google/Apple block does nothing.
- Dragging a block to another day (month view) still works.
- Edits/deletes survive a page reload (localStorage).
- Works in Month, Week, and Day views.
