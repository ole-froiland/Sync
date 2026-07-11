import type {
  SyncAssistantCalendarEvent,
  SyncAssistantMessage,
  SyncAssistantPlan,
} from './types'

const PREMIER_LEAGUE_API = 'https://sdp-prem-prod.premier-league-prod.pulselive.com/api'
const PREMIER_LEAGUE_COMPETITION_ID = '8'
const PROVIDER_HEADERS = {
  Accept: 'application/json',
}

type FixturePlannerOptions = {
  fetcher?: typeof fetch
  now?: Date
}

type PremierLeagueTeam = {
  id?: string
  name?: string
  shortName?: string
  abbr?: string
}

type PremierLeagueMatch = {
  matchId?: string
  competitionId?: string
  competition?: string
  season?: string
  kickoff?: string
  kickoffTimezoneString?: string
  homeTeam?: PremierLeagueTeam
  awayTeam?: PremierLeagueTeam
}

type ListResponse<T> = {
  data?: T[]
}

export async function planPremierLeagueFixtures(
  messages: SyncAssistantMessage[],
  options: FixturePlannerOptions = {}
): Promise<SyncAssistantPlan | null> {
  const request = [...messages].reverse().find((message) => message.role === 'user')?.content.trim() ?? ''
  if (!isPremierLeagueCalendarRequest(request)) return null

  const season = requestedSeason(request) ?? currentSeasonStart(options.now ?? new Date())
  const fetcher = options.fetcher ?? fetch

  try {
    const teamsUrl = new URL(
      `/api/v1/competitions/${PREMIER_LEAGUE_COMPETITION_ID}/seasons/${season}/teams`,
      PREMIER_LEAGUE_API
    )
    teamsUrl.searchParams.set('_limit', '60')
    const teamsResponse = await fetchProvider<ListResponse<PremierLeagueTeam>>(fetcher, teamsUrl)
    const teams = Array.isArray(teamsResponse.data) ? teamsResponse.data : []
    const team = findRequestedTeam(request, teams)

    if (!team?.id || !team.name) {
      return {
        reply: `Jeg fant Premier League-sesongen ${season}/${String(season + 1).slice(-2)}, men ikke laget i forespørselen. Skriv hele lagnavnet, for eksempel "Manchester United".`,
        actions: [],
      }
    }

    const matchesUrl = new URL('/api/v2/matches', PREMIER_LEAGUE_API)
    matchesUrl.searchParams.set('_limit', '100')
    matchesUrl.searchParams.set('competition', PREMIER_LEAGUE_COMPETITION_ID)
    matchesUrl.searchParams.set('season', String(season))
    matchesUrl.searchParams.set('team', team.id)
    const matchesResponse = await fetchProvider<ListResponse<PremierLeagueMatch>>(fetcher, matchesUrl)
    const matches = Array.isArray(matchesResponse.data) ? matchesResponse.data : []
    const sourceUrl = `https://www.premierleague.com/en/clubs/${encodeURIComponent(team.id)}/fixtures`
    const events = matches
      .filter((match) => match.competitionId === PREMIER_LEAGUE_COMPETITION_ID && match.season === String(season))
      .filter((match) => match.homeTeam?.id === team.id || match.awayTeam?.id === team.id)
      .map((match) => fixtureCalendarEvent(match, sourceUrl))
      .filter((event): event is SyncAssistantCalendarEvent => Boolean(event))
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))

    if (events.length === 0) {
      return {
        reply: `Jeg fant ${team.name}, men ingen publiserte Premier League-kamper for sesongen ${season}/${String(season + 1).slice(-2)} akkurat nå. Jeg legger ikke inn gjetninger i kalenderen.`,
        actions: [],
      }
    }

    return {
      reply: `Jeg fant ${events.length} ${team.name}-kamper i den offisielle Premier League-terminlisten for ${season}/${String(season + 1).slice(-2)}. Bekreft én gang, så legger jeg alle inn i Sync-kalenderen. Kampdatoer kan senere flyttes av ligaen.`,
      actions: [
        {
          kind: 'create_calendar_events',
          events,
          sourceLabel: 'PremierLeague.com',
          sourceUrl,
        },
      ],
    }
  } catch {
    return {
      reply: 'Jeg klarte ikke å hente den offisielle Premier League-terminlisten akkurat nå. Ingen kalenderhendelser ble opprettet; prøv igjen om litt.',
      actions: [],
    }
  }
}

function isPremierLeagueCalendarRequest(value: string) {
  const normalized = normalize(value)
  return (
    /(?:premier league|premierliga)/.test(normalized) &&
    /(?:kalender|calendar)/.test(normalized) &&
    /(?:alle|all|hver|every|samtlige)/.test(normalized) &&
    /(?:kamp|kamper|matches|fixtures|games)/.test(normalized)
  )
}

function requestedSeason(value: string) {
  const match = value.match(/\b(\d{2,4})\s*[\/–—-]\s*(\d{2,4})\b/)
  if (!match) return null
  const start = Number(match[1])
  const year = start < 100 ? 2000 + start : start
  return year >= 2000 && year <= 2100 ? year : null
}

function currentSeasonStart(now: Date) {
  return now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
}

function findRequestedTeam(request: string, teams: PremierLeagueTeam[]) {
  const normalizedRequest = normalize(request)
  return [...teams]
    .sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0))
    .find((team) =>
      [team.name, team.shortName, team.abbr]
        .filter((name): name is string => Boolean(name && name.length >= 3))
        .some((name) => normalizedRequest.includes(normalize(name)))
    )
}

function fixtureCalendarEvent(match: PremierLeagueMatch, sourceUrl: string): SyncAssistantCalendarEvent | null {
  if (!match.matchId || !match.kickoff || !match.homeTeam?.name || !match.awayTeam?.name) return null
  const start = zonedDateTime(match.kickoff, match.kickoffTimezoneString || 'Europe/London')
  if (!start) return null
  const end = new Date(+start + 2 * 60 * 60 * 1000)
  return {
    id: `pl-${match.matchId}`,
    title: `${match.homeTeam.name} – ${match.awayTeam.name}`,
    start: start.toISOString(),
    end: end.toISOString(),
    eventKind: 'meeting',
    sourceUrl,
  }
}

function zonedDateTime(value: string, timeZone: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return null
  const parts = match.slice(1).map(Number)
  const localAsUtc = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5])

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    const formatted = Object.fromEntries(
      formatter.formatToParts(new Date(localAsUtc)).map((part) => [part.type, part.value])
    )
    const representedUtc = Date.UTC(
      Number(formatted.year),
      Number(formatted.month) - 1,
      Number(formatted.day),
      Number(formatted.hour),
      Number(formatted.minute),
      Number(formatted.second)
    )
    return new Date(localAsUtc - (representedUtc - localAsUtc))
  } catch {
    return null
  }
}

async function fetchProvider<T>(fetcher: typeof fetch, url: URL): Promise<T> {
  const response = await fetcher(url, {
    headers: PROVIDER_HEADERS,
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`Premier League returned ${response.status}`)
  return response.json() as Promise<T>
}

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
