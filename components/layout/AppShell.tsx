'use client'

import { useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import { UserProvider } from '@/context/UserContext'
import { GitHubProvider, type GitHubStatus } from '@/context/GitHubContext'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

interface AppShellProps {
  profile: Profile | null
  githubStatus: GitHubStatus
  children: React.ReactNode
}

export default function AppShell({ profile, githubStatus, children }: AppShellProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <UserProvider profile={profile}>
      <GitHubProvider status={githubStatus}>
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
          <Sidebar profile={profile} onSignOut={handleSignOut} />
          <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
        </div>
      </GitHubProvider>
    </UserProvider>
  )
}
