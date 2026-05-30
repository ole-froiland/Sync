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
