import {
  fetchGitHubTrending,
  TRENDING_CACHE_CONTROL,
} from '../../lib/github-trending-service'

type NetlifyEvent = {
  queryStringParameters?: Record<string, string | undefined> | null
}

export async function handler(event: NetlifyEvent) {
  const params = event.queryStringParameters ?? {}
  const result = await fetchGitHubTrending({
    kind: params.kind,
    since: params.since,
    language: params.language,
  })

  return {
    statusCode: result.status,
    headers: {
      'Cache-Control': TRENDING_CACHE_CONTROL,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(result.payload),
  }
}
