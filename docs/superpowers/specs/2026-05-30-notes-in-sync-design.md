# Notes in Sync — Design

## Background

The user maintains a separate vanilla-JS PWA ("Notat-siden") at `notatappen.netlify.app` for quick, on-the-go note capture. It uses `localStorage`, has a phone shortcut, and follows a simple flow: type a note, check it off when done, see completed notes in a history modal.

The Sync app (this repo) has a calendar page with an "Upcoming" sidebar panel that the user does not need — they already see upcoming events in the main calendar grid.

**Goal:** Build a notes feature inside Sync that (a) replaces the unused "Upcoming" panel in the calendar and (b) is also available as a standalone, mobile-friendly route so the user can replace their existing phone shortcut. Notes are stored per-user in Supabase and sync in real time across devices/tabs.

The user creates calendar events manually as before. Notes and events are parallel — there is no automatic linking, no drag-to-schedule. The notes panel is a parallel to-do list visible alongside the calendar.

## Scope

**In scope:**
- New `notes` table in Supabase with RLS, real-time enabled
- Shared `<NotesPanel>` component used in two places:
  - Embedded in the calendar page, replacing the "Upcoming" section
  - Rendered fullscreen on a new `/notes` route, mobile-optimized
- Create, check-off (→ history), and delete notes
- History modal showing completed notes with `created_at` and `completed_at`
- Real-time sync via Supabase Realtime so changes propagate to all open clients

**Out of scope:**
- Migrating notes from the existing `notatappen.netlify.app` localStorage (fresh start, confirmed)
- Decommissioning the existing standalone PWA (it stays as-is, just unused)
- Linking notes to calendar events
- Drag-and-drop from notes onto calendar slots
- Note categories, tags, search, ordering beyond newest-first
- Rich text, attachments, reminders
- Sharing notes with other users

## Data model

New Supabase migration: `supabase/migrations/20260530_notes.sql`

```sql
create table if not exists public.notes (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  title         text        not null check (char_length(title) > 0),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  updated_at    timestamptz not null default now()
);

create index notes_user_active_idx
  on public.notes (user_id, created_at desc)
  where completed_at is null;

create index notes_user_completed_idx
  on public.notes (user_id, completed_at desc)
  where completed_at is not null;
```

- RLS enabled. Policies: `auth.uid() = user_id` for select/insert/update/delete.
- `updated_at` trigger reuses the existing `public.set_updated_at()` function from the calendar-connections migration.
- Realtime publication: add `public.notes` to the `supabase_realtime` publication so postgres_changes events stream to clients.

**Active vs. history:** A note is "active" while `completed_at is null` and in "history" once `completed_at` is set. Checking the checkbox sets `completed_at = now()`. There is no un-check (per the existing Notat-siden UX). Deletion is permanent.

## Architecture

### Components

```
components/notes/
├── NotesPanel.tsx        — main UI: list + input + history button
├── NoteRow.tsx           — single active-note row (checkbox, title, timestamp, X)
├── NoteComposer.tsx      — input field + add button at bottom
├── HistoryModal.tsx      — modal listing completed notes
└── useNotes.ts           — client hook: state, mutations, realtime subscription
```

`NotesPanel` takes a `variant: 'embedded' | 'standalone'` prop that adjusts:
- Container styling (sidebar card vs. full-page mobile layout)
- Header (compact `Notes` vs. large `Notater` title matching the standalone PWA)
- Whether to show the "Open in new tab" button (only in `embedded`)

### Routes / files touched

| File | Change |
|---|---|
| `supabase/migrations/20260530_notes.sql` | new — schema + RLS + realtime |
| `lib/notes.ts` | new — Supabase queries (list active, list completed, create, complete, delete) |
| `components/notes/*` | new — see above |
| `app/(app)/notes/page.tsx` | new — standalone fullscreen route |
| `app/(app)/calendar/page.tsx` | edit — replace the `Upcoming` section (lines 894–930) with `<NotesPanel variant="embedded" />` |
| `types/` (or inline) | new `Note` type |

### Data flow

1. `useNotes()` subscribes via Supabase Realtime on mount, fetching the initial active set and listening to `INSERT`/`UPDATE`/`DELETE` on `public.notes` filtered by `user_id`.
2. Mutations (create / complete / delete) call Supabase directly and rely on the realtime echo to update local state — so all open tabs (calendar panel, standalone tab, mobile) stay in sync within ~100 ms.
3. The history modal lazy-loads completed notes (`completed_at is not null`, ordered by `completed_at desc`) on open, since they can grow unbounded.

### Real-time considerations

- Single channel per user (`notes:user_id=eq.<uid>`).
- Optimistic UI: insert/complete/delete update local state immediately, then the realtime echo confirms (and corrects if the server rejected, though RLS makes that rare).
- The hook handles reconnects via the Supabase client's built-in retry; no custom logic.

## UX details

### Embedded panel (in calendar sidebar)

Replaces the "Upcoming" section. Same outer card styling as the rest of the calendar sidebar (border, dark-mode variants). Header row: "Notes" title + small "Open in new tab" icon button (opens `/notes` in a new tab). Body: scrollable list of active notes (newest first), each row with checkbox / title / created-at timestamp / X. Footer: input + "Add" button (Enter also submits). Bottom-left: small "History" button that opens the modal.

### Standalone page (`/notes`)

Same component, `variant="standalone"`. Header is large and centered ("Notater") matching the existing PWA. No "Open in new tab" button (already standalone). Mobile-first layout: input pinned to bottom, full-width list above, History button as a floating button or top-left icon. Must be installable/shortcut-able — set viewport meta and a sensible page title so iOS Safari "Add to Home Screen" produces a clean tile.

### History modal

Identical to image 3 from the user: bottom-sheet style on mobile, centered modal on desktop. Title "Historikk", X to close. Each row shows the note title plus `Opprettet: dd.mm.yyyy, HH:mm` and `Fullført: dd.mm.yyyy, HH:mm`. No actions on history rows in v1 (no restore, no permanent delete from here — keep it read-only and simple).

### Language

The standalone PWA uses Norwegian ("Notater", "Historikk", "Opprettet", "Fullført"). Sync has a `LanguageContext`. The notes UI strings should go through the existing i18n mechanism so both languages work; the Norwegian strings match the PWA verbatim.

### Empty states

- Empty active list: "Ingen notater enda. Skriv inn ditt første notat nedenfor." / English equivalent.
- Empty history: "Ingen fullførte notater enda."

## Error handling

- Insert/update/delete failures: revert optimistic change, show a small inline error toast ("Kunne ikke lagre — prøv igjen").
- Lost realtime connection: the hook trusts Supabase client retries. If the user makes a mutation while disconnected, the optimistic state stays until reconnection succeeds; on failure, revert with the same toast.
- Auth gone (session expired): the existing app-level auth guard handles redirect; the notes hook surfaces nothing special.

## Testing approach

- Unit tests on `lib/notes.ts` query builders (mock Supabase).
- Component tests on `NotesPanel`: rendering with notes, empty state, optimistic add, optimistic check-off, optimistic delete, error revert.
- Manual smoke test plan:
  1. Open calendar — see Notes panel where Upcoming was.
  2. Add a note from the panel — it appears at the top.
  3. Open `/notes` in a new tab — same note visible.
  4. Check off the note in the standalone tab — within ~1 s it disappears from both views.
  5. Open History — note visible with both timestamps.
  6. Delete a note via X — gone from both views.
  7. Phone shortcut: open `/notes` on phone, add a note, see it on PC's calendar panel.

## Project conventions

- This is a modified Next.js per `AGENTS.md` — before touching `app/` patterns, check `node_modules/next/dist/docs/` for relevant guides.
- Match the migration style of `supabase/migrations/20260525_calendar_connections.sql`: RLS enabled, explicit per-action policies, `set_updated_at` trigger.
- Match the UI patterns from existing pages (`Button`, `Badge`, `Modal`, `TopBar`, `useUser`).

## Open decisions resolved with user

| Decision | Choice |
|---|---|
| Realtime sync between devices/tabs | Supabase Realtime |
| Migrate notes from old PWA | No — fresh start |
| X-button behavior | Permanent delete (matches existing PWA) |
| Replace Upcoming panel | Yes — fully replace |
| Drag-to-schedule onto calendar | No — manual event creation as today |
| Decommission old PWA | No — leave it; user just switches phone shortcut |
