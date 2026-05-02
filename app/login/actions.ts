'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type LoginState = { error: string } | null

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const identifier = String(formData.get('identifier') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!identifier || !password) {
    return { error: 'Email/username and password are required.' }
  }

  const supabase = await createClient()

  // Resolve email from username if the identifier doesn't look like an email
  let email = identifier
  if (!identifier.includes('@')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', identifier)
      .maybeSingle()

    if (!profile?.email) {
      return { error: 'No account found with that username.' }
    }
    email = profile.email
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (
      error.message.toLowerCase().includes('invalid') ||
      error.message.toLowerCase().includes('credentials')
    ) {
      return { error: 'Incorrect email/username or password.' }
    }
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return { error: 'Please verify your email before logging in.' }
    }
    return { error: error.message }
  }

  redirect('/dashboard')
}
