# Manual Chat Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace auto-generated chat channels (one per project folder + 3 demo projects) with user-created, standalone channels — chat starts empty, a `+` button creates channels, and channels can be deleted.

**Architecture:** Channels become a self-contained concept stored in localStorage (`sync-chat-channels-v1`), decoupled from project folders and Supabase projects. A new pure-logic module `lib/chat-channels.ts` owns the model and is unit-tested. The chat page maps channels onto the existing `Project` shape and reuses the existing localStorage-backed message path (channel ids are recognized as "local" so message read/write/realtime-skip work unchanged).

**Tech Stack:** Next.js 16.2.4, React 19.2.4, TypeScript, Tailwind 4, lucide-react, vitest (node environment). Existing UI primitives: `components/ui/Modal.tsx`, `components/ui/Input.tsx`, `components/ui/Button.tsx`.

**Spec:** [docs/superpowers/specs/2026-06-24-manual-chat-channels-design.md](../specs/2026-06-24-manual-chat-channels-design.md)

**Testing note:** vitest runs in the `node` environment (see `vitest.config.ts`), so there is no DOM/component test harness, and React pages + localStorage wrappers are not unit-tested in this repo (e.g. `lib/chat-meta.ts` has no tests). Therefore **Task 1 (pure logic) is full TDD**, and **Tasks 2–4 (page wiring) are verified by typecheck + lint + the manual checklist in Task 5**. The pure logic is deliberately split out so the testable part is genuinely tested.

---

## File Structure

- **Create** `lib/chat-channels.ts` — channel model, pure helpers (`isChatChannelId`, `parseChannels`, `addChannel`, `removeChannel`, `channelToProject`), and localStorage wrappers (`readChatChannels`, `writeChatChannels`, `createChatChannel`, `deleteChatChannel`). One responsibility: owning chat-channel data.
- **Create** `lib/chat-channels.test.ts` — vitest unit tests for the pure helpers.
- **Modify** `app/(app)/chat/page.tsx` — source channels from the new module, add create/delete UI, broaden the "local id" check, remove the folder→channel derivation and demo seeding.

No other files change.

---

## Task 1: Channel model + pure logic (`lib/chat-channels.ts`)

**Files:**
- Create: `lib/chat-channels.ts`
- Test: `lib/chat-channels.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/chat-channels.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  CHAT_CHANNEL_PREFIX,
  addChannel,
  channelToProject,
  isChatChannelId,
  parseChannels,
  removeChannel,
  type ChatChannel,
} from './chat-channels'

const sample: ChatChannel = {
  id: `${CHAT_CHANNEL_PREFIX}1`,
  name: 'Marketing',
  createdAt: '2026-06-24T10:00:00.000Z',
}

describe('isChatChannelId', () => {
  it('matches ids with the channel prefix', () => {
    expect(isChatChannelId(`${CHAT_CHANNEL_PREFIX}abc`)).toBe(true)
  })
  it('rejects folder ids and other ids', () => {
    expect(isChatChannelId('project-folder:abc')).toBe(false)
    expect(isChatChannelId('proj-1')).toBe(false)
  })
})

describe('parseChannels', () => {
  it('returns [] for null', () => {
    expect(parseChannels(null)).toEqual([])
  })
  it('returns [] for invalid JSON', () => {
    expect(parseChannels('{not json')).toEqual([])
  })
  it('returns [] for non-array JSON', () => {
    expect(parseChannels('{"id":"x"}')).toEqual([])
  })
  it('drops malformed entries and keeps valid ones', () => {
    const raw = JSON.stringify([sample, { name: 'no id' }, { id: 'only-id' }, 42])
    expect(parseChannels(raw)).toEqual([sample])
  })
})

describe('addChannel', () => {
  it('prepends the new channel', () => {
    const other: ChatChannel = {
      id: `${CHAT_CHANNEL_PREFIX}2`,
      name: 'HR',
      createdAt: '2026-06-24T11:00:00.000Z',
    }
    expect(addChannel([sample], other)).toEqual([other, sample])
  })
})

describe('removeChannel', () => {
  it('removes the matching channel', () => {
    expect(removeChannel([sample], sample.id)).toEqual([])
  })
  it('leaves the list unchanged when the id is absent', () => {
    expect(removeChannel([sample], 'nope')).toEqual([sample])
  })
})

describe('channelToProject', () => {
  it('maps a channel into the Project shape', () => {
    const project = channelToProject(sample)
    expect(project.id).toBe(sample.id)
    expect(project.name).toBe('Marketing')
    expect(project.created_at).toBe(sample.createdAt)
    expect(project.status).toBe('idea')
    expect(project.created_by).toBe('local')
    expect(project.members).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/chat-channels.test.ts`
Expected: FAIL — cannot resolve module `./chat-channels` (file does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `lib/chat-channels.ts`:

```ts
import type { Project } from '@/types'

export const CHAT_CHANNELS_STORAGE_KEY = 'sync-chat-channels-v1'
export const CHAT_CHANNEL_PREFIX = 'chat-channel:'

export type ChatChannel = {
  id: string
  name: string
  createdAt: string
}

// --- Pure helpers (unit-tested) ---

export function isChatChannelId(id: string): boolean {
  return id.startsWith(CHAT_CHANNEL_PREFIX)
}

function isValidChannel(value: unknown): value is ChatChannel {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ChatChannel).id === 'string' &&
    typeof (value as ChatChannel).name === 'string'
  )
}

export function parseChannels(raw: string | null): ChatChannel[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidChannel)
  } catch {
    return []
  }
}

export function addChannel(list: ChatChannel[], channel: ChatChannel): ChatChannel[] {
  return [channel, ...list]
}

export function removeChannel(list: ChatChannel[], id: string): ChatChannel[] {
  return list.filter((channel) => channel.id !== id)
}

export function channelToProject(channel: ChatChannel): Project {
  return {
    id: channel.id,
    name: channel.name,
    description: null,
    status: 'idea',
    tech_stack: null,
    github_url: null,
    demo_url: null,
    created_by: 'local',
    created_at: channel.createdAt,
    member_count: 0,
    task_count: 0,
    members: [],
  }
}

// --- localStorage wrappers (mirror lib/chat-meta.ts; not unit-tested) ---

export function readChatChannels(): ChatChannel[] {
  if (typeof window === 'undefined') return []
  return parseChannels(window.localStorage.getItem(CHAT_CHANNELS_STORAGE_KEY))
}

export function writeChatChannels(channels: ChatChannel[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CHAT_CHANNELS_STORAGE_KEY, JSON.stringify(channels))
}

export function createChatChannel(name: string): ChatChannel {
  const channel: ChatChannel = {
    id: `${CHAT_CHANNEL_PREFIX}${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  }
  writeChatChannels(addChannel(readChatChannels(), channel))
  return channel
}

export function deleteChatChannel(id: string): void {
  writeChatChannels(removeChannel(readChatChannels(), id))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/chat-channels.test.ts`
Expected: PASS — all tests green (12 assertions across 6 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add lib/chat-channels.ts lib/chat-channels.test.ts
git commit -m "feat: add chat-channels model and pure helpers"
```

---

## Task 2: Source chat channels from the new module

Replace the folder-derived + demo channel sources in the chat page with `readChatChannels()`, and make channel ids count as "local" so the existing message path works.

**Files:**
- Modify: `app/(app)/chat/page.tsx` (imports; `isLocalProjectId`; `load()` both branches; remove `readProjectFolderChannels` + `ProjectFolderSummary`)

- [ ] **Step 1: Update the mock-data import (line 9)**

Replace:

```ts
import { mockProjects, mockMessages } from '@/lib/mock-data'
```

with:

```ts
import { mockMessages } from '@/lib/mock-data'
```

- [ ] **Step 2: Add the chat-channels import**

Immediately after the `@/lib/chat-meta` import block (ends at line 31, `} from '@/lib/chat-meta'`), add:

```ts
import {
  channelToProject,
  createChatChannel,
  deleteChatChannel,
  isChatChannelId,
  readChatChannels,
} from '@/lib/chat-channels'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
```

- [ ] **Step 3: Add the `Plus` and `Trash2` icons to the lucide-react import (lines 11–23)**

Inside the `from 'lucide-react'` import list, add `Plus,` and `Trash2,` (place them alphabetically or at the end of the list, before the closing `}`). The resulting list must include the existing icons plus these two. For example, change the line `  FolderOpen,` to:

```ts
  FolderOpen,
  Plus,
  Trash2,
```

- [ ] **Step 4: Broaden `isLocalProjectId` (lines 127–129)**

Replace:

```ts
function isLocalProjectId(projectId: string) {
  return projectId.startsWith(LOCAL_PROJECT_PREFIX)
}
```

with:

```ts
function isLocalProjectId(projectId: string) {
  return projectId.startsWith(LOCAL_PROJECT_PREFIX) || isChatChannelId(projectId)
}
```

- [ ] **Step 5: Remove the `ProjectFolderSummary` type (lines 90–95)**

Delete the whole block:

```ts
type ProjectFolderSummary = {
  id: string
  name: string
  description?: string
  createdAt?: string
}
```

- [ ] **Step 6: Remove `readProjectFolderChannels` and the now-dead `localProjectId` helper**

First delete the whole `readProjectFolderChannels` function (lines 135–158):

```ts
function readProjectFolderChannels(): Project[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PROJECT_FOLDERS_STORAGE_KEY)
    const folders = raw ? (JSON.parse(raw) as ProjectFolderSummary[]) : []
    if (!Array.isArray(folders)) return []
    return folders.map((folder) => ({
      id: localProjectId(folder.id),
      name: folder.name,
      description: folder.description ?? null,
      status: 'idea' as const,
      tech_stack: null,
      github_url: null,
      demo_url: null,
      created_by: 'local',
      created_at: folder.createdAt ?? new Date().toISOString(),
      member_count: 0,
      task_count: 0,
      members: [],
    }))
  } catch {
    return []
  }
}
```

Then delete the `localProjectId` helper (lines 123–125), which was only called by the function above:

```ts
function localProjectId(folderId: string) {
  return `${LOCAL_PROJECT_PREFIX}${folderId}`
}
```

(Keep `LOCAL_PROJECT_PREFIX` — it is still used by `isLocalProjectId`. Keep `PROJECT_FOLDERS_STORAGE_KEY` and `localProjectChatStorageKey` — both are still used by `importSharedProjectFolder` and the local-message helpers respectively.)

- [ ] **Step 7: Replace the channel source in the not-configured branch (lines 402–403)**

Replace:

```ts
          const localProjects = readProjectFolderChannels()
          const projectList = [...mockProjects, ...localProjects]
```

with:

```ts
          const projectList = readChatChannels().map(channelToProject)
```

- [ ] **Step 8: Drop the `/api/projects` fetch in the configured branch (lines 423–430)**

Replace:

```ts
        const [projRes, peopleRes, connRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/people'),
          fetch('/api/connections'),
        ])

        const projectList = projRes.ok ? ((await projRes.json()) as Project[]) : []
        const peopleList = peopleRes.ok ? ((await peopleRes.json()) as Profile[]) : []
```

with:

```ts
        const [peopleRes, connRes] = await Promise.all([
          fetch('/api/people'),
          fetch('/api/connections'),
        ])

        const peopleList = peopleRes.ok ? ((await peopleRes.json()) as Profile[]) : []
```

- [ ] **Step 9: Replace the channel list build in the configured branch (lines 443–444)**

Replace:

```ts
        const localProjects = readProjectFolderChannels()
        const list = [...(Array.isArray(projectList) ? projectList : []), ...localProjects]
```

with:

```ts
        const list = readChatChannels().map(channelToProject)
```

- [ ] **Step 10: Typecheck, lint, and run tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors/warnings in `app/(app)/chat/page.tsx` (in particular, no "unused variable" for `mockProjects`, `ProjectFolderSummary`, `readProjectFolderChannels`, or `localProjectId` — all removed).

Run: `npm test`
Expected: PASS — all suites, including `lib/chat-channels.test.ts`.

- [ ] **Step 11: Commit**

```bash
git add "app/(app)/chat/page.tsx"
git commit -m "feat: source chat channels from local store, drop folder/demo auto-channels"
```

---

## Task 3: Create-channel UI (`+` button + modal)

**Files:**
- Modify: `app/(app)/chat/page.tsx` (state, handler, sidebar header button, empty-state copy, modal)

- [ ] **Step 1: Add create-modal state**

In the `ChatPage` component, just after the existing line `const [lightboxImage, setLightboxImage] = useState<ImagePayload | null>(null)` (line 311), add:

```ts
  const [newChannelOpen, setNewChannelOpen] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
```

- [ ] **Step 2: Add the create handler**

Immediately after the `selectProject` function (ends at line 559 with its closing `}`), add:

```ts
  function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault()
    const name = newChannelName.trim()
    if (!name) return
    const project = channelToProject(createChatChannel(name))
    setProjects((prev) => [project, ...prev])
    setNewChannelName('')
    setNewChannelOpen(false)
    selectProject(project)
  }
```

- [ ] **Step 3: Add the `+` button to the Channels header (lines 864–868)**

Replace:

```tsx
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Channels
          </p>
        </div>
```

with:

```tsx
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Channels
          </p>
          <button
            type="button"
            onClick={() => setNewChannelOpen(true)}
            aria-label="New channel"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <Plus size={16} />
          </button>
        </div>
```

- [ ] **Step 4: Update the empty-state copy (line 878)**

Replace:

```tsx
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No channels yet.</p>
```

with:

```tsx
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No channels yet — create one with +.</p>
```

- [ ] **Step 5: Add the create-channel modal**

Replace (near the end of the component, line 1264):

```tsx
      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
```

with:

```tsx
      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />

      <Modal
        open={newChannelOpen}
        onClose={() => {
          setNewChannelOpen(false)
          setNewChannelName('')
        }}
        title="New channel"
        className="max-w-sm"
      >
        <form onSubmit={handleCreateChannel} className="space-y-4">
          <Input
            label="Channel name"
            autoFocus
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            placeholder="e.g. Marketing"
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setNewChannelOpen(false)
                setNewChannelName('')
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!newChannelName.trim()}>
              <Plus size={16} />
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
```

- [ ] **Step 6: Typecheck, lint, and run tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/chat/page.tsx"
git commit -m "feat: add create-channel button and modal to chat"
```

---

## Task 4: Delete-channel UI (hover trash on each channel)

**Files:**
- Modify: `app/(app)/chat/page.tsx` (delete handler, channel row markup)

- [ ] **Step 1: Add the delete handler**

Immediately after `handleCreateChannel` (added in Task 3), add:

```ts
  function handleDeleteChannel(project: Project) {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(`Delete #${project.name}? This removes the channel and its messages.`)
      if (!ok) return
    }
    deleteChatChannel(project.id)
    window.localStorage.removeItem(localProjectChatStorageKey(project.id))
    setProjects((prev) => prev.filter((p) => p.id !== project.id))
    if (active?.kind === 'project' && active.project.id === project.id) {
      setActive(null)
      setProjectMessages([])
    }
  }
```

- [ ] **Step 2: Wrap each channel row and add the hover trash button (lines 880–898)**

Replace:

```tsx
            projects.map((project) => {
              const isActive = active?.kind === 'project' && active.project.id === project.id
              return (
                <button
                  key={project.id}
                  onClick={() => selectProject(project)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                    isActive
                      ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                  )}
                >
                  <Hash size={14} className="flex-shrink-0" />
                  <span className="truncate flex-1">{project.name}</span>
                </button>
              )
            })
```

with:

```tsx
            projects.map((project) => {
              const isActive = active?.kind === 'project' && active.project.id === project.id
              return (
                <div key={project.id} className="group relative">
                  <button
                    onClick={() => selectProject(project)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 pr-9 rounded-lg text-sm transition-colors text-left',
                      isActive
                        ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                    )}
                  >
                    <Hash size={14} className="flex-shrink-0" />
                    <span className="truncate flex-1">{project.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteChannel(project)}
                    aria-label={`Delete ${project.name}`}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-gray-700 dark:hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })
```

- [ ] **Step 3: Typecheck, lint, and run tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/chat/page.tsx"
git commit -m "feat: add delete-channel action to chat sidebar"
```

---

## Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds with no type or lint errors.

- [ ] **Step 2: Manual checklist (run `npm run dev`, open the Chat page)**

Verify each:
- [ ] Chat opens with **no channels** ("No channels yet — create one with +."), even if project folders exist on the Projects page.
- [ ] Click `+` → modal opens → enter "Marketing" → Create → channel appears and opens (empty conversation).
- [ ] Send a text message and a pasted image in the channel → both appear.
- [ ] Reload the page → the channel and its messages **persist**.
- [ ] Create a second channel → both listed; switching between them shows the correct messages.
- [ ] Hover a channel → trash icon appears → click → confirm → channel and its messages are removed; if it was active, the conversation pane clears.
- [ ] Create a new project folder on the Projects page → it does **not** appear as a chat channel.

- [ ] **Step 3: Commit any final fixes** (only if the checklist surfaced issues)

Stage only this feature's files — never `git add -A` (an unrelated modified file, `components/projects/folder-tree/buildTreeLayout.ts`, must stay out of these commits):

```bash
git add "app/(app)/chat/page.tsx" lib/chat-channels.ts lib/chat-channels.test.ts
git commit -m "fix: address manual-channel verification findings"
```

---

## Self-Review Notes

- **Spec coverage:** manual-only model (Tasks 2–3), start-empty / remove demo + folder channels (Task 2), own localStorage store + reused message path (Tasks 1–2), `+` create (Task 3), delete + message cleanup (Task 4), unit tests for helpers (Task 1), manual verification (Task 5). Known side effect (folder→chat deep-link becomes a no-op) is accepted per spec and intentionally untouched.
- **Type consistency:** `ChatChannel` and the helper signatures defined in Task 1 are used unchanged in Tasks 2–4 (`readChatChannels`, `channelToProject`, `createChatChannel`, `deleteChatChannel`, `isChatChannelId`). Channel ids flow through `isLocalProjectId` → existing `localProjectChatStorageKey` / `readLocalProjectMessages` / `writeLocalProjectMessages`, so no new message API is introduced.
- **No placeholders:** every code step contains the full before/after text.
