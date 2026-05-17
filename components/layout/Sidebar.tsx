'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  const [chatBadgeCount, setChatBadgeCount] = useState(0)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
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
            <Link
              href="/people"
              onClick={() => setProfileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <UserCircle size={16} />
              Bruker
            </Link>
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
    </aside>
  )
}
