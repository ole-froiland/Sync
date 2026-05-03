'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  Users,
  Zap,
  Settings,
  LogOut,
  GitBranch,
  Handshake,
} from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import type { Profile } from '@/types'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/repositories', label: 'Repositories', icon: GitBranch },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/people', label: 'People', icon: Users },
  { href: '/how-to-sync', label: 'How to Sync', icon: Handshake },
]

interface SidebarProps {
  profile: Profile | null
  onSignOut: () => void
  signingOut?: boolean
}

export default function Sidebar({ profile, onSignOut, signingOut }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-60 flex-shrink-0 h-screen sticky top-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Zap size={15} className="text-white" />
          </div>
          <span className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Sync</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: profile */}
      <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 group"
        >
          <Avatar name={profile?.name || 'User'} src={profile?.avatar_url} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{profile?.name || 'User'}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{profile?.role || 'Member'}</p>
          </div>
          <Settings size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 flex-shrink-0" />
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-60 disabled:pointer-events-none transition-all duration-200 mt-1"
          aria-label="Log out and return to login"
        >
          <LogOut size={15} />
          {signingOut ? 'Logging out...' : 'Log out'}
        </button>
      </div>
    </aside>
  )
}
