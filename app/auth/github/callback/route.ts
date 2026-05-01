import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import {
  encodeLocalGitHubSession,
  LOCAL_GITHUB_SESSION_COOKIE,
  type LocalGitHubSession,
} from '@/lib/local-github-session'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET

type GitHubUser = {
  login?: string
  name?: string | null
  avatar_url?: string | null
}

export async function GET(request: NextRequest) {
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
  const savedState = cookieStore.get('github_login_state')?.value
  cookieStore.set('github_login_state', '', { maxAge: 0, path: '/' })

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${origin}/login?error=github_invalid_state`)
  }

  if (
    !GITHUB_CLIENT_ID ||
    !GITHUB_CLIENT_SECRET ||
    GITHUB_CLIENT_ID.startsWith('your_') ||
    GITHUB_CLIENT_SECRET.startsWith('your_')
  ) {
    return NextResponse.redirect(`${origin}/login?error=github_not_configured`)
  }

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
    return NextResponse.redirect(`${origin}/login?error=github_token_failed`)
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!userRes.ok) {
    return NextResponse.redirect(`${origin}/login?error=github_profile_failed`)
  }

  const githubUser = (await userRes.json()) as GitHubUser
  if (!githubUser.login) {
    return NextResponse.redirect(`${origin}/login?error=github_profile_failed`)
  }

  const session: LocalGitHubSession = {
    login: githubUser.login,
    name: githubUser.name ?? githubUser.login,
    avatar_url: githubUser.avatar_url ?? null,
  }

  cookieStore.set(LOCAL_GITHUB_SESSION_COOKIE, encodeLocalGitHubSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return NextResponse.redirect(`${origin}/dashboard`)
}
