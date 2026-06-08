import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'

const GOOGLE_CALENDAR_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID
const SITE_URL = getSiteUrl()

export async function GET() {
  if (!GOOGLE_CALENDAR_CLIENT_ID) {
    return NextResponse.json(
      { error: 'GOOGLE_CALENDAR_CLIENT_ID is not configured.' },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${SITE_URL}/login`)
  }

  const state = crypto.randomUUID()
  const cookieStore = await cookies()
  cookieStore.set('google_calendar_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: GOOGLE_CALENDAR_CLIENT_ID,
    redirect_uri: `${SITE_URL}/api/calendar/google/callback`,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
    state,
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
