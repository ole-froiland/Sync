import { NextResponse } from 'next/server'
import {
  buildGitHubTrendingUrl,
  isTrendingKind,
  isTrendingSince,
  parseTrendingDevelopers,
  parseTrendingLanguages,
  parseTrendingRepositories,
} from '@/lib/github-trending'

const CACHE_SECONDS = 300
const STALE_SECONDS = 600

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const kindParam = params.get('kind')
  const sinceParam = params.get('since')
  const kind = isTrendingKind(kindParam) ? kindParam : 'repositories'
  const since = isTrendingSince(sinceParam) ? sinceParam : 'weekly'
  const language = params.get('language') ?? 'all'
  const sourceUrl = buildGitHubTrendingUrl(kind, since, language)

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Sync GitHub Trending fetcher',
      },
      next: { revalidate: CACHE_SECONDS },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `GitHub Trending error: ${response.status}` },
        { status: response.status }
      )
    }

    const html = await response.text()
    const languages = parseTrendingLanguages(html, kind)
    const payload =
      kind === 'developers'
        ? {
            kind,
            since,
            language,
            sourceUrl,
            languages,
            developers: parseTrendingDevelopers(html),
          }
        : {
            kind,
            since,
            language,
            sourceUrl,
            languages,
            repositories: parseTrendingRepositories(html),
          }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch GitHub Trending' },
      { status: 502 }
    )
  }
}
