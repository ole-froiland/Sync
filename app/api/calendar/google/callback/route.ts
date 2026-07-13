import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'

const GOOGLE_CALENDAR_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID
const GOOGLE_CALENDAR_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
const SITE_URL = getSiteUrl()

type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

type GoogleUserInfo = {
  sub?: string
  name?: string
  email?: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(`${SITE_URL}/calendar?calendar_error=google_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${SITE_URL}/calendar?calendar_error=google_missing_params`)
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('google_calendar_oauth_state')?.value
  cookieStore.set('google_calendar_oauth_state', '', { maxAge: 0, path: '/' })

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${SITE_URL}/calendar?calendar_error=google_invalid_state`)
  }

  if (!GOOGLE_CALENDAR_CLIENT_ID || !GOOGLE_CALENDAR_CLIENT_SECRET) {
    return NextResponse.redirect(`${SITE_URL}/calendar?calendar_error=google_not_configured`)
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: GOOGLE_CALENDAR_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${SITE_URL}/api/calendar/google/callback`,
    }),
  })
  const tokenData = (await tokenRes.json()) as GoogleTokenResponse

  if (!tokenRes.ok || !tokenData.access_token) {
    const detail = encodeURIComponent(tokenData.error_description ?? tokenData.error ?? 'token_failed')
    return NextResponse.redirect(`${SITE_URL}/calendar?calendar_error=google_token_failed&detail=${detail}`)
  }

  const userInfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userInfo = userInfoRes.ok ? ((await userInfoRes.json()) as GoogleUserInfo) : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${SITE_URL}/login`)
  }

  const { data: existingConnection } = await supabase
    .from('calendar_connections')
    .select('refresh_token')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .maybeSingle()

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  const { error } = await supabase.from('calendar_connections').upsert(
    {
      user_id: user.id,
      provider: 'google',
      provider_account_id: userInfo?.sub ?? null,
      provider_account_name: userInfo?.name ?? null,
      provider_email: userInfo?.email ?? null,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? existingConnection?.refresh_token ?? null,
      token_type: tokenData.token_type ?? null,
      scope: tokenData.scope ?? null,
      expires_at: expiresAt,
      status: 'connected',
    },
    { onConflict: 'user_id,provider' }
  )

  if (error) {
    const detail = encodeURIComponent(error.message)
    return NextResponse.redirect(`${SITE_URL}/calendar?calendar_error=google_save_failed&detail=${detail}`)
  }

  return NextResponse.redirect(`${SITE_URL}/calendar?calendar_connected=google`)
}
