import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import {
  encodeLocalGitHubSession,
  LOCAL_GITHUB_SESSION_COOKIE,
  type LocalGitHubSession,
} from '@/lib/local-github-session'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const IS_PRODUCTION = process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test'

type GitHubUser = {
  login?: string
  name?: string | null
  avatar_url?: string | null
}

function isConfigured(value: string | undefined) {
  return Boolean(value) && !value?.startsWith('your_')
}

async function signInWithToken(origin: string) {
  if (IS_PRODUCTION) {
    return NextResponse.redirect(`${origin}/login?error=github_not_configured`)
  }

  if (!isConfigured(GITHUB_TOKEN)) {
    return NextResponse.redirect(`${origin}/login?error=github_not_configured`)
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!userRes.ok) {
    return NextResponse.redirect(`${origin}/login?error=github_token_failed`)
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

  const cookieStore = await cookies()
  cookieStore.set(LOCAL_GITHUB_SESSION_COOKIE, encodeLocalGitHubSession(session), {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return NextResponse.redirect(`${origin}/dashboard`)
}

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  if (!isConfigured(GITHUB_CLIENT_ID)) {
    return signInWithToken(origin)
  }

  const clientId = GITHUB_CLIENT_ID as string
  const state = crypto.randomUUID()
  const cookieStore = await cookies()
  cookieStore.set('github_login_state', state, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/github/callback`,
    scope: 'read:user user:email',
    state,
  })

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`)
}
