import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const MICROSOFT_CALENDAR_CLIENT_ID = process.env.MICROSOFT_CALENDAR_CLIENT_ID
const MICROSOFT_CALENDAR_CLIENT_SECRET = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

type MicrosoftTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

type MicrosoftUser = {
  id?: string
  displayName?: string
  mail?: string | null
  userPrincipalName?: string | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(`${SITE_URL}/calendar?calendar_error=microsoft_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${SITE_URL}/calendar?calendar_error=microsoft_missing_params`)
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('microsoft_calendar_oauth_state')?.value
  cookieStore.set('microsoft_calendar_oauth_state', '', { maxAge: 0, path: '/' })

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${SITE_URL}/calendar?calendar_error=microsoft_invalid_state`)
  }

  if (!MICROSOFT_CALENDAR_CLIENT_ID || !MICROSOFT_CALENDAR_CLIENT_SECRET) {
    return NextResponse.redirect(`${SITE_URL}/calendar?calendar_error=microsoft_not_configured`)
  }

  const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MICROSOFT_CALENDAR_CLIENT_ID,
      client_secret: MICROSOFT_CALENDAR_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${SITE_URL}/api/calendar/microsoft/callback`,
    }),
  })
  const tokenData = (await tokenRes.json()) as MicrosoftTokenResponse

  if (!tokenRes.ok || !tokenData.access_token) {
    const detail = encodeURIComponent(tokenData.error_description ?? tokenData.error ?? 'token_failed')
    return NextResponse.redirect(`${SITE_URL}/calendar?calendar_error=microsoft_token_failed&detail=${detail}`)
  }

  const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const microsoftUser = userRes.ok ? ((await userRes.json()) as MicrosoftUser) : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${SITE_URL}/login`)
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  const { error } = await supabase.from('calendar_connections').upsert(
    {
      user_id: user.id,
      provider: 'microsoft',
      provider_account_id: microsoftUser?.id ?? null,
      provider_account_name: microsoftUser?.displayName ?? null,
      provider_email: microsoftUser?.mail ?? microsoftUser?.userPrincipalName ?? null,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      token_type: tokenData.token_type ?? null,
      scope: tokenData.scope ?? null,
      expires_at: expiresAt,
      status: 'connected',
    },
    { onConflict: 'user_id,provider' }
  )

  if (error) {
    const detail = encodeURIComponent(error.message)
    return NextResponse.redirect(`${SITE_URL}/calendar?calendar_error=microsoft_save_failed&detail=${detail}`)
  }

  return NextResponse.redirect(`${SITE_URL}/calendar?calendar_connected=microsoft`)
}
