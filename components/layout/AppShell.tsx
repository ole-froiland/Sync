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

const SIDEBAR_HIDDEN_KEY = 'sync-sidebar-hidden'

export default function AppShell({ profile, githubStatus, children }: AppShellProps) {
  const [signingOut, setSigningOut] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarHidden, setSidebarHidden] = useState(false)

  async function handleSignOut() {
    if (signingOut) return

    setSigningOut(true)
    window.location.replace('/auth/signout')
  }

  useEffect(() => {
    function openDrawer() {
      setDrawerOpen(true)
    }
    function toggleSidebar() {
      setSidebarHidden((hidden) => {
        localStorage.setItem(SIDEBAR_HIDDEN_KEY, hidden ? '0' : '1')
        return !hidden
      })
    }
    queueMicrotask(() => {
      if (localStorage.getItem(SIDEBAR_HIDDEN_KEY) === '1') setSidebarHidden(true)
    })
    window.addEventListener('sync:open-drawer', openDrawer)
    window.addEventListener('sync:toggle-sidebar', toggleSidebar)
    return () => {
      window.removeEventListener('sync:open-drawer', openDrawer)
      window.removeEventListener('sync:toggle-sidebar', toggleSidebar)
    }
  }, [])

  return (
    <UserProvider profile={profile}>
      <GitHubProvider status={githubStatus}>
        <div className="flex h-[100dvh] overflow-hidden bg-gray-50 dark:bg-gray-950">
          {/* Ambient backdrop — gives the liquid-glass chrome something to refract */}
          <div aria-hidden="true" className="pointer-events-none fixed inset-0">
            <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-purple-400/25 blur-3xl dark:bg-purple-600/15" />
            <div className="absolute top-1/4 right-[-10rem] h-[24rem] w-[24rem] rounded-full bg-fuchsia-400/20 blur-3xl dark:bg-fuchsia-600/10" />
            <div className="absolute bottom-[-8rem] left-1/3 h-[22rem] w-[22rem] rounded-full bg-purple-300/20 blur-3xl dark:bg-purple-500/10" />
          </div>
          <Sidebar profile={profile} onSignOut={handleSignOut} signingOut={signingOut} hidden={sidebarHidden} />
          <MobileDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            profile={profile}
            onSignOut={handleSignOut}
            signingOut={signingOut}
          />
          <main className="relative flex-1 flex flex-col overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
            <GlobalPrimaryActions />
            {children}
          </main>
          <BottomNav />
        </div>
      </GitHubProvider>
    </UserProvider>
  )
}
