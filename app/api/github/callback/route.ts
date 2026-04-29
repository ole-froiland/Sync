import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${SITE_URL}/settings?github_error=denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${SITE_URL}/settings?github_error=missing_params`)
  }

  // Verify CSRF state
  const cookieStore = await cookies()
  const savedState = cookieStore.get('github_oauth_state')?.value
  // Clear state cookie immediately
  cookieStore.set('github_oauth_state', '', { maxAge: 0, path: '/' })

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${SITE_URL}/settings?github_error=invalid_state`)
  }

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return NextResponse.redirect(`${SITE_URL}/settings?github_error=not_configured`)
  }

  // Ensure user is still authenticated
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${SITE_URL}/login`)
  }

  // Exchange code for access token (server → server, token never touches client)
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenData.access_token) {
    return NextResponse.redirect(`${SITE_URL}/settings?github_error=token_failed`)
  }

  // Fetch the GitHub user's login name
  const ghUserRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })
  const ghUser = await ghUserRes.json()

  // Upsert: one row per Sync user, updated on reconnect
  await supabase.from('github_connections').upsert(
    {
      user_id: user.id,
      github_access_token: tokenData.access_token,
      github_login: ghUser.login ?? null,
    },
    { onConflict: 'user_id' }
  )

  return NextResponse.redirect(`${SITE_URL}/settings?github_connected=1`)
}
