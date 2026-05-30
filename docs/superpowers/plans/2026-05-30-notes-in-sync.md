# Notes in Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-user notes feature to Sync. It replaces the "Upcoming" panel in the calendar with a notes list, and is also available as a standalone `/notes` route the user can save as a phone home-screen shortcut. Notes sync in real time across devices via Supabase Realtime.

**Architecture:** New `notes` table in Supabase (RLS, realtime). A single `<NotesPanel>` React component, parameterised by `variant`, is rendered both inside the calendar sidebar and on the `/notes` route. A `useNotes()` hook owns state, mutations, and the realtime subscription; UI is dumb.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), `lucide-react`. No test framework — verification is manual via `npm run dev` + browser.

**Spec:** [docs/superpowers/specs/2026-05-30-notes-in-sync-design.md](../specs/2026-05-30-notes-in-sync-design.md)

---

## File map

| Path | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20260530_notes.sql` | new | `notes` table, RLS policies, `updated_at` trigger, realtime publication |
| `types/notes.ts` | new | `Note` TypeScript type |
| `lib/notes.ts` | new | Supabase query helpers: `listActive`, `listCompleted`, `create`, `complete`, `remove` |
| `components/notes/useNotes.ts` | new | Hook: active notes state, optimistic mutations, realtime subscription |
| `components/notes/NoteRow.tsx` | new | Single active-note row (checkbox / title / created-at / X) |
| `components/notes/NoteComposer.tsx` | new | Bottom input + add button |
| `components/notes/HistoryModal.tsx` | new | Modal listing completed notes |
| `components/notes/NotesPanel.tsx` | new | Composes Row/Composer/HistoryModal; takes `variant` prop |
| `app/(app)/notes/page.tsx` | new | Standalone fullscreen route |
| `app/(app)/calendar/page.tsx` | modify (lines 894–930) | Replace Upcoming section with `<NotesPanel variant="embedded" />` |

---

## Conventions

- This is Next.js 16 (App Router, React 19, React Compiler). Per `AGENTS.md`, before introducing new App Router patterns, consult `node_modules/next/dist/docs/` if anything is unfamiliar.
- Supabase client: `import { createClient } from '@/lib/supabase/client'` for browser code.
- Existing realtime pattern in [app/(app)/chat/page.tsx:488-528](../../../app/(app)/chat/page.tsx#L488-L528) — follow the same `supabase.channel(...).on('postgres_changes', ...).subscribe()` + `removeChannel` cleanup shape.
- Use `Modal`, `Button`, `Input` from `components/ui`. Match Tailwind class patterns used in [calendar/page.tsx:894-930](../../../app/(app)/calendar/page.tsx#L894-L930).
- Strings: write in English. The `LanguageContext` translates the DOM at runtime — no per-component i18n calls needed.
- Use `lucide-react` icons (e.g. `Clock3`, `X`, `ExternalLink`, `Check`, `Plus`, `History`, `Send`).
- Commit after each task with a clear message. Do NOT batch tasks into a single commit.

---

## Task 1: Create the `notes` migration

**Files:**
- Create: `supabase/migrations/20260530_notes.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260530_notes.sql` with the exact contents below. Mirrors the style of `20260525_calendar_connections.sql`.

```sql
-- Per-user notes with active/history split.

create table if not exists public.notes (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  title         text        not null check (char_length(title) > 0),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  updated_at    timestamptz not null default now()
);

create index if not exists notes_user_active_idx
  on public.notes (user_id, created_at desc)
  where completed_at is null;

create index if not exists notes_user_completed_idx
  on public.notes (user_id, completed_at desc)
  where completed_at is not null;

alter table public.notes enable row level security;

drop policy if exists "Users can view own notes"   on public.notes;
drop policy if exists "Users can insert own notes" on public.notes;
drop policy if exists "Users can update own notes" on public.notes;
drop policy if exists "Users can delete own notes" on public.notes;

create policy "Users can view own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can insert own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notes"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Reuses public.set_updated_at() defined in 20260525_calendar_connections.sql.
drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- Stream INSERT/UPDATE/DELETE to clients.
alter publication supabase_realtime add table public.notes;
```

- [ ] **Step 2: Apply the migration**

Apply via the project's normal migration workflow (Supabase CLI, dashboard, or whatever the user normally uses — ask if unclear). For Supabase CLI:

Run: `supabase db push`
Expected: migration applies cleanly, no errors.

If the user applies migrations manually via the Supabase dashboard, paste the SQL into the SQL editor and confirm "Success".

- [ ] **Step 3: Verify the table exists and realtime is on**

Run in Supabase SQL editor:

```sql
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'notes';
```

Expected: one row returned. If empty, the `alter publication ... add table` line did not run — re-run it.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260530_notes.sql
git commit -m "Add notes table with RLS and realtime"
```

---

## Task 2: Add the `Note` type

**Files:**
- Create: `types/notes.ts`

- [ ] **Step 1: Write the type**

Create `types/notes.ts`:

```ts
export type Note = {
  id: string
  user_id: string
  title: string
  created_at: string
  completed_at: string | null
  updated_at: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add types/notes.ts
git commit -m "Add Note type"
```

---

## Task 3: Add Supabase query helpers

**Files:**
- Create: `lib/notes.ts`

- [ ] **Step 1: Write the helpers**

Create `lib/notes.ts`:

```ts
import { createClient } from '@/lib/supabase/client'
import type { Note } from '@/types/notes'

export async function listActive(): Promise<Note[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .is('completed_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Note[]
}

export async function listCompleted(): Promise<Note[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Note[]
}

export async function createNote(title: string, userId: string): Promise<Note> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notes')
    .insert({ title, user_id: userId })
    .select('*')
    .single()
  if (error) throw error
  return data as Note
}

export async function completeNote(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('notes')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function removeNote(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/notes.ts
git commit -m "Add Supabase query helpers for notes"
```

---

## Task 4: Add the `useNotes` hook with realtime

**Files:**
- Create: `components/notes/useNotes.ts`

- [ ] **Step 1: Write the hook**

Create `components/notes/useNotes.ts`. Pattern modeled on the realtime usage in [chat/page.tsx:488-528](../../../app/(app)/chat/page.tsx#L488-L528).

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createNote, completeNote, listActive, removeNote } from '@/lib/notes'
import type { Note } from '@/types/notes'

type UseNotesResult = {
  notes: Note[]
  loading: boolean
  error: string | null
  add: (title: string) => Promise<void>
  complete: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useNotes(userId: string | undefined): UseNotesResult {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initial fetch.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    listActive()
      .then((rows) => {
        if (!cancelled) setNotes(rows)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load notes')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Realtime subscription.
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`notes:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Note
            if (row.completed_at) return
            setNotes((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev]))
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Note
            setNotes((prev) =>
              row.completed_at ? prev.filter((n) => n.id !== row.id) : prev.map((n) => (n.id === row.id ? row : n)),
            )
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Note
            setNotes((prev) => prev.filter((n) => n.id !== oldRow.id))
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const add = useCallback(
    async (title: string) => {
      const trimmed = title.trim()
      if (!trimmed || !userId) return
      // Optimistic insert with a temporary id.
      const tempId = `temp-${crypto.randomUUID()}`
      const optimistic: Note = {
        id: tempId,
        user_id: userId,
        title: trimmed,
        created_at: new Date().toISOString(),
        completed_at: null,
        updated_at: new Date().toISOString(),
      }
      setNotes((prev) => [optimistic, ...prev])
      try {
        const saved = await createNote(trimmed, userId)
        setNotes((prev) => {
          // Replace temp row if realtime hasn't already.
          const withoutTemp = prev.filter((n) => n.id !== tempId)
          return withoutTemp.some((n) => n.id === saved.id) ? withoutTemp : [saved, ...withoutTemp]
        })
      } catch (err) {
        setNotes((prev) => prev.filter((n) => n.id !== tempId))
        setError(err instanceof Error ? err.message : 'Failed to add note')
      }
    },
    [userId],
  )

  const complete = useCallback(async (id: string) => {
    const snapshot = notes
    setNotes((prev) => prev.filter((n) => n.id !== id))
    try {
      await completeNote(id)
    } catch (err) {
      setNotes(snapshot)
      setError(err instanceof Error ? err.message : 'Failed to complete note')
    }
  }, [notes])

  const remove = useCallback(async (id: string) => {
    const snapshot = notes
    setNotes((prev) => prev.filter((n) => n.id !== id))
    try {
      await removeNote(id)
    } catch (err) {
      setNotes(snapshot)
      setError(err instanceof Error ? err.message : 'Failed to delete note')
    }
  }, [notes])

  return { notes, loading, error, add, complete, remove }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/notes/useNotes.ts
git commit -m "Add useNotes hook with realtime subscription"
```

---

## Task 5: Add the `NoteRow` component

**Files:**
- Create: `components/notes/NoteRow.tsx`

- [ ] **Step 1: Write the component**

Create `components/notes/NoteRow.tsx`:

```tsx
'use client'

import { X } from 'lucide-react'
import type { Note } from '@/types/notes'

type Props = {
  note: Note
  onComplete: (id: string) => void
  onRemove: (id: string) => void
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function NoteRow({ note, onComplete, onRemove }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 p-2 dark:border-gray-800">
      <input
        type="checkbox"
        checked={false}
        onChange={() => onComplete(note.id)}
        aria-label="Mark note as done"
        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{note.title}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatTimestamp(note.created_at)}</p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(note.id)}
        aria-label="Delete note"
        className="p-1 text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
      >
        <X size={16} />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/notes/NoteRow.tsx
git commit -m "Add NoteRow component"
```

---

## Task 6: Add the `NoteComposer` component

**Files:**
- Create: `components/notes/NoteComposer.tsx`

- [ ] **Step 1: Write the component**

Create `components/notes/NoteComposer.tsx`:

```tsx
'use client'

import { FormEvent, useState } from 'react'
import { Send } from 'lucide-react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

type Props = {
  onAdd: (title: string) => Promise<void>
  placeholder?: string
}

export default function NoteComposer({ onAdd, placeholder = 'Write a note…' }: Props) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      await onAdd(trimmed)
      setValue('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
      />
      <Button type="submit" size="sm" disabled={!value.trim() || submitting} aria-label="Add note">
        <Send size={14} />
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/notes/NoteComposer.tsx
git commit -m "Add NoteComposer component"
```

---

## Task 7: Add the `HistoryModal` component

**Files:**
- Create: `components/notes/HistoryModal.tsx`

- [ ] **Step 1: Write the component**

Create `components/notes/HistoryModal.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { listCompleted } from '@/lib/notes'
import type { Note } from '@/types/notes'

type Props = {
  open: boolean
  onClose: () => void
}

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export default function HistoryModal({ open, onClose }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    listCompleted()
      .then((rows) => {
        if (!cancelled) setNotes(rows)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load history')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title="History">
      {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && notes.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No completed notes yet.</p>
      )}
      <div className="space-y-2">
        {notes.map((note) => (
          <div key={note.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{note.title}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Created: {formatTimestamp(note.created_at)}</span>
              {note.completed_at && <span>Completed: {formatTimestamp(note.completed_at)}</span>}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/notes/HistoryModal.tsx
git commit -m "Add HistoryModal component"
```

---

## Task 8: Add the `NotesPanel` composing component

**Files:**
- Create: `components/notes/NotesPanel.tsx`

- [ ] **Step 1: Write the component**

Create `components/notes/NotesPanel.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Clock3, ExternalLink, History } from 'lucide-react'
import { useUser } from '@/context/UserContext'
import { useNotes } from './useNotes'
import NoteRow from './NoteRow'
import NoteComposer from './NoteComposer'
import HistoryModal from './HistoryModal'

type Variant = 'embedded' | 'standalone'

type Props = {
  variant: Variant
}

export default function NotesPanel({ variant }: Props) {
  const user = useUser()
  const { notes, loading, error, add, complete, remove } = useNotes(user?.id)
  const [historyOpen, setHistoryOpen] = useState(false)

  const isEmbedded = variant === 'embedded'

  return (
    <section
      className={
        isEmbedded
          ? 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
          : 'flex h-full flex-col bg-white dark:bg-gray-900'
      }
    >
      <div className={isEmbedded ? 'flex items-center justify-between' : 'flex items-center justify-between px-4 pt-4'}>
        <div>
          <p
            className={
              isEmbedded
                ? 'text-sm font-semibold text-gray-900 dark:text-gray-100'
                : 'text-xl font-semibold text-gray-900 dark:text-gray-100'
            }
          >
            Notes
          </p>
          {isEmbedded && <p className="text-xs text-gray-500 dark:text-gray-400">Quick capture.</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="Open history"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <History size={16} />
          </button>
          {isEmbedded && (
            <a
              href="/notes"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in new tab"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <ExternalLink size={16} />
            </a>
          )}
          {!isEmbedded && <Clock3 size={16} className="text-gray-400 dark:text-gray-500" />}
        </div>
      </div>

      <div className={isEmbedded ? 'mt-3 flex-1 space-y-2 overflow-y-auto' : 'mt-3 flex-1 space-y-2 overflow-y-auto px-4'}>
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && notes.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-200 p-3 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            No notes yet. Write your first note below.
          </p>
        )}
        {notes.map((note) => (
          <NoteRow key={note.id} note={note} onComplete={complete} onRemove={remove} />
        ))}
      </div>

      <div className={isEmbedded ? 'mt-3' : 'border-t border-gray-100 p-4 dark:border-gray-800'}>
        <NoteComposer onAdd={add} />
      </div>

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </section>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/notes/NotesPanel.tsx
git commit -m "Add NotesPanel composing component"
```

---

## Task 9: Add the standalone `/notes` route

**Files:**
- Create: `app/(app)/notes/page.tsx`

- [ ] **Step 1: Write the page**

Create `app/(app)/notes/page.tsx`:

```tsx
import NotesPanel from '@/components/notes/NotesPanel'

export const metadata = {
  title: 'Notes',
}

export default function NotesPage() {
  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col bg-white dark:bg-gray-900">
      <NotesPanel variant="standalone" />
    </main>
  )
}
```

- [ ] **Step 2: Verify the route loads**

Run dev server (if not already running):

```bash
npm run dev
```

Open `http://localhost:3000/notes` in a browser, signed in. Expected: a clean fullscreen Notes UI loads — empty state shown, composer at the bottom, History icon at top-left.

- [ ] **Step 3: Verify add/complete/delete on the standalone page**

In the browser:
1. Type "Test note 1" and press Enter → row appears at top.
2. Type "Test note 2" and click the Send button → appears above "Test note 1".
3. Click the checkbox on "Test note 1" → row disappears.
4. Click the History icon → modal opens, "Test note 1" listed with Created and Completed timestamps.
5. Close the modal.
6. Click X on "Test note 2" → row disappears.
7. Open History again → "Test note 2" is NOT in the list (it was deleted, not completed).

If any step fails, debug before proceeding.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/notes/page.tsx
git commit -m "Add standalone /notes route"
```

---

## Task 10: Replace the Upcoming section in calendar with NotesPanel

**Files:**
- Modify: `app/(app)/calendar/page.tsx` (lines 894–930)

- [ ] **Step 1: Add the import**

Open `app/(app)/calendar/page.tsx`. After the existing UI imports (around line 22, after `import { useUser } from '@/context/UserContext'`), add:

```tsx
import NotesPanel from '@/components/notes/NotesPanel'
```

- [ ] **Step 2: Replace the Upcoming section**

Find lines 894–930 (the `<section>` that begins with `className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"` and contains the `Upcoming` `<p>` and the `filteredEvents.slice(0, 4).map(...)`). Replace the entire `<section>...</section>` block with:

```tsx
<NotesPanel variant="embedded" />
```

- [ ] **Step 3: Remove now-unused imports if any**

Check whether `Clock3` is still used elsewhere in `calendar/page.tsx` (search with grep). If `Clock3` was only used in the Upcoming section, remove it from the `lucide-react` import line at the top of the file.

Run: `grep -n "Clock3" app/\(app\)/calendar/page.tsx`
- If 0 results outside the import: remove `Clock3` from the import.
- If still used: leave the import alone.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Verify the calendar page**

In the browser, navigate to `/calendar`. Expected: where "Upcoming" used to be, the Notes panel is now rendered with the same outer card styling. The composer is at the bottom, History and "Open in new tab" buttons in the header.

Add a note from the calendar's Notes panel. Expected: it appears immediately.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/calendar/page.tsx
git commit -m "Replace calendar Upcoming panel with NotesPanel"
```

---

## Task 11: End-to-end smoke test — realtime sync across tabs

This task is verification only; no code changes. If anything fails, fix it before continuing.

- [ ] **Step 1: Open two browser tabs**

Tab A: `http://localhost:3000/calendar`
Tab B: `http://localhost:3000/notes`

Both signed in as the same user.

- [ ] **Step 2: Add from Tab A**

In Tab A's Notes panel, add "Sync test 1". Expected: within ~1 s, it also appears at the top of Tab B's list (without refreshing Tab B).

- [ ] **Step 3: Complete from Tab B**

In Tab B, check off "Sync test 1". Expected: within ~1 s, it disappears from Tab A.

- [ ] **Step 4: Delete from Tab A**

Add another note "Sync test 2" in Tab A, then click X. Expected: within ~1 s, it disappears from Tab B too (if it appeared there).

- [ ] **Step 5: History reflects in both tabs**

Open History in either tab. Expected: "Sync test 1" appears with Created and Completed times. "Sync test 2" does NOT appear (it was deleted).

- [ ] **Step 6: Phone shortcut sanity check (manual, no commit)**

On the user's phone, open `https://<their-sync-domain>/notes` (or the local network IP + port if testing dev). Add to home screen, open from the home screen icon. Expected: clean fullscreen Notes UI, same data as desktop, realtime sync works.

- [ ] **Step 7: If all passes, no commit needed**

This task produces no code changes. Move to Task 12.

---

## Task 12: Final cleanup commit

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: no new errors introduced by this work. Fix any that surfaced and commit the fixes as a separate commit titled `Lint fixes for notes feature` if needed.

- [ ] **Step 2: Confirm git log**

Run: `git log --oneline -15`
Expected: roughly 10 focused commits — one per task — plus the original design-spec commit.

---

## Verification checklist (post-implementation)

- [ ] `notes` table exists in Supabase, RLS on, realtime publication includes it
- [ ] Cannot see another user's notes (test by querying as a different user in SQL editor)
- [ ] `/notes` route loads when signed in
- [ ] `/notes` route redirects/errors when signed out (consistent with other `(app)` routes)
- [ ] Calendar sidebar shows NotesPanel where Upcoming was
- [ ] Add / complete / delete all work in both views
- [ ] Realtime sync works across two open tabs within ~1 s
- [ ] History modal loads completed notes with both timestamps
- [ ] Mobile viewport (DevTools responsive mode, ≤ 414 px wide): standalone page is usable, composer pinned visibly above keyboard area, no horizontal scroll
- [ ] Dark mode looks correct in both variants
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No new lint errors (`npm run lint`)
