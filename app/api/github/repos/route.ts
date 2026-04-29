import { NextResponse } from 'next/server'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN

export const revalidate = 600 // cache 10 minutes

export async function GET() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`
  }

  try {
    const res = await fetch(
      `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=6`,
      { headers, next: { revalidate: 600 } }
    )

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub API error: ${res.status}` },
        { status: res.status }
      )
    }

    const { items } = await res.json()
    return NextResponse.json(items ?? [])
  } catch {
    return NextResponse.json({ error: 'Failed to fetch GitHub repos' }, { status: 500 })
  }
}
