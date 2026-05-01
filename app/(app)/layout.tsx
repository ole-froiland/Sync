import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import { redirect } from 'next/navigation'
import type { Profile } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [profileResult, githubResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('github_connections').select('github_login').eq('user_id', user.id).single(),
  ])

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
