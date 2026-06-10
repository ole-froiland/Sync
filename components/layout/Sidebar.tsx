'use client'

import { cn } from '@/lib/utils'
import type { Profile } from '@/types'
import SidebarContent from './SidebarContent'

interface SidebarProps {
  profile: Profile | null
  onSignOut: () => void
  signingOut?: boolean
  className?: string
  hidden?: boolean
}

export default function Sidebar({ profile, onSignOut, signingOut, className, hidden }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex-shrink-0 h-screen sticky top-0 bg-white/70 dark:bg-gray-900/60 backdrop-blur-2xl backdrop-saturate-150 hidden lg:flex flex-col overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        hidden ? 'w-0 border-r-0' : 'w-60 border-r border-gray-100/80 dark:border-gray-800/80',
        className
      )}
      aria-hidden={hidden || undefined}
    >
      <div className="h-full w-60 flex-shrink-0">
        <SidebarContent profile={profile} onSignOut={onSignOut} signingOut={signingOut} />
      </div>
    </aside>
  )
}
