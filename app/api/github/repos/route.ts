import { NextResponse } from 'next/server'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const RANGE_DAYS = {
  daily: 1,
  weekly: 7,
  monthly: 30,
} as const

type Range = keyof typeof RANGE_DAYS

export const revalidate = 600 // cache 10 minutes

export async function GET(request: Request) {
  const rangeParam = new URL(request.url).searchParams.get('range')
  const range = isRange(rangeParam) ? rangeParam : 'weekly'
  const since = new Date(Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000)
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
      `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=25`,
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

function isRange(value: string | null): value is Range {
  return value === 'daily' || value === 'weekly' || value === 'monthly'
}
