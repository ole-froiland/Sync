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

interface SidebarProps {
  profile: Profile | null
  onSignOut: () => void
  signingOut?: boolean
}

export default function Sidebar({ profile, onSignOut, signingOut }: SidebarProps) {
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
    <aside className="w-60 flex-shrink-0 h-screen sticky top-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="h-14 px-5 border-b border-gray-100 dark:border-gray-800 flex items-center">
        <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-500 to-fuchsia-500 bg-clip-text text-transparent">Sync</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
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
    </aside>
  )
}
