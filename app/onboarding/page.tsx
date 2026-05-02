import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingForm from './OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_completed) redirect('/dashboard')

  // Pre-fill name fields from GitHub metadata
  const githubName = ((user.user_metadata?.full_name as string | undefined) ?? '').trim()
  const parts = githubName.split(/\s+/).filter(Boolean)
  const defaultFirst = parts[0] ?? ''
  const defaultLast = parts.slice(1).join(' ')

  return <OnboardingForm defaultFirst={defaultFirst} defaultLast={defaultLast} />
}
