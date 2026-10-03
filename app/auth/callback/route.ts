import { NextResponse } from 'next/server'
import { safeInternalRedirect } from '@/lib/auth-redirect'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeInternalRedirect(searchParams.get('next'))
  const siteUrl = new URL(request.url).origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single()

        if (!profile?.onboarding_completed) {
          return NextResponse.redirect(`${siteUrl}/onboarding`)
        }
      }

      return NextResponse.redirect(new URL(next, siteUrl))
    }
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth_failed`)
}
