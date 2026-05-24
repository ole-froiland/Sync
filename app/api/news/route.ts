import type { FeedItem } from '@/types'

export const revalidate = 900 // 15 minutes

// ─── RSS / Atom sources ───────────────────────────────────────────────────────

type SourceConfig = { name: string; url: string; max: number }

const RSS_SOURCES: SourceConfig[] = [
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', max: 4 },
  { name: 'OpenAI Dev', url: 'https://developers.openai.com/rss.xml', max: 4 },
  { name: 'Anthropic', url: 'https://www.anthropic.com/news/rss.xml', max: 4 },
  { name: 'Google AI', url: 'https://blog.google/technology/ai/rss/', max: 3 },
  { name: 'DeepMind', url: 'https://deepmind.google/discover/blog/rss.xml', max: 3 },
  { name: 'Meta AI', url: 'https://news.google.com/rss/search?q=site%3Aai.meta.com%2Fblog%20AI&hl=en-US&gl=US&ceid=US%3Aen', max: 3 },
  { name: 'Microsoft AI', url: 'https://blogs.microsoft.com/ai/feed/', max: 3 },
  { name: 'DeepSeek', url: 'https://news.google.com/rss/search?q=%22DeepSeek%22%20%28AI%20OR%20model%20OR%20LLM%29&hl=en-US&gl=US&ceid=US%3Aen', max: 2 },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', max: 3 },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', max: 3 },
  { name: 'The Decoder', url: 'https://the-decoder.com/feed/', max: 3 },
]

const AI_TOPIC_PATTERNS = [
  /\b(?:ai|a\.i\.|artificial intelligence|generative ai|genai)\b/i,
  /\b(?:openai|anthropic|claude|chatgpt|deepseek|deepmind|gemini|llama|meta ai|microsoft ai)\b/i,
  /\b(?:gpt-?\d*|llm|large language model|foundation model|frontier model|reasoning model|multimodal model)\b/i,
  /\b(?:ai agent|agentic ai|coding agent|computer use|model context protocol|mcp server)\b/i,
  /\b(?:inference|fine-tuning|fine tuning|prompt engineering|ai benchmark|ai model)\b/i,
]

// ─── XML helpers ──────────────────────────────────────────────────────────────

function getTagContent(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = re.exec(xml)
  if (!m) return null
  const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(m[1])
  return (cdata ? cdata[1] : m[1]).trim() || null
}

function extractLink(block: string): string | null {
  // RSS: <link>url</link>
  const rss = /<link[^/]*>\s*([^\s<][^<]*)<\/link>/i.exec(block)
  if (rss?.[1]?.startsWith('http')) return rss[1].trim()
  // Atom: <link href="url"> — prefer rel=alternate, then any href
  const atom =
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']alternate["']/i.exec(block) ??
    /<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i.exec(block) ??
    /<link[^>]+href=["']([^"']+)["']/i.exec(block)
  return atom?.[1]?.startsWith('http') ? atom[1] : null
}

function extractImage(block: string): string | null {
  // media:content
  const mc = /<media:content[^>]+url=["']([^"']+)["']/i.exec(block)
  if (mc?.[1]?.startsWith('http')) return mc[1]
  // media:thumbnail
  const mt = /<media:thumbnail[^>]+url=["']([^"']+)["']/i.exec(block)
  if (mt?.[1]?.startsWith('http')) return mt[1]
  // enclosure with image MIME type (both attribute orders)
  const enc =
    /<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\//i.exec(block) ??
    /<enclosure[^>]+type=["']image\/[^"']+["'][^>]+url=["']([^"']+)["']/i.exec(block)
  if (enc?.[1]) return enc[1]
  // First <img> in HTML content
  const img = /<img[^>]+src=["']([^"']+)["']/i.exec(block)
  return img?.[1]?.startsWith('http') ? img[1] : null
}

function extractAuthor(block: string): string | null {
  // dc:creator
  const dc = /<dc:creator[^>]*>(?:<!\[CDATA\[)?([^\]<]+?)(?:\]\]>)?<\/dc:creator>/i.exec(block)
  if (dc?.[1]?.trim()) return dc[1].trim()
  // Atom <author><name>...</name></author>
  const atomName = /<author[^>]*>[\s\S]*?<name>([^<]+)<\/name>/i.exec(block)
  if (atomName?.[1]?.trim()) return atomName[1].trim()
  // RSS <author>email (Name)</author>
  const auth = /<author[^>]*>(?:<!\[CDATA\[)?([^\]<]+?)(?:\]\]>)?<\/author>/i.exec(block)
  if (auth?.[1]) {
    const nameInParens = /\(([^)]+)\)/.exec(auth[1])
    return (nameInParens?.[1] ?? auth[1]).trim() || null
  }
  return null
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDate(str: string | null): number {
  if (!str) return 0
  const d = new Date(str.trim())
  return isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000)
}

function isAiTechItem(item: FeedItem): boolean {
  const titleAndPreview = [item.title, item.description ?? ''].join(' ')

  return AI_TOPIC_PATTERNS.some((pattern) => pattern.test(titleAndPreview))
}

function normalizeUrl(url: string): string {
  return url.split('?')[0].replace(/\/+$/, '').toLowerCase()
}

function parseRssFeed(xml: string, source: string, max: number): FeedItem[] {
  const items: FeedItem[] = []
  // Detect RSS (<item>) vs Atom (<entry>)
  const blockTag = /<entry[\s>]/.test(xml) ? 'entry' : 'item'
  const pattern = new RegExp(`<${blockTag}[^>]*>([\\s\\S]*?)<\\/${blockTag}>`, 'gi')

  let m: RegExpExecArray | null
  while ((m = pattern.exec(xml)) !== null && items.length < max) {
    const block = m[1]

    const rawTitle = getTagContent(block, 'title')
    if (!rawTitle) continue
    const title = stripHtml(rawTitle)
    if (!title) continue

    const url = extractLink(block)
    if (!url?.startsWith('http')) continue

    const rawDesc =
      getTagContent(block, 'content:encoded') ??
      getTagContent(block, 'description') ??
      getTagContent(block, 'summary') ??
      getTagContent(block, 'content')
    const description = rawDesc ? stripHtml(rawDesc).slice(0, 280) || null : null

    const pubRaw =
      getTagContent(block, 'pubDate') ??
      getTagContent(block, 'published') ??
      getTagContent(block, 'updated')

    items.push({
      id: normalizeUrl(url),
      title,
      description,
      source,
      author: extractAuthor(block),
      publishedAt: parseDate(pubRaw),
      url,
      imageUrl: extractImage(block),
    })
  }

  return items
}

async function fetchRssSource(config: SourceConfig): Promise<FeedItem[]> {
  const res = await fetch(config.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 900 },
  })
  if (!res.ok) return []
  const xml = await res.text()
  return parseRssFeed(xml, config.name, config.max)
}

// ─── Merge, deduplicate, sort ─────────────────────────────────────────────────

function deduplicate(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = normalizeUrl(item.url)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const results = await Promise.allSettled(RSS_SOURCES.map(fetchRssSource))

  const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  const deduped = deduplicate(all.filter(isAiTechItem))

  // Newest first; zero-timestamp items (unparseable date) go last
  deduped.sort((a, b) => {
    if (a.publishedAt === 0 && b.publishedAt === 0) return 0
    if (a.publishedAt === 0) return 1
    if (b.publishedAt === 0) return -1
    return b.publishedAt - a.publishedAt
  })

  return Response.json(deduped.slice(0, 40))
}
