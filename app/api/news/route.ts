import type { FeedItem } from '@/types'

export const revalidate = 900 // 15 minutes

// ─── RSS / Atom sources ───────────────────────────────────────────────────────

type SourceConfig = { name: string; url: string; max: number }

function googleNewsUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    hl: 'en-US',
    gl: 'US',
    ceid: 'US:en',
  })

  return `https://news.google.com/rss/search?${params.toString()}`
}

const RSS_SOURCES: SourceConfig[] = [
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', max: 4 },
  { name: 'Anthropic', url: 'https://www.anthropic.com/news/rss.xml', max: 4 },
  { name: 'Google AI', url: 'https://blog.google/technology/ai/rss/', max: 3 },
  { name: 'DeepMind', url: 'https://deepmind.google/discover/blog/rss.xml', max: 3 },
  { name: 'AI Markets', url: googleNewsUrl('(OpenAI OR Anthropic OR Google Gemini OR Meta AI OR Microsoft Copilot) (valuation OR funding OR revenue OR earnings OR profit)'), max: 5 },
  { name: 'AI Chips', url: googleNewsUrl('(Nvidia OR AMD OR Broadcom) (AI OR datacenter OR data center OR GPU) (earnings OR revenue OR chips)'), max: 4 },
  { name: 'AI Jobs', url: googleNewsUrl('(AI OR artificial intelligence) (layoffs OR job cuts OR restructuring OR replaces workers)'), max: 3 },
  { name: 'AI Infrastructure', url: googleNewsUrl('(AI datacenter OR AI data center OR AI factory OR sovereign AI OR cloud AI infrastructure)'), max: 3 },
  { name: 'Norway AI', url: googleNewsUrl('(Norway OR Norwegian OR Telenor OR Nordic) (AI OR artificial intelligence OR AI factory)'), max: 3 },
  { name: 'Meta AI', url: googleNewsUrl('Meta AI (Llama OR model OR artificial intelligence OR AI strategy)'), max: 3 },
  { name: 'Microsoft AI', url: googleNewsUrl('(Microsoft Copilot OR Microsoft AI) (launch OR revenue OR earnings OR investment OR strategy OR data center OR layoffs)'), max: 3 },
  { name: 'DeepSeek', url: googleNewsUrl('DeepSeek (AI OR model OR LLM OR chatbot)'), max: 2 },
  { name: 'The Decoder', url: 'https://the-decoder.com/feed/', max: 3 },
]

const AI_COMPANY_OR_MODEL_PATTERNS = [
  /\b(?:openai|anthropic|claude|chatgpt|deepseek|deepmind|gemini|llama|meta ai|microsoft copilot|copilot|gpt-?\d*)\b/i,
  /\b(?:nvidia|amd|broadcom|tsmc|google|alphabet|meta|microsoft|telenor|cloudflare|softbank)\b/i,
  /\b(?:llm|large language model|foundation model|frontier model|reasoning model|multimodal model|ai model)\b/i,
]

const AI_NEWS_SIGNAL_PATTERNS = [
  /\b(?:ai|a\.i\.|artificial intelligence|generative ai|agentic ai)\b/i,
  /\b(?:launch(?:es|ed)?|announce(?:s|d)?|unveil(?:s|ed)?|release(?:s|d)?|rolls out|introduced?|debuts?)\b/i,
  /\b(?:valuation|funding|fundraising|raises?|revenue|earnings|profit|forecast|guidance|stock|shares?)\b/i,
  /\b(?:datacenter|data center|gpu|chips?|ai factory|sovereign ai|infrastructure|investment|acquisition|partnership)\b/i,
  /\b(?:layoffs|job cuts|restructuring|replaces workers|automation)\b/i,
  /\b(?:benchmark|price cut|pricing|standard model|default model|strategy|roadmap)\b/i,
]

const LOW_VALUE_AI_PATTERNS = [
  /\b(?:hot wheels|ferrari|superfans?|wearable|coding agents?|claude code|farm of the future)\b/i,
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

function extractSourceUrl(block: string): string | null {
  const match = /<source[^>]+url=["']([^"']+)["']/i.exec(block)
  return match?.[1]?.startsWith('http') ? match[1] : null
}

function publisherLogoUrl(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(sourceUrl)}&sz=256`
}

function stripHtml(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
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
  const lowValue = LOW_VALUE_AI_PATTERNS.some((pattern) => pattern.test(titleAndPreview))
  const mentionsRelevantCompanyOrModel = AI_COMPANY_OR_MODEL_PATTERNS.some((pattern) =>
    pattern.test(titleAndPreview)
  )
  const hasNewsSignal = AI_NEWS_SIGNAL_PATTERNS.some((pattern) => pattern.test(titleAndPreview))

  return !lowValue && mentionsRelevantCompanyOrModel && hasNewsSignal
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
      imageUrl: extractImage(block) ?? publisherLogoUrl(extractSourceUrl(block)),
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
