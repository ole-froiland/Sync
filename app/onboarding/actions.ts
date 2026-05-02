'use server'

import { createClient } from '@/lib/supabase/server'
import { getAvatar, avatarToUrl } from '@/lib/avatars'
import { redirect } from 'next/navigation'

export type OnboardingState = { error: string } | null

function validatePassword(password: string): string | null {
  if (password.length < 10) return 'Password must be at least 10 characters.'
  if (!/[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?`~]/.test(password))
    return 'Password must contain at least one special character.'
  return null
}

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

  const firstName = String(formData.get('firstName') ?? '').trim()
  const lastName = String(formData.get('lastName') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const avatarId = String(formData.get('avatarId') ?? '').trim()

  if (!firstName) return { error: 'First name is required.' }
  if (!lastName) return { error: 'Last name is required.' }

  const pwError = validatePassword(password)
  if (pwError) return { error: pwError }

  if (!avatarId) return { error: 'Please select an avatar.' }

  // Generate unique username from first + last name
  const base = (firstName + lastName).toLowerCase().replace(/[^a-z0-9]/g, '')
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

  // Add password to the existing OAuth user
  const { error: pwError2 } = await supabase.auth.updateUser({ password })
  if (pwError2) return { error: 'Failed to set password. Please try again.' }

  // Compute avatar URL (SVG data URI) so existing Avatar components render it everywhere
  const avatar = getAvatar(avatarId)
  const avatarUrl = avatarToUrl(avatar.emoji, avatar.color)

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      first_name: firstName,
      last_name: lastName,
      name: `${firstName} ${lastName}`,
      username,
      selected_avatar: avatarId,
      avatar_url: avatarUrl,
      onboarding_completed: true,
    })
    .eq('id', user.id)

  if (profileError) return { error: 'Failed to save profile. Please try again.' }

  redirect('/dashboard')
}
