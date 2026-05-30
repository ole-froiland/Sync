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
