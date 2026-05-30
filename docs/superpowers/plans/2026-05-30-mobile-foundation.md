# Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Sync app shell (sidebar, top bar, app shell) usable on phone and iPad portrait while leaving desktop (≥1024px) and iPad landscape completely unchanged.

**Architecture:** Single `lg:` (1024px) breakpoint divides modes. Below `lg`: sidebar hides, a hamburger button in TopBar opens a slide-in drawer (containing a new shared `SidebarContent`), and a fixed `BottomNav` with four destinations sits at the bottom. Above `lg`: everything renders as today. TopBar dispatches a `sync:open-drawer` custom event (matching the existing `sync:open-post-modal` pattern) so pages don't have to thread props.

**Tech Stack:** Next.js 16 (App Router, React 19), TypeScript, Tailwind v4, `lucide-react`. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-05-30-mobile-foundation-design.md](../specs/2026-05-30-mobile-foundation-design.md)

---

## File map

| Path | Status | Responsibility |
|---|---|---|
| `components/layout/SidebarContent.tsx` | new | Nav list + profile dock — pure inner content, no outer container |
| `components/layout/Sidebar.tsx` | modify | Outer chrome only (width, border, `hidden lg:flex`); inner body is `<SidebarContent />` |
| `components/layout/MobileDrawer.tsx` | new | Portal-based slide-in drawer that mounts `<SidebarContent />`; scroll-lock, auto-close on route change |
| `components/layout/BottomNav.tsx` | new | Fixed bottom tab bar (Dashboard, Calendar, Notes, Chat); `lg:hidden` |
| `components/layout/TopBar.tsx` | modify | Hamburger button on the left (`lg:hidden`) dispatching `sync:open-drawer` |
| `components/layout/AppShell.tsx` | modify | Owns drawer state via event listener; mounts `MobileDrawer` + `BottomNav`; adds bottom-safe padding to `<main>` |

---

## Conventions

- This is Next.js 16 / React 19. Per `AGENTS.md`, check `node_modules/next/dist/docs/` if any App Router pattern is unfamiliar.
- The existing custom-event pattern (see [TopBar.tsx](../../../components/layout/TopBar.tsx) `sync:open-repo-modal`, `sync:open-post-modal`) is reused for `sync:open-drawer` so pages don't need any changes.
- Use `cn()` from `@/lib/utils` for conditional class merging.
- Use `lucide-react` for all icons (already a dependency).
- Match existing Tailwind class style (dark-mode variants, `border-gray-200 dark:border-gray-800`, purple accents).
- Single breakpoint: `lg:` only. Never `md:`.
- No new tests — the project has no test framework. Verification is manual via `npm run dev` + DevTools responsive mode.
- Commit after every task with a clear message.

---

## Task 1: Extract `SidebarContent` from `Sidebar`

This is a pure refactor — no behavior changes. The current `Sidebar.tsx` mixes the outer container (`<aside>` with width, border, background) with the inner body (nav list, profile dock, profile-edit modal, chat badge polling). We split them so the inner body can be reused inside `MobileDrawer` later.

**Files:**
- Create: `components/layout/SidebarContent.tsx`
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Create `SidebarContent.tsx` with the existing inner body**

Create the new file. It contains everything currently inside `Sidebar.tsx`'s `<aside>...</aside>` EXCEPT the outer `<aside>` tag and its className. The wrapper becomes a `<div>` with `className="flex h-full flex-col"` so it fills whatever parent gives it.

```tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  GitBranch,
  Handshake,
  CalendarDays,
  Lightbulb,
  UserCircle,
  HelpCircle,
} from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import type { Profile } from '@/types'
import { CHAT_META_EVENT, readChatReadMap, readMutedUserIds } from '@/lib/chat-meta'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/repositories', label: 'Repositories', icon: GitBranch },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/people', label: 'People', icon: Users },
  { href: '/ideas', label: 'Ideas', icon: Lightbulb },
  { href: '/how-to-sync', label: 'How to Sync', icon: Handshake },
]

interface SidebarContentProps {
  profile: Profile | null
  onSignOut: () => void
  signingOut?: boolean
}

export default function SidebarContent({ profile, onSignOut, signingOut }: SidebarContentProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [chatBadgeCount, setChatBadgeCount] = useState(0)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [draftName, setDraftName] = useState(profile?.name ?? '')
  const [draftAvatarUrl, setDraftAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const profileAvatarInputRef = useRef<HTMLInputElement>(null)
  const profileId = profile?.id ?? null

  const supabaseConfigured = useMemo(
    () => (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http'),
    []
  )

  useEffect(() => {
    if (!profileId || !supabaseConfigured) return
    const currentProfileId = profileId

    let cancelled = false

    async function loadInboxBadge() {
      try {
        const [inboxRes, connRes] = await Promise.all([
          fetch('/api/direct-messages/inbox'),
          fetch('/api/connections'),
        ])

        if (!inboxRes.ok || !connRes.ok) return

        const inboxBody = (await inboxRes.json()) as {
          items?: Array<{
            sender_id: string
            receiver_id: string
            created_at: string
            state: 'sent' | 'accepted' | 'rejected'
            payload?: { kind?: 'sync_request' } | null
          }>
        }
        const connBody = (await connRes.json()) as {
          sync?: Record<string, 'pending' | 'request_received' | 'synced'>
        }

        const readMap = readChatReadMap(currentProfileId)
        const mutedIds = new Set(readMutedUserIds(currentProfileId))
        const syncMap = connBody.sync ?? {}
        const requestCount = Object.entries(syncMap).filter(
          ([userId, state]) => state === 'request_received' && !mutedIds.has(userId)
        ).length

        let unreadMessageCount = 0
        for (const item of inboxBody.items ?? []) {
          if (item.receiver_id !== currentProfileId) continue
          if (item.payload?.kind === 'sync_request') continue
          const otherId = item.sender_id
          if (mutedIds.has(otherId)) continue
          const lastReadAt = readMap[otherId]
          if (!lastReadAt || new Date(item.created_at).getTime() > new Date(lastReadAt).getTime()) {
            unreadMessageCount += 1
          }
        }

        if (!cancelled) {
          setChatBadgeCount(requestCount + unreadMessageCount)
        }
      } catch {
        if (!cancelled) setChatBadgeCount(0)
      }
    }

    void loadInboxBadge()
    const interval = window.setInterval(loadInboxBadge, 30000)
    const onMetaChanged = () => void loadInboxBadge()
    const onFocus = () => void loadInboxBadge()
    window.addEventListener(CHAT_META_EVENT, onMetaChanged)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener(CHAT_META_EVENT, onMetaChanged)
      window.removeEventListener('focus', onFocus)
    }
  }, [profileId, supabaseConfigured])

  useEffect(() => {
    if (!profileMenuOpen) return

    function closeOnOutsideClick(event: MouseEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', closeOnOutsideClick)
    return () => window.removeEventListener('mousedown', closeOnOutsideClick)
  }, [profileMenuOpen])

  function openProfileModal() {
    setProfileMenuOpen(false)
    setDraftName(profile?.name ?? 'User')
    setDraftAvatarUrl(profile?.avatar_url ?? null)
    setProfileSaveError(null)
    setProfileModalOpen(true)
  }

  function attachProfileImage(file: File) {
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraftAvatarUrl(reader.result)
        setProfileSaveError(null)
      }
    }
    reader.readAsDataURL(file)
  }

  function avatarDisplaySrc(src: string | null | undefined) {
    if (!src || src.startsWith('data:image/svg+xml')) return null
    return src
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile || !draftName.trim()) return

    setProfileSaving(true)
    setProfileSaveError(null)

    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({
          name: draftName.trim(),
          avatar_url: draftAvatarUrl,
          selected_avatar: null,
        })
        .eq('id', profile.id)

      if (error) throw error

      router.refresh()
      setProfileModalOpen(false)
    } catch (error) {
      setProfileSaveError(error instanceof Error ? error.message : 'Kunne ikke lagre profilen.')
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="h-14 px-5 border-b border-gray-100 dark:border-gray-800 flex items-center">
        <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-500 to-fuchsia-500 bg-clip-text text-transparent">Sync</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const isChat = href === '/chat'
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              {isChat && profileId && chatBadgeCount > 0 && (
                <span
                  className={cn(
                    'min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold',
                    active
                      ? 'bg-purple-600 text-white dark:bg-purple-500'
                      : 'bg-red-500 text-white'
                  )}
                >
                  {chatBadgeCount > 99 ? '99+' : chatBadgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: profile */}
      <div ref={profileMenuRef} className="relative px-3 py-3 border-t border-gray-100 dark:border-gray-800">
        {profileMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 z-30 mb-2 overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <button
              type="button"
              onClick={openProfileModal}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <UserCircle size={16} />
              Bruker
            </button>
            <Link
              href="/settings"
              onClick={() => setProfileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Settings size={16} />
              Innstillinger
            </Link>
            <Link
              href="/how-to-sync"
              onClick={() => setProfileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <HelpCircle size={16} />
              Hjelp
            </Link>
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false)
                onSignOut()
              }}
              disabled={signingOut}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 disabled:pointer-events-none dark:text-red-300 dark:hover:bg-red-950/30"
            >
              <LogOut size={16} />
              {signingOut ? 'Logger ut...' : 'Logg ut'}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setProfileMenuOpen((open) => !open)}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
          aria-expanded={profileMenuOpen}
          aria-haspopup="menu"
        >
          <Avatar name={profile?.name || 'User'} src={profile?.avatar_url} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{profile?.name || 'User'}</p>
          </div>
        </button>
      </div>

      <Modal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title="Rediger profil"
        className="max-w-2xl"
      >
        <form onSubmit={saveProfile} className="space-y-6">
          <div className="flex justify-center">
            <div
              className="flex flex-col items-center gap-3"
              onDrop={(event) => {
                event.preventDefault()
                const file = event.dataTransfer.files[0]
                if (file) attachProfileImage(file)
              }}
              onDragOver={(event) => event.preventDefault()}
            >
              <Avatar
                name={draftName || profile?.name || 'User'}
                src={avatarDisplaySrc(draftAvatarUrl)}
                size="lg"
                className="h-32 w-32 border-4 border-blue-600 text-4xl shadow-sm"
              />
              <input
                ref={profileAvatarInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) attachProfileImage(file)
                }}
              />
              <button
                type="button"
                onClick={() => profileAvatarInputRef.current?.click()}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Last opp bilde
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500">eller dra og slipp et bilde her</p>
            </div>
          </div>

          <label className="block rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
            <span className="text-sm text-gray-500 dark:text-gray-400">Visningsnavn</span>
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              className="mt-1 w-full bg-transparent text-base text-gray-900 outline-none dark:text-gray-100"
              placeholder="Visningsnavn"
            />
          </label>

          <label className="block rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
            <span className="text-sm text-gray-500 dark:text-gray-400">E-post</span>
            <input
              value={profile?.email ?? ''}
              readOnly
              className="mt-1 w-full bg-transparent text-base text-gray-500 outline-none dark:text-gray-400"
            />
          </label>

          {profileSaveError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">
              {profileSaveError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setProfileModalOpen(false)}>
              Avbryt
            </Button>
            <Button type="submit" loading={profileSaving} disabled={!draftName.trim()}>
              Lagre
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 2: Slim down `Sidebar.tsx` to outer chrome**

Replace the entire contents of `components/layout/Sidebar.tsx` with:

```tsx
'use client'

import { cn } from '@/lib/utils'
import type { Profile } from '@/types'
import SidebarContent from './SidebarContent'

interface SidebarProps {
  profile: Profile | null
  onSignOut: () => void
  signingOut?: boolean
  className?: string
}

export default function Sidebar({ profile, onSignOut, signingOut, className }: SidebarProps) {
  return (
    <aside
      className={cn(
        'w-60 flex-shrink-0 h-screen sticky top-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col',
        className
      )}
    >
      <SidebarContent profile={profile} onSignOut={onSignOut} signingOut={signingOut} />
    </aside>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Verify desktop is unchanged**

Run `npm run dev`. Open `http://localhost:3000/dashboard` at desktop width (≥1024px). Expected: sidebar looks identical to before — same width, same nav links, profile dock at bottom works, profile edit modal works.

If something visually differs, debug before continuing.

- [ ] **Step 5: Commit**

```bash
git add components/layout/SidebarContent.tsx components/layout/Sidebar.tsx
git commit -m "Extract SidebarContent from Sidebar"
```

---

## Task 2: Hide `Sidebar` on mobile

The desktop sidebar must not render below `lg:`. Mobile chrome will replace it later.

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Add `hidden lg:flex` to the `<aside>`**

Change the `<aside>` className from:

```
'w-60 flex-shrink-0 h-screen sticky top-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col'
```

To:

```
'w-60 flex-shrink-0 h-screen sticky top-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 hidden lg:flex flex-col'
```

(`hidden` by default, `lg:flex` from 1024px and up. Replaces the bare `flex` since `hidden lg:flex` covers both states.)

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Verify both viewports**

Run `npm run dev`.

- At desktop width (≥1024px): sidebar still visible, identical to before.
- In DevTools responsive mode, set viewport to 390×844 (iPhone 14): sidebar is GONE. The page content takes the full width. (It will look broken — that's expected at this stage. Mobile chrome arrives in later tasks.)

- [ ] **Step 4: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "Hide sidebar on mobile viewports"
```

---

## Task 3: Add `MobileDrawer` component

A portal-based slide-in drawer that wraps `SidebarContent`. Handles backdrop, slide-in animation, scroll-lock, Escape key, and auto-close on route change.

**Files:**
- Create: `components/layout/MobileDrawer.tsx`

- [ ] **Step 1: Create the drawer component**

```tsx
'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'
import SidebarContent from './SidebarContent'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  profile: Profile | null
  onSignOut: () => void
  signingOut?: boolean
}

export default function MobileDrawer({ open, onClose, profile, onSignOut, signingOut }: MobileDrawerProps) {
  const pathname = usePathname()

  // Auto-close when route changes (user tapped a nav link inside).
  useEffect(() => {
    if (open) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only watch pathname
  }, [pathname])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    function handler(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Body scroll-lock while open.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  // Don't render at all on server / before mount to avoid hydration mismatch with portal.
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[60] lg:hidden',
        open ? 'pointer-events-auto' : 'pointer-events-none'
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/40 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-72 max-w-[85%] bg-white dark:bg-gray-900 shadow-xl transition-transform duration-200 ease-out',
          'border-r border-gray-100 dark:border-gray-800',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <SidebarContent profile={profile} onSignOut={onSignOut} signingOut={signingOut} />
      </div>
    </div>,
    document.body
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/layout/MobileDrawer.tsx
git commit -m "Add MobileDrawer component"
```

---

## Task 4: Add `BottomNav` component

Fixed bottom tab bar with four destinations. Visible only below `lg:`.

**Files:**
- Create: `components/layout/BottomNav.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, LayoutDashboard, MessageSquare, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/notes', label: 'Notes', icon: StickyNote },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:dark:bg-gray-900/80 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex w-full flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
                  active
                    ? 'text-purple-700 dark:text-purple-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                    active && 'bg-purple-50 dark:bg-purple-950/60'
                  )}
                >
                  <Icon size={20} />
                </span>
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/layout/BottomNav.tsx
git commit -m "Add BottomNav component"
```

---

## Task 5: Add hamburger button to `TopBar`

The hamburger lives in TopBar on mobile. Tapping it dispatches the `sync:open-drawer` custom event — same pattern as the existing `sync:open-repo-modal` and `sync:open-post-modal` events. AppShell listens for it in Task 6. Pages keep calling `<TopBar title="..." />` unchanged.

**Files:**
- Modify: `components/layout/TopBar.tsx`

- [ ] **Step 1: Add the hamburger button and event dispatcher**

Edit `components/layout/TopBar.tsx`. Add `Menu` to the lucide imports, and add a button at the start of the inner row.

Change the top of the file from:

```tsx
'use client'

import Image from 'next/image'
import { Bell, GitBranch } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Button from '@/components/ui/Button'
```

To:

```tsx
'use client'

import Image from 'next/image'
import { Bell, GitBranch, Menu } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Button from '@/components/ui/Button'
```

Inside the component, add this helper next to `openRepoModal` / `openPostModal`:

```tsx
  function openDrawer() {
    window.dispatchEvent(new Event('sync:open-drawer'))
  }
```

Then change the `<header>` body. Currently the header has:

```tsx
<header className="h-14 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 flex items-center justify-between flex-shrink-0">
  <h1
    className="text-base font-semibold text-gray-900 dark:text-gray-100"
    data-no-translate={noTranslateTitle ? true : undefined}
  >
    {title}
  </h1>
```

Replace that block with:

```tsx
<header className="h-14 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 lg:px-6 flex items-center justify-between flex-shrink-0 gap-3">
  <div className="flex items-center gap-2 min-w-0">
    <button
      type="button"
      onClick={openDrawer}
      aria-label="Open menu"
      className="lg:hidden inline-flex h-10 w-10 items-center justify-center -ml-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <Menu size={20} />
    </button>
    <h1
      className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate"
      data-no-translate={noTranslateTitle ? true : undefined}
    >
      {title}
    </h1>
  </div>
```

Leave the right-side actions (`<div className="flex items-center gap-2">...`) and the closing `</header>` exactly as they were.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/layout/TopBar.tsx
git commit -m "Add hamburger button to TopBar on mobile"
```

---

## Task 6: Wire it together in `AppShell`

AppShell owns the drawer's open/closed state, listens for the `sync:open-drawer` event from TopBar, mounts `MobileDrawer` and `BottomNav`, and adds bottom-safe padding to `<main>` so content isn't hidden under the bottom nav.

**Files:**
- Modify: `components/layout/AppShell.tsx`

- [ ] **Step 1: Replace the contents of `AppShell.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import MobileDrawer from './MobileDrawer'
import BottomNav from './BottomNav'
import GlobalPrimaryActions from './GlobalPrimaryActions'
import { UserProvider } from '@/context/UserContext'
import { GitHubProvider, type GitHubStatus } from '@/context/GitHubContext'
import type { Profile } from '@/types'

interface AppShellProps {
  profile: Profile | null
  githubStatus: GitHubStatus
  children: React.ReactNode
}

export default function AppShell({ profile, githubStatus, children }: AppShellProps) {
  const [signingOut, setSigningOut] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  async function handleSignOut() {
    if (signingOut) return

    setSigningOut(true)
    window.location.replace('/auth/signout')
  }

  // Listen for hamburger taps from TopBar (and any other component that wants to open the drawer).
  useEffect(() => {
    function openDrawer() {
      setDrawerOpen(true)
    }
    window.addEventListener('sync:open-drawer', openDrawer)
    return () => window.removeEventListener('sync:open-drawer', openDrawer)
  }, [])

  return (
    <UserProvider profile={profile}>
      <GitHubProvider status={githubStatus}>
        <div className="flex h-[100dvh] bg-gray-50 dark:bg-gray-950 overflow-hidden">
          <Sidebar profile={profile} onSignOut={handleSignOut} signingOut={signingOut} />
          <MobileDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            profile={profile}
            onSignOut={handleSignOut}
            signingOut={signingOut}
          />
          <main className="flex-1 flex flex-col overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
            <GlobalPrimaryActions />
            {children}
          </main>
          <BottomNav />
        </div>
      </GitHubProvider>
    </UserProvider>
  )
}
```

Key changes from the existing file:
- `h-screen` → `h-[100dvh]` (dynamic viewport height, handles mobile browser chrome correctly).
- Added `drawerOpen` state and the `sync:open-drawer` event listener.
- Added `<MobileDrawer>` next to `<Sidebar>`.
- Added bottom padding to `<main>` for mobile (clears the fixed BottomNav + safe area).
- Added `<BottomNav />` as a flex sibling (it's `fixed`-positioned so it floats above content; padding on `<main>` reserves the vertical space).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/layout/AppShell.tsx
git commit -m "Wire MobileDrawer and BottomNav into AppShell"
```

---

## Task 7: End-to-end smoke test

Verification only. No code changes. If anything fails, fix it before continuing.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:3000` in a browser, signed in.

- [ ] **Step 2: Desktop verification (≥1024px)**

Resize browser to ≥1024px wide. Navigate through `/dashboard`, `/calendar`, `/chat`, `/notes`, `/projects`. Expected:
- Sidebar visible on every page, identical to before this work.
- TopBar shows NO hamburger.
- Bottom nav NOT visible.
- Layout and spacing identical to before.

- [ ] **Step 3: Phone viewport (DevTools responsive, iPhone 14: 390×844)**

Reload at this width. Expected:
- Sidebar hidden.
- TopBar shows a hamburger icon to the left of the page title.
- Bottom nav visible with four icons (Dashboard, Calendar, Notes, Chat). Active tab is highlighted in purple.
- Page content has space at the bottom — nothing hidden under bottom nav.

- [ ] **Step 4: Drawer open / close**

Tap hamburger. Expected: drawer slides in from left within ~200ms, backdrop fades in. Body does not scroll (try scrolling the backdrop — page underneath should not move).

Test all close paths:
- Tap backdrop → drawer closes
- Press Escape → drawer closes
- Tap any nav link inside the drawer → navigates AND drawer closes automatically

- [ ] **Step 5: Bottom nav routing**

Tap each of the four bottom-nav tabs in turn. Expected: each navigates correctly. The active tab's icon + label turn purple.

- [ ] **Step 6: iPad portrait (DevTools: 810×1080)**

Resize to 810×1080. Expected: same mobile chrome as Step 3 (hamburger + bottom nav, no sidebar).

- [ ] **Step 7: iPad landscape (DevTools: 1180×820)**

Resize to 1180×820. Expected: desktop chrome (sidebar visible, no hamburger, no bottom nav).

- [ ] **Step 8: Notes page on mobile**

At phone width, navigate to `/notes`. Expected: NotesPanel still renders correctly. Bottom nav still visible (Notes tab active). NO hamburger on this page because /notes doesn't render a TopBar — that's expected; user navigates via bottom nav.

- [ ] **Step 9: iPhone safe-area (PWA install simulation)**

Optional but recommended: open in Safari on a real iPhone or use iPhone 14 Pro in DevTools (which includes the safe area). Expected: bottom nav clears the home-indicator area. Nothing important hidden behind it.

- [ ] **Step 10: No commit needed**

This task produces no code changes. Move to Task 8.

---

## Task 8: Lint and final cleanup

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: no new errors. If any new errors surfaced from this work, fix them and commit as a separate `Lint fixes for mobile foundation` commit.

- [ ] **Step 2: Run TypeScript one more time**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify the commit list**

Run: `git log --oneline -15`
Expected: 6 feature commits (one per Tasks 1–6) plus any lint-fix commits, plus the original spec commit.

---

## Verification checklist (post-implementation)

- [ ] Desktop (≥1024px): app looks identical to pre-change.
- [ ] Phone width: sidebar hidden, hamburger in TopBar, bottom nav visible, content not hidden under nav.
- [ ] Drawer slides in from left with backdrop, closes via backdrop / Escape / link tap.
- [ ] Body scroll locked while drawer is open.
- [ ] Bottom nav active state correctly highlights the current route.
- [ ] iPad portrait = mobile chrome; iPad landscape = desktop chrome.
- [ ] iPhone safe-area: bottom nav clears home indicator.
- [ ] `/notes` standalone page still works on both viewports.
- [ ] No new TypeScript errors (`npx tsc --noEmit`).
- [ ] No new lint errors (`npm run lint`).
