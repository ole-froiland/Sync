import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import { mockProfiles } from '@/lib/mock-data'
import type { Profile } from '@/types'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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

  const [profileResult, githubResult] = await Promise.all([
    user
      ? supabase.from('profiles').select('*').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from('github_connections')
          .select('github_login')
          .eq('user_id', user.id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const resolvedProfile: Profile = profileResult.data ?? (user
    ? {
        id: user.id,
        email: user.email ?? '',
        name: user.user_metadata?.full_name ?? user.email ?? 'User',
        avatar_url: user.user_metadata?.avatar_url ?? null,
        role: null,
        tools_used: null,
        created_at: user.created_at,
      }
    : mockProfiles[0])

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
