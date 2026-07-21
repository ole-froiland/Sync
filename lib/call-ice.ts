export const GOOGLE_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const METERED_DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.metered\.live$/
const ICE_URL_PATTERN = /^(?:stun|turn|turns):[^\s]+$/

export class IceConfigurationError extends Error {
  constructor(
    message: string,
    readonly status: 502 | 503
  ) {
    super(message)
    this.name = 'IceConfigurationError'
  }
}

function parseUrls(value: unknown): string | string[] | null {
  if (typeof value === 'string') {
    return value.length <= 2_048 && ICE_URL_PATTERN.test(value) ? value : null
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) return null
  if (!value.every((url) => typeof url === 'string' && url.length <= 2_048 && ICE_URL_PATTERN.test(url))) {
    return null
  }
  return value
}

function includesTurnUrl(urls: string | string[]) {
  return (Array.isArray(urls) ? urls : [urls]).some(
    (url) => url.startsWith('turn:') || url.startsWith('turns:')
  )
}

export function parseIceServers(value: unknown): RTCIceServer[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null

  const servers: RTCIceServer[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const server = item as Record<string, unknown>
    const urls = parseUrls(server.urls)
    if (!urls) return null

    if (includesTurnUrl(urls)) {
      if (
        typeof server.username !== 'string' ||
        !server.username ||
        server.username.length > 512 ||
        typeof server.credential !== 'string' ||
        !server.credential ||
        server.credential.length > 512
      ) {
        return null
      }
      servers.push({ urls, username: server.username, credential: server.credential })
    } else {
      servers.push({ urls })
    }
  }
  return servers
}

export function hasTurnServer(servers: RTCIceServer[]) {
  return servers.some((server) => includesTurnUrl(server.urls))
}

export async function fetchMeteredIceServers({
  domain,
  apiKey,
  fetchImpl = fetch,
}: {
  domain: string | undefined
  apiKey: string | undefined
  fetchImpl?: typeof fetch
}): Promise<RTCIceServer[]> {
  const normalizedDomain = domain?.trim().toLowerCase()
  if (!normalizedDomain || !METERED_DOMAIN_PATTERN.test(normalizedDomain)) {
    throw new IceConfigurationError('TURN is not configured correctly.', 503)
  }
  if (!apiKey?.trim() || apiKey.length > 1_024) {
    throw new IceConfigurationError('TURN is not configured correctly.', 503)
  }

  const endpoint = new URL(`https://${normalizedDomain}/api/v1/turn/credentials`)
  endpoint.searchParams.set('apiKey', apiKey)

  let response: Response
  try {
    response = await fetchImpl(endpoint, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    throw new IceConfigurationError('TURN configuration is temporarily unavailable.', 502)
  }
  if (!response.ok) {
    throw new IceConfigurationError('TURN configuration is temporarily unavailable.', 502)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new IceConfigurationError('TURN returned an invalid configuration.', 502)
  }
  const servers = parseIceServers(body)
  if (!servers || !hasTurnServer(servers)) {
    throw new IceConfigurationError('TURN returned an invalid configuration.', 502)
  }
  return [...GOOGLE_STUN_SERVERS, ...servers]
}
