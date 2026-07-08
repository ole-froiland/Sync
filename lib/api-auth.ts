import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types'

const SUPABASE_CONFIGURED =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http') &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

/**
 * The auth proxy's matcher only covers page paths, so API routes that spend
 * server resources or hold server credentials must gate themselves. In mock
 * mode (Supabase not configured) there is no session to check, so allow.
 */
export async function isAuthenticated(): Promise<boolean> {
  if (!SUPABASE_CONFIGURED) return true
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return Boolean(user)
}

export async function requireUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>
  user: User
  profile: Profile | null
} | null> {
  const supabase = await createClient()

  if (!SUPABASE_CONFIGURED) {
    return {
      supabase,
      user: {
        id: 'mock-user',
        email: 'mock@sync.local',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as User,
      profile: null,
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const profile = profileData
    ? ({
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
        onboarding_completed: Boolean(profileData.onboarding_completed),
        created_at: profileData.created_at ?? user.created_at,
      } satisfies Profile)
    : null

  if (!profile?.onboarding_completed) return null

  return { supabase, user, profile }
}
