import { NextResponse } from 'next/server'
import {
  fetchGitHubTrending,
  TRENDING_CACHE_CONTROL,
} from '@/lib/github-trending-service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const result = await fetchGitHubTrending({
    kind: params.get('kind'),
    since: params.get('since'),
    language: params.get('language'),
  })

  return NextResponse.json(result.payload, {
    status: result.status,
    headers: {
      'Cache-Control': TRENDING_CACHE_CONTROL,
    },
  })
}
