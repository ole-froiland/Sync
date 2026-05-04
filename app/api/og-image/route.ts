import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url?.startsWith('http')) {
    return Response.json({ imageUrl: null })
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8_000),
      // Cache the external fetch for 1 hour per URL
      next: { revalidate: 3600 },
    })

    if (!res.ok || !res.body) return Response.json({ imageUrl: null })

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

    // Match og:image in either attribute order, with single or double quotes
    const match =
      /property=["']og:image["'][^>]+content=["']([^"'>\s]+)["']/i.exec(html) ??
      /content=["']([^"'>\s]+)["'][^>]+property=["']og:image["']/i.exec(html)

    let imageUrl = match?.[1] ?? null
    if (!imageUrl) return Response.json({ imageUrl: null })

    // Decode common HTML entities
    imageUrl = imageUrl.replace(/&amp;/g, '&')

    // Resolve relative URLs
    if (!imageUrl.startsWith('http')) {
      try {
        imageUrl = new URL(imageUrl, url).href
      } catch {
        return Response.json({ imageUrl: null })
      }
    }

    return Response.json({ imageUrl })
  } catch {
    return Response.json({ imageUrl: null })
  }
}
