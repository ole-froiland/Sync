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
    supabase.from('github_connections').select('github_username').eq('user_id', user.id).single(),
  ])

  const profileData = profileResult.data

  // Send unboarded users to the onboarding flow
  if (!profileData || !profileData.onboarding_completed) {
    redirect('/onboarding')
  }

  const resolvedProfile: Profile = {
    id: user.id,
    email: profileData.email ?? user.email ?? '',
    name: profileData.name || user.user_metadata?.full_name || 'User',
    first_name: profileData.first_name ?? null,
    last_name: profileData.last_name ?? null,
    username: profileData.username ?? null,
    selected_avatar: profileData.selected_avatar ?? null,
    avatar_url: profileData.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    role: profileData.role ?? null,
    tools_used: profileData.tools_used ?? null,
    onboarding_completed: true,
    created_at: profileData.created_at ?? user.created_at,
  }

  return (
    <AppShell
      profile={resolvedProfile}
      githubStatus={{
        connected: !!githubResult.data,
        login:
          (githubResult.data as { github_username?: string | null } | null)?.github_username ?? null,
      }}
    >
      {children}
    </AppShell>
  )
}
