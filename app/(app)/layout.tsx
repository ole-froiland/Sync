import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import { mockProfiles } from '@/lib/mock-data'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import {
  decodeLocalGitHubSession,
  localGitHubProfile,
  LOCAL_GITHUB_SESSION_COOKIE,
} from '@/lib/local-github-session'
import type { Profile } from '@/types'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const githubSession = decodeLocalGitHubSession(
    cookieStore.get(LOCAL_GITHUB_SESSION_COOKIE)?.value
  )

  if (githubSession) {
    return (
      <AppShell
        profile={localGitHubProfile(githubSession)}
        githubStatus={{ connected: true, login: githubSession.login }}
      >
        {children}
      </AppShell>
    )
  }

  if (!SUPABASE_CONFIGURED) {
    return (
      <AppShell profile={mockProfiles[0]} githubStatus={{ connected: false, login: null }}>
        {children}
      </AppShell>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware handles the common case, but this is defence-in-depth for when
  // the middleware is bypassed or Supabase session validation fails mid-flight.
  if (!user) {
    redirect('/login')
  }

  const [profileResult, githubResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('github_connections')
      .select('github_login')
      .eq('user_id', user.id)
      .single(),
  ])

  // user is guaranteed non-null here (redirect above handles null case).
  // Fall back to auth metadata if the profiles row doesn't exist yet
  // (e.g. the trigger hasn't fired yet on first login).
  const resolvedProfile: Profile = profileResult.data ?? {
    id: user.id,
    email: user.email ?? '',
    name: user.user_metadata?.full_name ?? user.email ?? 'User',
    avatar_url: user.user_metadata?.avatar_url ?? null,
    role: null,
    tools_used: null,
    created_at: user.created_at,
  }

  return (
    <AppShell
      profile={resolvedProfile}
      githubStatus={{
        connected: !!githubResult.data,
        login: (githubResult.data as { github_login?: string | null } | null)?.github_login ?? null,
      }}
    >
      {children}
    </AppShell>
  )
}
