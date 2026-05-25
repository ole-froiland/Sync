import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const MICROSOFT_CALENDAR_CLIENT_ID = process.env.MICROSOFT_CALENDAR_CLIENT_ID
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function GET() {
  if (!MICROSOFT_CALENDAR_CLIENT_ID) {
    return NextResponse.json(
      { error: 'MICROSOFT_CALENDAR_CLIENT_ID is not configured.' },
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
  cookieStore.set('microsoft_calendar_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: MICROSOFT_CALENDAR_CLIENT_ID,
    redirect_uri: `${SITE_URL}/api/calendar/microsoft/callback`,
    response_type: 'code',
    response_mode: 'query',
    scope: 'offline_access User.Read Calendars.Read',
    state,
  })

  return NextResponse.redirect(
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
  )
}
