import type { SyncAssistantCalendarEvent, SyncAssistantMessage, SyncAssistantPlan } from './types'

type NorwegianFixtureOptions = {
  fetcher?: typeof fetch
  now?: Date
}

type NffTeamSource = {
  name: string
  aliases: string[]
  fiksId: string
}

const NFF_TEAMS: NffTeamSource[] = [
  { name: 'KFUM', aliases: ['kfum', 'kfum oslo', 'kåffa', 'kaffa'], fiksId: '306' },
]

export async function planNorwegianFootballFixtures(
  messages: SyncAssistantMessage[],
  options: NorwegianFixtureOptions = {}
): Promise<SyncAssistantPlan | null> {
  const request = [...messages].reverse().find((message) => message.role === 'user')?.content.trim() ?? ''
  const team = requestedTeam(request)
  if (!team || !isFixtureImportRequest(request)) return null

  const sourceUrl = `https://www.fotball.no/fotballdata/lag/hjem/?fiksId=${team.fiksId}&underside=kamper`
  try {
    const response = await (options.fetcher ?? fetch)(sourceUrl, {
      headers: { Accept: 'text/html; charset=utf-8' },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`NFF svarte ${response.status}`)
    const events = parseUpcomingNffMatches(await response.text(), sourceUrl)
      .filter((event) => +new Date(event.end) > +(options.now ?? new Date()))

    if (events.length === 0) {
      return {
        reply: `Jeg fant ${team.name} hos Norges Fotballforbund, men ingen kommende kamper akkurat nå. Ingen gjetninger ble lagt i kalenderen.`,
        actions: [],
      }
    }
    return {
      reply: `Jeg fant ${events.length} kommende ${team.name}-kamper hos Norges Fotballforbund. Bekreft én gang, så legger jeg dem inn i Sync-kalenderen.`,
      actions: [{
        kind: 'create_calendar_events',
        events,
        sourceLabel: 'Norges Fotballforbund',
        sourceUrl,
      }],
    }
  } catch {
    return {
      reply: `Jeg forsto at du vil legge inn ${team.name}-kampene, men klarte ikke å hente NFF-terminlisten akkurat nå. Ingenting ble opprettet; prøv igjen om litt.`,
      actions: [],
    }
  }
}

function requestedTeam(value: string) {
  const normalized = normalize(value)
  return NFF_TEAMS.find((team) => team.aliases.some((alias) => normalized.includes(normalize(alias)))) ?? null
}

function isFixtureImportRequest(value: string) {
  const normalized = normalize(value)
  return /\b(?:kamp|kamper|kampene|terminliste|fixtures|matches)\b/.test(normalized)
    && /\b(?:alle|all|hver|samtlige|legg|legge|add|import)\b/.test(normalized)
}

export function parseUpcomingNffMatches(html: string, sourceUrl: string): SyncAssistantCalendarEvent[] {
  const section = html.match(/id=["']NextMatchesContainer["'][\s\S]*?(?=<div id=["']PrevMatchesContainer["'])/)?.[0] ?? ''
  if (!section) return []
  return [...section.matchAll(/<a\s+href=["']\/fotballdata\/kamp\/\?fiksId=(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .flatMap((match) => {
      const card = match[2]
      const date = textOf(card, 'headingElement').match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
      const time = textOf(card, 'time').match(/(\d{1,2}):(\d{2})/)
      const teams = textsOf(card, 'teamName')
      if (!date || !time || teams.length < 2) return []
      const rawYear = Number(date[3])
      const year = rawYear < 100 ? 2000 + rawYear : rawYear
      const start = localDateTime(year, Number(date[2]) - 1, Number(date[1]), Number(time[1]), Number(time[2]))
      if (!start) return []
      const end = new Date(+new Date(start) + 2 * 60 * 60_000)
      return [{
        id: `nff-${match[1]}`,
        title: `${teams[0]} – ${teams[1]}`,
        start,
        end: localDateTime(end.getFullYear(), end.getMonth(), end.getDate(), end.getHours(), end.getMinutes()) ?? '',
        eventKind: 'meeting' as const,
        sourceUrl,
      }]
    })
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
}

function textsOf(html: string, className: string) {
  const pattern = new RegExp(`<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'gi')
  return [...html.matchAll(pattern)].map((match) => decodeHtml(stripTags(match[1])).trim()).filter(Boolean)
}

function textOf(html: string, className: string) {
  return textsOf(html, className)[0] ?? ''
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
}

function localDateTime(year: number, month: number, day: number, hour: number, minute: number) {
  const date = new Date(year, month, day, hour, minute, 0, 0)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`
}

function normalize(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9æøå]+/g, ' ').trim()
}
