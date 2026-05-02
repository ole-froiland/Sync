import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const GITHUB_CONNECT_CLIENT_ID = process.env.GITHUB_CONNECT_CLIENT_ID
const GITHUB_CONNECT_CLIENT_SECRET = process.env.GITHUB_CONNECT_CLIENT_SECRET
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

type GitHubUser = {
  login?: string
  name?: string | null
  avatar_url?: string | null
}

async function exchangeCodeForToken(code: string): Promise<{
  token: string | null
  user: GitHubUser | null
  error?: string
}> {
  let tokenData: Record<string, unknown>
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CONNECT_CLIENT_ID,
        client_secret: GITHUB_CONNECT_CLIENT_SECRET,
        code,
      }),
    })
    tokenData = await tokenRes.json()
  } catch (err) {
    console.error('[github/callback] Token exchange network error:', err)
    return { token: null, user: null, error: 'Token exchange network error' }
  }

  if (tokenData.error) {
    console.error('[github/callback] GitHub token error:', tokenData.error, tokenData.error_description)
    return {
      token: null,
      user: null,
      error: `GitHub: ${tokenData.error_description ?? tokenData.error}`,
    }
  }

  const accessToken = tokenData.access_token as string | undefined
  if (!accessToken) {
    console.error('[github/callback] No access_token in response:', tokenData)
    return { token: null, user: null, error: 'GitHub did not return an access token' }
  }

  let githubUser: GitHubUser
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
    if (!userRes.ok) {
      console.error('[github/callback] GitHub /user returned', userRes.status)
      return { token: null, user: null, error: `GitHub /user error: ${userRes.status}` }
    }
    githubUser = await userRes.json()
  } catch (err) {
    console.error('[github/callback] GitHub /user network error:', err)
    return { token: null, user: null, error: 'Could not fetch GitHub user' }
  }

  return { token: accessToken, user: githubUser }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    console.error('[github/callback] OAuth error from GitHub:', oauthError)
    return NextResponse.redirect(`${SITE_URL}/settings?github_error=denied`)
  }

  if (!code || !state) {
    console.error('[github/callback] Missing code or state params')
    return NextResponse.redirect(`${SITE_URL}/settings?github_error=missing_params`)
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('github_oauth_state')?.value
  cookieStore.set('github_oauth_state', '', { maxAge: 0, path: '/' })

  if (!savedState || savedState !== state) {
    console.error('[github/callback] State mismatch — savedState:', savedState, 'got:', state)
    return NextResponse.redirect(`${SITE_URL}/settings?github_error=invalid_state`)
  }

  if (!GITHUB_CONNECT_CLIENT_ID || !GITHUB_CONNECT_CLIENT_SECRET) {
    console.error('[github/callback] GITHUB_CONNECT_CLIENT_ID / SECRET not set')
    return NextResponse.redirect(`${SITE_URL}/settings?github_error=not_configured`)
  }

  const { token, user: githubUser, error: tokenError } = await exchangeCodeForToken(code)

  if (!token || !githubUser?.login) {
    const detail = encodeURIComponent(tokenError ?? 'unknown')
    console.error('[github/callback] Token exchange failed:', tokenError)
    return NextResponse.redirect(
      `${SITE_URL}/settings?github_error=token_failed&detail=${detail}`
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error('[github/callback] Supabase getUser failed:', authError)
    return NextResponse.redirect(`${SITE_URL}/login`)
  }

  console.log('[github/callback] Saving token for user', user.id, 'login', githubUser.login)

  const { error: upsertError } = await supabase.from('github_connections').upsert(
    {
      user_id: user.id,
      github_access_token: token,
      github_login: githubUser.login,
    },
    { onConflict: 'user_id' }
  )

  if (upsertError) {
    console.error('[github/callback] Supabase upsert failed:', upsertError)
    const detail = encodeURIComponent(upsertError.message)
    return NextResponse.redirect(
      `${SITE_URL}/settings?github_error=save_failed&detail=${detail}`
    )
  }

  console.log('[github/callback] Token saved successfully for', githubUser.login)
  return NextResponse.redirect(`${SITE_URL}/settings?github_connected=1`)
}
