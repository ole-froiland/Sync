'use server'

import { createClient } from '@/lib/supabase/server'
import { getAvatar, avatarToUrl } from '@/lib/avatars'
import { redirect } from 'next/navigation'

export type OnboardingState = { error: string } | null

export async function onboardingAction(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) redirect('/login')

  const rawFullName = String(user.user_metadata?.full_name ?? '').trim()
  const nameParts = rawFullName.split(/\s+/).filter(Boolean)
  const emailLocal = String(user.email ?? 'syncuser').split('@')[0]?.trim() || 'syncuser'

  const fallbackFirstName = nameParts[0] || emailLocal || 'Sync'
  const fallbackLastName = nameParts.slice(1).join(' ') || 'User'
  const fallbackAvatarId = '0-indigo'

  const firstName = String(formData.get('firstName') ?? '').trim() || fallbackFirstName
  const lastName = String(formData.get('lastName') ?? '').trim() || fallbackLastName
  const avatarId = String(formData.get('avatarId') ?? '').trim() || fallbackAvatarId

  // Generate unique username from first + last name
  const base = (firstName + lastName).toLowerCase().replace(/[^a-z0-9]/g, '') || emailLocal.toLowerCase().replace(/[^a-z0-9]/g, '') || 'syncuser'
  let username = base
  let counter = 2
  while (true) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .maybeSingle()
    if (!data) break
    username = `${base}${counter++}`
  }

  const avatar = getAvatar(avatarId)
  const avatarUrl = avatarToUrl(avatar.emoji, avatar.color)

  // Use upsert so this works whether the trigger already created a row or not.
  // onConflict:'id' means: insert if missing, update if the row already exists.
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email ?? '',
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`,
        username,
        selected_avatar: avatarId,
        avatar_url: avatarUrl,
        onboarding_completed: true,
      },
      { onConflict: 'id' }
    )

  if (profileError) {
    console.error('[onboarding] profile upsert failed:', profileError)
    // Surface the real message so it's visible in the UI during development
    return {
      error: `Profile save failed: ${profileError.message} (code: ${profileError.code})`,
    }
  }

  redirect('/dashboard')
}
