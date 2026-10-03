'use client'

import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import MobileDrawer from './MobileDrawer'
import BottomNav from './BottomNav'
import GlobalPrimaryActions from './GlobalPrimaryActions'
import SyncAssistantPanel from '@/components/assistant/SyncAssistantPanel'
import SettingsModal from '@/components/settings/SettingsModal'
import PanelNotesBridge from '@/components/notes/PanelNotesBridge'
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)

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
    function openSettings() {
      setDrawerOpen(false)
      setSettingsOpen(true)
    }
    function openAssistant() {
      setDrawerOpen(false)
      setAssistantOpen(true)
    }
    queueMicrotask(() => {
      if (localStorage.getItem(SIDEBAR_HIDDEN_KEY) === '1') setSidebarHidden(true)
    })
    window.addEventListener('sync:open-drawer', openDrawer)
    window.addEventListener('sync:toggle-sidebar', toggleSidebar)
    window.addEventListener('sync:open-settings', openSettings)
    window.addEventListener('sync:open-assistant', openAssistant)
    return () => {
      window.removeEventListener('sync:open-drawer', openDrawer)
      window.removeEventListener('sync:toggle-sidebar', toggleSidebar)
      window.removeEventListener('sync:open-settings', openSettings)
      window.removeEventListener('sync:open-assistant', openAssistant)
    }
  }, [])

  return (
    <UserProvider profile={profile}>
      <GitHubProvider status={githubStatus}>
        {profile?.id && <PanelNotesBridge userId={profile.id} />}
        <div className="flex h-[100dvh] overflow-hidden bg-gray-50 dark:bg-gray-950">
          <Sidebar profile={profile} onSignOut={handleSignOut} signingOut={signingOut} hidden={sidebarHidden} />
          <MobileDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            profile={profile}
            onSignOut={handleSignOut}
            signingOut={signingOut}
          />
          <main className="relative min-w-0 flex-1 flex flex-col overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
            <GlobalPrimaryActions />
            {children}
          </main>
          <SyncAssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
          <BottomNav />
        </div>
      </GitHubProvider>
    </UserProvider>
  )
}
