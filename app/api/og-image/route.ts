import type { NextRequest } from 'next/server'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { isAuthenticated } from '@/lib/api-auth'

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isPrivateAddress(ip: string): boolean {
  const addr = ip.toLowerCase()
  if (isIP(addr) === 4) return isPrivateIPv4(addr)
  if (addr === '::' || addr === '::1') return true
  if (addr.startsWith('fe80:') || addr.startsWith('fc') || addr.startsWith('fd')) return true
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr)
  if (mapped) return isPrivateIPv4(mapped[1])
  return false
}

/**
 * SSRF guard: this route fetches attacker-controllable URLs server-side, so
 * every target (including each redirect hop) must resolve to a public
 * address — otherwise it could be used to probe localhost, the internal
 * network, or cloud metadata endpoints like 169.254.169.254.
 */
async function isBlockedTarget(target: URL): Promise<boolean> {
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return true
  if (target.username || target.password) return true
  const host = target.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host)) return isPrivateAddress(host)
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true
  }
  try {
    const addresses = await lookup(host, { all: true })
    return addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))
  } catch {
    return true
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return Response.json({ imageUrl: null }, { status: 401 })
  }

  let target: URL
  try {
    target = new URL(request.nextUrl.searchParams.get('url') ?? '')
  } catch {
    return Response.json({ imageUrl: null })
  }

  try {
    // Follow redirects manually so every hop passes the SSRF guard.
    let res: Response | null = null
    for (let hop = 0; hop < 4; hop++) {
      if (await isBlockedTarget(target)) return Response.json({ imageUrl: null })
      res = await fetch(target.href, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(8_000),
        redirect: 'manual',
        // Cache the external fetch for 1 hour per URL
        next: { revalidate: 3600 },
      })
      const location = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && location) {
        target = new URL(location, target)
        continue
      }
      break
    }

    if (!res || !res.ok || !res.body) return Response.json({ imageUrl: null })

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('html')) return Response.json({ imageUrl: null })

    // Read only until </head> or 50 KB to avoid fetching full pages
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let html = ''

    try {
      while (html.length < 50_000) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
        if (html.includes('</head>') || html.includes('<body')) break
      }
    } finally {
      await reader.cancel()
    }

    // Match common social image metadata in either attribute order.
    const match =
      /property=["']og:image["'][^>]+content=["']([^"'>\s]+)["']/i.exec(html) ??
      /content=["']([^"'>\s]+)["'][^>]+property=["']og:image["']/i.exec(html) ??
      /name=["']twitter:image(?::src)?["'][^>]+content=["']([^"'>\s]+)["']/i.exec(html) ??
      /content=["']([^"'>\s]+)["'][^>]+name=["']twitter:image(?::src)?["']/i.exec(html) ??
      /rel=["']image_src["'][^>]+href=["']([^"'>\s]+)["']/i.exec(html) ??
      /href=["']([^"'>\s]+)["'][^>]+rel=["']image_src["']/i.exec(html)

    let imageUrl = match?.[1] ?? null
    if (!imageUrl) return Response.json({ imageUrl: null })

    // Decode common HTML entities
    imageUrl = imageUrl.replace(/&amp;/g, '&')

    // Resolve relative URLs
    if (!imageUrl.startsWith('http')) {
      try {
        imageUrl = new URL(imageUrl, target).href
      } catch {
        return Response.json({ imageUrl: null })
      }
    }

    return Response.json({ imageUrl })
  } catch {
    return Response.json({ imageUrl: null })
  }
}
