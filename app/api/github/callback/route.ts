import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import {
  encodeLocalGitHubSession,
  LOCAL_GITHUB_SESSION_COOKIE,
  type LocalGitHubSession,
} from '@/lib/local-github-session'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const IS_PRODUCTION = process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test'

type GitHubUser = {
  login?: string
  name?: string | null
  avatar_url?: string | null
}

async function exchangeCodeForGitHubUser(code: string) {
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
    return { token: null, user: null }
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!userRes.ok) {
    return { token: null, user: null }
  }

  return {
    token: tokenData.access_token as string,
    user: (await userRes.json()) as GitHubUser,
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=github_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/login?error=github_missing_params`)
  }

  const cookieStore = await cookies()
  const savedConnectState = cookieStore.get('github_oauth_state')?.value
  const savedLoginState = cookieStore.get('github_login_state')?.value
  cookieStore.set('github_oauth_state', '', { maxAge: 0, path: '/' })
  cookieStore.set('github_login_state', '', { maxAge: 0, path: '/' })

  const isLoginCallback = savedLoginState === state
  const isConnectCallback = savedConnectState === state

  if (!isLoginCallback && !isConnectCallback) {
    return NextResponse.redirect(`${origin}/login?error=github_invalid_state`)
  }

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return NextResponse.redirect(
      isConnectCallback
        ? `${SITE_URL}/settings?github_error=not_configured`
        : `${origin}/login?error=github_not_configured`
    )
  }

  const { token, user: githubUser } = await exchangeCodeForGitHubUser(code)

  if (!token || !githubUser?.login) {
    return NextResponse.redirect(
      isConnectCallback
        ? `${SITE_URL}/settings?github_error=token_failed`
        : `${origin}/login?error=github_token_failed`
    )
  }

  if (isLoginCallback) {
    const session: LocalGitHubSession = {
      login: githubUser.login,
      name: githubUser.name ?? githubUser.login,
      avatar_url: githubUser.avatar_url ?? null,
    }

    cookieStore.set(LOCAL_GITHUB_SESSION_COOKIE, encodeLocalGitHubSession(session), {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.redirect(`${origin}/dashboard`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${SITE_URL}/login`)
  }

  await supabase.from('github_connections').upsert(
    {
      user_id: user.id,
      github_access_token: token,
      github_login: githubUser.login,
    },
    { onConflict: 'user_id' }
  )

  return NextResponse.redirect(`${SITE_URL}/settings?github_connected=1`)
}
