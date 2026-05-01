'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
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

  async function handleSignOut() {
    if (signingOut) return

    setSigningOut(true)
    window.location.replace('/auth/signout')
  }

  return (
    <UserProvider profile={profile}>
      <GitHubProvider status={githubStatus}>
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
          <Sidebar profile={profile} onSignOut={handleSignOut} signingOut={signingOut} />
          <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
        </div>
      </GitHubProvider>
    </UserProvider>
  )
}
