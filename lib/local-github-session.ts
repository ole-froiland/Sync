import type { Profile } from '@/types'

export const LOCAL_GITHUB_SESSION_COOKIE = 'sync_local_github_session'

export type LocalGitHubSession = {
  login: string
  name: string | null
  avatar_url: string | null
}

export function encodeLocalGitHubSession(session: LocalGitHubSession) {
  return Buffer.from(JSON.stringify(session), 'utf8').toString('base64url')
}

export function decodeLocalGitHubSession(value: string | undefined) {
  if (!value) return null

  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as LocalGitHubSession
  } catch {
    return null
  }
}

export function localGitHubProfile(session: LocalGitHubSession): Profile {
  return {
    id: `github:${session.login}`,
    email: '',
    name: session.name ?? session.login,
    avatar_url: session.avatar_url,
    role: 'GitHub',
    tools_used: ['GitHub'],
    created_at: new Date().toISOString(),
  }
}
