import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (SUPABASE_CONFIGURED && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Resolve GitHub token: prefer per-user OAuth token, fall back to env var (dev only)
  let githubToken: string | null = null

  if (SUPABASE_CONFIGURED && user) {
    const { data: connection } = await supabase
      .from('github_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .single()

    githubToken = connection?.access_token ?? null
  }

  githubToken ??= process.env.GITHUB_TOKEN ?? null

  if (!githubToken) {
    return NextResponse.json(
      {
        error:
          'GitHub not connected. Go to Settings → Connected accounts to link your GitHub.',
      },
      { status: 403 }
    )
  }

  const body = await request.json()
  const { name, description, private: isPrivate } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Repository name is required' }, { status: 400 })
  }

  const repoRes = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name.trim(),
      description: description?.trim() || undefined,
      private: isPrivate ?? false,
      auto_init: true,
    }),
  })

  const repoData = await repoRes.json()

  if (!repoRes.ok) {
    return NextResponse.json(
      { error: repoData.message ?? 'GitHub API error' },
      { status: repoRes.status }
    )
  }

  // Persist to Supabase projects table
  let project = null
  if (SUPABASE_CONFIGURED && user) {
    const { data } = await supabase
      .from('projects')
      .insert({
        name: repoData.name,
        description: repoData.description || null,
        status: 'building',
        github_url: repoData.html_url,
        created_by: user.id,
      })
      .select()
      .single()

    if (data) {
      await supabase.from('project_members').insert({
        project_id: data.id,
        user_id: user.id,
        role: 'owner',
      })
      project = { ...data, member_count: 1, task_count: 0, members: [] }
    }
  }

  return NextResponse.json({
    repo: { name: repoData.name, html_url: repoData.html_url, full_name: repoData.full_name },
    project,
  })
}
