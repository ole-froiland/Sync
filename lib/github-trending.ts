import type {
  TrendingBuiltByUser,
  TrendingDeveloper,
  TrendingLanguage,
  TrendingRepository,
} from '@/types'

export type TrendingKind = 'repositories' | 'developers'
export type TrendingSince = 'daily' | 'weekly' | 'monthly'

const GITHUB_ORIGIN = 'https://github.com'

export function buildGitHubTrendingUrl(
  kind: TrendingKind,
  since: TrendingSince,
  language: string
) {
  const basePath = kind === 'developers' ? '/trending/developers' : '/trending'
  const languagePath = normalizeLanguageSlug(language)
  const path = languagePath ? `${basePath}/${languagePath}` : basePath

  return `${GITHUB_ORIGIN}${path}?since=${since}`
}

export function isTrendingKind(value: string | null): value is TrendingKind {
  return value === 'repositories' || value === 'developers'
}

export function isTrendingSince(value: string | null): value is TrendingSince {
  return value === 'daily' || value === 'weekly' || value === 'monthly'
}

export function parseTrendingRepositories(html: string): TrendingRepository[] {
  return getBoxRows(html)
    .map((block, index) => parseRepositoryBlock(block, index + 1))
    .filter((repo): repo is TrendingRepository => repo !== null)
}

export function parseTrendingDevelopers(html: string): TrendingDeveloper[] {
  return getBoxRows(html)
    .map((block, index) => parseDeveloperBlock(block, index + 1))
    .filter((developer): developer is TrendingDeveloper => developer !== null)
}

export function parseTrendingLanguages(html: string, kind: TrendingKind): TrendingLanguage[] {
  const languages = new Map<string, TrendingLanguage>()
  const prefix = kind === 'developers' ? '/trending/developers/' : '/trending/'
  const pattern = new RegExp(
    `href="${escapeRegExp(prefix)}([^/"?]+)\\?since=[^"]*"[\\s\\S]*?<span[^>]*class="[^"]*select-menu-item-text[^"]*"[^>]*>([\\s\\S]*?)<\\/span>`,
    'g'
  )

  for (const match of html.matchAll(pattern)) {
    const slug = decodeHtml(match[1])
    const label = cleanText(match[2])

    if (slug && label && !languages.has(slug)) {
      languages.set(slug, { label, slug })
    }
  }

  return Array.from(languages.values())
}

function parseRepositoryBlock(block: string, rank: number): TrendingRepository | null {
  const heading = block.match(
    /<h2[^>]*>[\s\S]*?<a[^>]*href="(\/[^/"?#]+\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/
  )
  if (!heading) return null

  const path = decodeHtml(heading[1])
  const [owner, name] = path.slice(1).split('/')
  if (!owner || !name) return null

  const fullName = `${owner}/${name}`
  const description = optionalText(
    block.match(/<p[^>]*class="[^"]*color-fg-muted[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1]
  )
  const language = optionalText(
    block.match(/<span[^>]*itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/)?.[1]
  )
  const totalStars = parseNumber(
    block.match(/\/stargazers"[\s\S]*?<\/svg>\s*([\d,]+)/)?.[1]
  )
  const forks = parseNumber(block.match(/\/forks"[\s\S]*?<\/svg>\s*([\d,]+)/)?.[1])
  const starsThisPeriod = parseNumber(
    block.match(/([\d,]+)\s+stars this (?:day|week|month)/)?.[1]
  )
  const builtBy = parseBuiltByUsers(block)

  return {
    rank,
    owner,
    name,
    fullName,
    description,
    language,
    totalStars,
    forks,
    starsThisPeriod,
    builtBy: builtBy.length > 0 ? builtBy : undefined,
    repoUrl: `${GITHUB_ORIGIN}${path}`,
  }
}

function parseDeveloperBlock(block: string, rank: number): TrendingDeveloper | null {
  const avatar = block.match(
    /<img[^>]*class="[^"]*avatar-user[^"]*"[^>]*src="([^"]+)"[^>]*alt="@([^"]+)"[^>]*>/
  )
  const username = optionalText(
    block.match(/class="[^"]*Link--secondary[^"]*"[^>]*>([\s\S]*?)<\/a>/)?.[1]
  )
  const name = optionalText(
    block.match(/<h1[^>]*class="[^"]*h3[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1]
  )
  const login = username ?? optionalText(avatar?.[2])

  if (!login) return null

  const popularRepo = block.match(
    /data-ga-click="Explore, go to repository[^"]*"[^>]*href="(\/[^/"?#]+\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>/
  )
  const repoPath = popularRepo ? decodeHtml(popularRepo[1]) : undefined
  const repoName = optionalText(popularRepo?.[2])
  const repoDescription = optionalText(
    block.match(/<div[^>]*class="[^"]*color-fg-muted[^"]*mt-1[^"]*"[^>]*>([\s\S]*?)<\/div>/)
      ?.[1]
  )

  return {
    rank,
    avatarUrl: avatar ? decodeHtml(avatar[1]) : undefined,
    name,
    username: login,
    popularRepo: repoName,
    popularRepoUrl: repoPath ? `${GITHUB_ORIGIN}${repoPath}` : undefined,
    repoDescription,
    profileUrl: `${GITHUB_ORIGIN}/${login}`,
  }
}

function parseBuiltByUsers(block: string): TrendingBuiltByUser[] {
  const builtBySection = block.match(/Built by([\s\S]*?)(?:stars this|<\/article>)/)?.[1]
  if (!builtBySection) return []

  const users = new Map<string, TrendingBuiltByUser>()
  const pattern =
    /<a[^>]*href="\/([^/"?#]+)"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*alt="@([^"]+)"[^>]*>/g

  for (const match of builtBySection.matchAll(pattern)) {
    const username = cleanText(match[3])
    if (!username || users.has(username)) continue

    users.set(username, {
      username,
      avatarUrl: decodeHtml(match[2]),
      profileUrl: `${GITHUB_ORIGIN}/${decodeHtml(match[1])}`,
    })
  }

  return Array.from(users.values())
}

function getBoxRows(html: string) {
  const matches = Array.from(html.matchAll(/<article\b[^>]*class="[^"]*\bBox-row\b[^"]*"[^>]*>/g))
  return matches.map((match, index) => {
    const start = match.index ?? 0
    const nextStart = matches[index + 1]?.index
    return html.slice(start, nextStart)
  })
}

function normalizeLanguageSlug(value: string) {
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'all') return ''

  return trimmed
    .replace(/^\/+|\/+$/g, '')
    .split('/')[0]
    .trim()
    .toLowerCase()
    .replace(/#/g, '%23')
    .replace(/\s+/g, '-')
    .replace(/[?&]/g, '')
}

function optionalText(value: string | undefined) {
  const text = cleanText(value)
  return text || undefined
}

function cleanText(value: string | undefined) {
  if (!value) return ''

  return stripTags(decodeHtml(value)).replace(/\s+/g, ' ').trim()
}

function stripTags(value: string) {
  return value.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '')
}

function parseNumber(value: string | undefined) {
  if (!value) return undefined

  const number = Number(value.replace(/[^\d]/g, ''))
  return Number.isFinite(number) ? number : undefined
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
