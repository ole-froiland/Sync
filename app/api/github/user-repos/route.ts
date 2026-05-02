import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GitHubUserRepo } from '@/types'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (SUPABASE_CONFIGURED && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let githubToken: string | null = null

  if (SUPABASE_CONFIGURED && user) {
    const { data: connection } = await supabase
      .from('github_connections')
      .select('github_access_token')
      .eq('user_id', user.id)
      .single()

    githubToken = connection?.github_access_token ?? null
  }

  githubToken ??= process.env.GITHUB_TOKEN ?? null

  if (!githubToken) {
    return NextResponse.json(
      {
        error: 'GitHub not connected. Go to Settings → Connected accounts to link your GitHub.',
        code: 'not_connected',
      },
      { status: 403 }
    )
  }

  try {
    const res = await fetch(
      'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner',
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
        next: { revalidate: 0 },
      }
    )

    if (res.status === 401) {
      return NextResponse.json(
        {
          error: 'GitHub token expired or revoked. Please reconnect your GitHub account in Settings.',
          code: 'token_expired',
        },
        { status: 401 }
      )
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub API error: ${res.status}`, code: 'github_error' },
        { status: res.status }
      )
    }

    const raw: Array<Record<string, unknown>> = await res.json()

    const repos: GitHubUserRepo[] = raw.map((repo) => ({
      id: repo.id as number,
      name: repo.name as string,
      full_name: repo.full_name as string,
      description: (repo.description as string | null) ?? null,
      private: repo.private as boolean,
      visibility: repo.visibility as string,
      default_branch: repo.default_branch as string,
      updated_at: repo.updated_at as string,
      html_url: repo.html_url as string,
      language: (repo.language as string | null) ?? null,
      fork: repo.fork as boolean,
      archived: repo.archived as boolean,
    }))

    return NextResponse.json(repos)
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch repositories', code: 'network_error' },
      { status: 500 }
    )
  }
}
