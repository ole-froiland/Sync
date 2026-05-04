import {
  buildGitHubTrendingUrl,
  isTrendingKind,
  isTrendingSince,
  parseTrendingDevelopers,
  parseTrendingLanguages,
  parseTrendingRepositories,
  type TrendingKind,
  type TrendingSince,
} from './github-trending'
import type { TrendingResponse } from '@/types'

export type TrendingRequest = {
  kind?: string | null
  since?: string | null
  language?: string | null
}

export type TrendingResult =
  | {
      ok: true
      status: number
      payload: TrendingResponse
    }
  | {
      ok: false
      status: number
      payload: { error: string }
    }

export const TRENDING_CACHE_CONTROL = 'no-store'

export async function fetchGitHubTrending({
  kind: requestedKind,
  since: requestedSince,
  language: requestedLanguage,
}: TrendingRequest): Promise<TrendingResult> {
  const kindParam = requestedKind ?? null
  const sinceParam = requestedSince ?? null
  const kind: TrendingKind = isTrendingKind(kindParam) ? kindParam : 'repositories'
  const since: TrendingSince = isTrendingSince(sinceParam) ? sinceParam : 'weekly'
  const language = requestedLanguage ?? 'all'
  const sourceUrl = buildGitHubTrendingUrl(kind, since, language)

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Sync GitHub Trending fetcher',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        payload: { error: `GitHub Trending error: ${response.status}` },
      }
    }

    const html = await response.text()
    const languages = parseTrendingLanguages(html, kind)
    const payload: TrendingResponse =
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

    return {
      ok: true,
      status: 200,
      payload,
    }
  } catch {
    return {
      ok: false,
      status: 502,
      payload: { error: 'Failed to fetch GitHub Trending' },
    }
  }
}
