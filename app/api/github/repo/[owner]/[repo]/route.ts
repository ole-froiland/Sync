import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

async function getGithubToken() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (SUPABASE_CONFIGURED && !user) {
    return { token: null as string | null, unauthorized: true }
  }

  let token: string | null = null
  if (SUPABASE_CONFIGURED && user) {
    const { data } = await supabase
      .from('github_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .single()
    token = data?.access_token ?? null
  }

  token ??= process.env.GITHUB_TOKEN ?? null
  return { token, unauthorized: false }
}

function ghHeaders(token: string, accept = 'application/vnd.github.v3+json') {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await context.params
  const { token, unauthorized } = await getGithubToken()

  if (unauthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!token) {
    return NextResponse.json(
      { error: 'GitHub not connected.', code: 'not_connected' },
      { status: 403 }
    )
  }

  try {
    const [repoRes, readmeRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: ghHeaders(token),
        next: { revalidate: 0 },
      }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
        headers: ghHeaders(token, 'application/vnd.github.raw'),
        next: { revalidate: 0 },
      }),
    ])

    if (repoRes.status === 401) {
      return NextResponse.json(
        { error: 'GitHub token expired or revoked.', code: 'token_expired' },
        { status: 401 }
      )
    }

    if (repoRes.status === 404) {
      return NextResponse.json({ error: 'Repository not found.', code: 'not_found' }, { status: 404 })
    }

    if (!repoRes.ok) {
      return NextResponse.json(
        { error: `GitHub API error: ${repoRes.status}`, code: 'github_error' },
        { status: repoRes.status }
      )
    }

    const data = (await repoRes.json()) as Record<string, unknown>

    const readme = readmeRes.ok ? await readmeRes.text() : null

    const ownerObj = data.owner as { login?: string; avatar_url?: string } | null

    return NextResponse.json({
      id: data.id,
      name: data.name,
      full_name: data.full_name,
      description: data.description ?? null,
      private: data.private,
      visibility: data.visibility,
      default_branch: data.default_branch,
      updated_at: data.updated_at,
      pushed_at: data.pushed_at,
      created_at: data.created_at,
      html_url: data.html_url,
      clone_url: data.clone_url,
      ssh_url: data.ssh_url,
      language: data.language ?? null,
      fork: data.fork,
      archived: data.archived,
      stargazers_count: data.stargazers_count ?? 0,
      forks_count: data.forks_count ?? 0,
      open_issues_count: data.open_issues_count ?? 0,
      watchers_count: data.watchers_count ?? 0,
      size: data.size ?? 0,
      license: (data.license as { spdx_id?: string; name?: string } | null) ?? null,
      homepage: data.homepage ?? null,
      topics: (data.topics as string[] | undefined) ?? [],
      owner: ownerObj
        ? { login: ownerObj.login ?? '', avatar_url: ownerObj.avatar_url ?? '' }
        : null,
      readme,
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch repository', code: 'network_error' },
      { status: 500 }
    )
  }
}
