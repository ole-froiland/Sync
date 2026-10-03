import type { SyncAssistantCalendarEvent, SyncAssistantMessage, SyncAssistantPlan } from './types'

type CalendarAutomationContext = {
  events?: SyncAssistantCalendarEvent[]
  now?: Date
}

const MONTHS: Record<string, number> = {
  jan: 0, januar: 0, january: 0, feb: 1, februar: 1, february: 1, mar: 2, mars: 2, march: 2,
  apr: 3, april: 3, mai: 4, may: 4, jun: 5, juni: 5, june: 5, jul: 6, juli: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8, okt: 9, oktober: 9, october: 9,
  nov: 10, november: 10, des: 11, desember: 11, december: 11,
}

const WEEKDAYS: Record<string, number> = {
  søndag: 0, sondag: 0, sunday: 0,
  mandag: 1, monday: 1,
  tirsdag: 2, tuesday: 2,
  onsdag: 3, wednesday: 3,
  torsdag: 4, thursday: 4,
  fredag: 5, friday: 5,
  lørdag: 6, lordag: 6, saturday: 6,
}

export function planCalendarAutomation(
  messages: SyncAssistantMessage[],
  context: CalendarAutomationContext = {}
): SyncAssistantPlan | null {
  const request = contextualAutomationRequest(messages)
  if (!request) return null
  const normalized = normalize(request)
  const now = context.now ?? new Date()
  const events = (context.events ?? []).filter(validContextEvent)

  if (isDeleteRequest(normalized)) return planDelete(request, events, now)
  if (isUpdateRequest(normalized)) return planMove(request, events, now)
  if (isRecurringRequest(normalized)) return planWeeklySeries(request, now)
  if (isTripRequest(normalized)) return planTrip(request, events, now)
  return null
}

function planTrip(request: string, events: SyncAssistantCalendarEvent[], now: Date): SyncAssistantPlan {
  const range = parseMonthRange(request, now)
  if (!range) {
    return { reply: 'Hvilke datoer gjelder reisen? Skriv for eksempel «Seoul 10.–19. januar».', actions: [] }
  }
  const destination = tripDestination(request) || 'Reise'
  const title = destination === 'Reise'
    ? destination
    : isVacationRequest(normalize(request)) ? `Ferie i ${destination}` : `Reise til ${destination}`
  const event: SyncAssistantCalendarEvent = {
    id: `trip-${slug(destination)}-${dateKey(range.start)}`,
    title,
    start: localDateTime(range.start),
    end: localDateTime(range.endExclusive),
    eventKind: 'meeting',
    allDay: true,
  }
  const existing = events.find((candidate) =>
    compactKey(candidate.title) === compactKey(event.title)
    && +new Date(candidate.start) === +new Date(event.start)
    && +new Date(candidate.end) === +new Date(event.end)
  )
  if (existing) {
    return {
      reply: `«${existing.title}» ligger allerede i kalenderen fra ${formatDate(range.start)} til ${formatDate(range.endInclusive)}. Jeg oppretter ikke et duplikat.`,
      actions: [],
    }
  }
  return {
    reply: `Jeg har gjort klar ${title} fra ${formatDate(range.start)} til ${formatDate(range.endInclusive)} som én heldagshendelse. Bekreft før den legges inn.`,
    actions: [{ kind: 'create_calendar_events', events: [event], sourceLabel: 'Sync AI' }],
  }
}

function planWeeklySeries(request: string, now: Date): SyncAssistantPlan {
  const weekday = requestedWeekday(request)
  const time = requestedTimeRange(request)
  if (weekday === null) return { reply: 'Hvilken ukedag skal dette gjentas?', actions: [] }
  if (!time) return { reply: 'Hvilket klokkeslett skal den gjentakende hendelsen ha?', actions: [] }

  const title = recurringTitle(request) || 'Gjentakende aktivitet'
  const occurrences = requestedOccurrenceCount(request) ?? 12
  const first = nextWeekday(now, weekday, time.startHour, time.startMinute)
  const planned: SyncAssistantCalendarEvent[] = []
  for (let index = 0; index < occurrences; index += 1) {
    const start = new Date(first)
    start.setDate(first.getDate() + index * 7)
    const end = new Date(start)
    end.setHours(time.endHour, time.endMinute, 0, 0)
    if (+end <= +start) end.setDate(end.getDate() + 1)
    planned.push({
      id: `repeat-${slug(title)}-${dateKey(start)}-${pad(start.getHours())}${pad(start.getMinutes())}`,
      title,
      start: localDateTime(start),
      end: localDateTime(end),
      eventKind: /trening|trene|workout|focus|fokus/i.test(request) ? 'focus' : 'meeting',
    })
  }
  return {
    reply: `Jeg har gjort klar ${occurrences} ${title.toLowerCase()}-økter, hver ${weekdayName(weekday)} ${formatClock(time.startHour, time.startMinute)}–${formatClock(time.endHour, time.endMinute)}, fra ${formatDate(first)}. Bekreft én gang for å legge inn hele serien.`,
    actions: [{ kind: 'create_calendar_events', events: planned, sourceLabel: 'Ukentlig serie' }],
  }
}

function planDelete(request: string, events: SyncAssistantCalendarEvent[], now: Date): SyncAssistantPlan {
  const matches = matchEvents(request, events, now)
  if (matches.length === 0) {
    return { reply: 'Jeg fant ingen Sync-hendelser som passer. Ingenting blir slettet.', actions: [] }
  }
  return {
    reply: `Jeg fant ${matches.length} ${matches.length === 1 ? 'hendelse' : 'hendelser'} som passer. Kontroller listen og bekreft før de slettes.`,
    actions: [{ kind: 'delete_calendar_events', events: matches }],
  }
}

function planMove(request: string, events: SyncAssistantCalendarEvent[], now: Date): SyncAssistantPlan {
  const matches = matchEvents(request, events, now)
  const newTime = requestedDestinationTime(request)
  if (!newTime) return { reply: 'Hvilket nytt klokkeslett skal hendelsen flyttes til?', actions: [] }
  if (matches.length === 0) return { reply: 'Jeg fant ingen Sync-hendelse som passer. Ingenting blir endret.', actions: [] }
  if (matches.length > 1) return { reply: `Jeg fant ${matches.length} mulige hendelser. Oppgi datoen også, så endrer jeg riktig hendelse.`, actions: [] }

  const original = matches[0]
  const oldStart = new Date(original.start)
  const oldEnd = new Date(original.end)
  const duration = Math.max(30 * 60_000, +oldEnd - +oldStart)
  const start = new Date(oldStart)
  start.setHours(newTime.hour, newTime.minute, 0, 0)
  const end = new Date(+start + duration)
  const updated = { ...original, start: localDateTime(start), end: localDateTime(end), allDay: false }
  return {
    reply: `Jeg kan flytte «${original.title}» ${formatDate(start)} til ${formatClock(start.getHours(), start.getMinutes())}. Bekreft før kalenderen endres.`,
    actions: [{ kind: 'update_calendar_events', events: [updated] }],
  }
}

function matchEvents(request: string, events: SyncAssistantCalendarEvent[], now: Date) {
  const normalizedRequest = normalize(request)
  const requestedDay = relativeOrWeekdayDate(request, now)
  const month = requestedMonth(request)
  const year = requestedYear(request)
  const scored = events.map((event) => {
    const start = new Date(event.start)
    const titleTokens = meaningfulTokens(event.title)
    const titleScore = titleTokens.filter((token) => normalizedRequest.includes(tokenStem(token))).length
    const exactTitle = normalizedRequest.includes(normalize(event.title))
    const dateMatches = !requestedDay || dateKey(start) === dateKey(requestedDay)
    const monthMatches = month === null || (start.getMonth() === month && (!year || start.getFullYear() === year))
    return { event, score: exactTitle ? titleScore + 10 : titleScore, dateMatches, monthMatches }
  })
  const withTitle = scored.filter((item) => item.score > 0 && item.dateMatches && item.monthMatches)
  const best = Math.max(0, ...withTitle.map((item) => item.score))
  const allRequested = /\b(?:alle|all|hver|every|samtlige)\b/i.test(request)
  return withTitle
    .filter((item) => allRequested || month !== null || item.score === best)
    .map((item) => item.event)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .slice(0, 100)
}

function isTripRequest(value: string) {
  return /\b(?:ferie(?:n|r)?|reise(?:n|r)?|tur(?:en|er)?|vacation|holiday|trip)\b/.test(value)
    || /\b(?:jeg|vi)\s+(?:skal|drar|reiser|flyr)\s+til\b/.test(value)
}

function isVacationRequest(value: string) {
  return /\b(?:ferie(?:n|r)?|vacation|holiday)\b/.test(value)
}

function isRecurringRequest(value: string) {
  return (
    /\b(?:hver|every)\b/.test(value)
    && (requestedWeekday(value) !== null || /\b(?:uke|ukentlig|week|weekly)\b/.test(value))
  )
}

function isDeleteRequest(value: string) {
  return /\b(?:slett|slette|fjern|fjerne|delete|remove)\b/.test(value) && /\b(?:kalender|hendels|aktivitet|trening|møt|event)/.test(value)
}

function isUpdateRequest(value: string) {
  return /\b(?:flytt|flytte|endre|endrer|move|change|reschedule)\b/.test(value) && /\b(?:kl|klokka|at|til|to)\b/.test(value)
}

function parseMonthRange(text: string, now: Date) {
  const normalized = normalize(text)
  const fullDates = normalized.match(
    /\b(\d{1,2})\s+([a-zæøå]+)(?:\s+(20\d{2}))?\s+(?:-|til|to|og|and)\s+(\d{1,2})\s+([a-zæøå]+)(?:\s+(20\d{2}))?\b/
  )
  if (fullDates) {
    const startMonth = MONTHS[fullDates[2]]
    const endMonth = MONTHS[fullDates[5]]
    if (startMonth === undefined || endMonth === undefined) return null

    const explicitStartYear = fullDates[3] ? Number(fullDates[3]) : null
    const explicitEndYear = fullDates[6] ? Number(fullDates[6]) : null
    const startYear = explicitStartYear ?? explicitEndYear ?? now.getFullYear()
    let endYear = explicitEndYear ?? explicitStartYear ?? startYear
    let start = validDate(startYear, startMonth, Number(fullDates[1]))
    let endInclusive = validDate(endYear, endMonth, Number(fullDates[4]))
    if (!start || !endInclusive) return null

    if (!explicitStartYear && !explicitEndYear && +endInclusive < +start && endMonth !== startMonth) {
      endYear += 1
      endInclusive = validDate(endYear, endMonth, Number(fullDates[4]))
    }
    if (!start || !endInclusive || +endInclusive < +start) return null

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (!explicitStartYear && !explicitEndYear && +endInclusive < +today) {
      start = validDate(startYear + 1, startMonth, Number(fullDates[1]))
      endInclusive = validDate(endYear + 1, endMonth, Number(fullDates[4]))
    }
    if (!start || !endInclusive) return null
    const endExclusive = new Date(endInclusive)
    endExclusive.setDate(endExclusive.getDate() + 1)
    return { start, endInclusive, endExclusive }
  }

  const match = normalized.match(/\b(\d{1,2})\s*(?:-|til|to)\s*(\d{1,2})\s+([a-zæøå]+)(?:\s+(\d{4}))?\b/)
  if (!match) return null
  const month = MONTHS[match[3]]
  if (month === undefined) return null
  let year = match[4] ? Number(match[4]) : now.getFullYear()
  let start = validDate(year, month, Number(match[1]))
  let endInclusive = validDate(year, month, Number(match[2]))
  if (!start || !endInclusive || +endInclusive < +start) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!match[4] && +endInclusive < +today) {
    year += 1
    start = validDate(year, month, Number(match[1]))
    endInclusive = validDate(year, month, Number(match[2]))
  }
  if (!start || !endInclusive) return null
  const endExclusive = new Date(endInclusive)
  endExclusive.setDate(endExclusive.getDate() + 1)
  return { start, endInclusive, endExclusive }
}

function tripDestination(text: string) {
  const match = text.match(/\b(?:ferie(?:n|r)?|reise(?:n|r)?|tur(?:en|er)?|vacation|holiday|trip)(?:\s+(?:min|mi|mitt|vår|vart|our|my))?\s+(?:til|i|to|in)\s+(.+?)(?=\s+(?:mellom|fra|from|between|\d{1,2}))/i)
    ?? text.match(/\b(?:jeg|vi)\s+(?:skal|drar|reiser|flyr)\s+til\s+(.+?)(?=\s+(?:mellom|fra|from|between|\d{1,2}))/i)
  return match?.[1]?.trim().replace(/[,.]+$/, '') ?? ''
}

function requestedWeekday(text: string) {
  const entry = matchedWeekday(text)
  return entry ? entry[1] : null
}

function matchedWeekday(text: string) {
  const tokens = normalize(text).split(' ')
  const entries = Object.entries(WEEKDAYS)
  for (const token of tokens) {
    const exact = entries.find(([name]) => token === name)
    if (exact) return exact
  }
  for (const token of tokens) {
    if (token.length < 5) continue
    const fuzzy = entries.find(([name]) => name.length >= 5 && isSingleTypo(token, name))
    if (fuzzy) return fuzzy
  }
  return null
}

function isSingleTypo(left: string, right: string) {
  if (left === right) return true
  if (Math.abs(left.length - right.length) > 1) return false
  if (left.length === right.length) {
    const differences: number[] = []
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) differences.push(index)
    }
    if (differences.length === 1) return true
    return differences.length === 2
      && differences[1] === differences[0] + 1
      && left[differences[0]] === right[differences[1]]
      && left[differences[1]] === right[differences[0]]
  }
  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left]
  let shortIndex = 0
  let longIndex = 0
  let skipped = false
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1
      longIndex += 1
    } else if (skipped) {
      return false
    } else {
      skipped = true
      longIndex += 1
    }
  }
  return true
}

function requestedTimeRange(text: string) {
  const normalized = normalize(text)
  const match = normalized.match(/(?:mellom\s+|fra\s+|kl(?:okka)?\s*)?(\d{1,2})(?:[:.]([0-5]\d))?\s*(?:-|til|to)\s*(\d{1,2})(?:[:.]([0-5]\d))?/)
  if (!match) return null
  const startHour = Number(match[1])
  const endHour = Number(match[3])
  if (startHour > 23 || endHour > 23) return null
  return { startHour, startMinute: Number(match[2] ?? 0), endHour, endMinute: Number(match[4] ?? 0) }
}

function requestedDestinationTime(text: string) {
  const normalized = normalize(text)
  const matches = [...normalized.matchAll(/(?:til|to)\s+(?:kl(?:okka)?\s*)?(\d{1,2})(?:[:.]([0-5]\d))?/g)]
  const match = matches.at(-1)
  if (!match || Number(match[1]) > 23) return null
  return { hour: Number(match[1]), minute: Number(match[2] ?? 0) }
}

function recurringTitle(text: string) {
  return text
    .replace(/\b(?:hver|every)\s+[a-zæøå]+\b/i, '')
    .replace(/\b(?:skal jeg|jeg skal|i will|we will)\b/gi, '')
    .replace(/\b(?:mellom|fra)\s+\d{1,2}(?::[0-5]\d)?\s*(?:-|til|to)\s*\d{1,2}(?::[0-5]\d)?\b/gi, '')
    .replace(/\b\d{1,2}(?::[0-5]\d)?\s*(?:[–—-]|til|to)\s*\d{1,2}(?::[0-5]\d)?\b/gi, '')
    .replace(/\b(?:i|på)\s+(?:min\s+)?kalender(?:en)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[:;,–—-]+\s*/, '')
    .replace(/^(?:legge? inn|lag|opprett|add|create)\s+/i, '')
    .replace(/[.:;,–—-]+$/g, '')
    .trim()
    .replace(/^tr(?:ene|ening)$/i, 'Trening')
}

function requestedOccurrenceCount(text: string) {
  const match = normalize(text).match(/\b(?:de neste|neste|next)\s+(\d{1,2})\s+(?:gangene|ukene|times|weeks)\b/)
  if (!match) return null
  return Math.min(52, Math.max(1, Number(match[1])))
}

function requestedMonth(text: string) {
  const normalized = normalize(text)
  const month = Object.entries(MONTHS).find(([name]) => normalized.includes(name))
  return month ? month[1] : null
}

function requestedYear(text: string) {
  const match = text.match(/\b(20\d{2})\b/)
  return match ? Number(match[1]) : null
}

function relativeOrWeekdayDate(text: string, now: Date) {
  const normalized = normalize(text)
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (normalized.includes('i morgen') || normalized.includes('tomorrow')) {
    date.setDate(date.getDate() + 1)
    return date
  }
  const weekday = requestedWeekday(text)
  if (weekday === null) return null
  const offset = (weekday - date.getDay() + 7) % 7 || 7
  date.setDate(date.getDate() + offset)
  return date
}

function nextWeekday(now: Date, weekday: number, hour: number, minute: number) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0)
  let offset = (weekday - start.getDay() + 7) % 7
  if (offset === 0 && +start <= +now) offset = 7
  start.setDate(start.getDate() + offset)
  return start
}

function meaningfulTokens(value: string) {
  return normalize(value).split(' ').map(tokenStem).filter((token) => token.length >= 4)
}

function tokenStem(value: string) {
  return value.replace(/(?:ene|ende|ingene|inger|en|er|et|a)$/i, '')
}

function validContextEvent(event: SyncAssistantCalendarEvent) {
  return Boolean(event.id && event.title && !Number.isNaN(+new Date(event.start)) && !Number.isNaN(+new Date(event.end)))
}

function validDate(year: number, month: number, day: number) {
  const date = new Date(year, month, day)
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null
}

function normalize(value: string) {
  return value
    .replace(/[–—]/g, '-')
    .replace(/(\d)\.(?=\s*-\s*\d)/g, '$1')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9æøå:-]+/g, ' ')
    .trim()
}

function contextualAutomationRequest(messages: SyncAssistantMessage[]) {
  const latestIndex = messages.findLastIndex((message) => message.role === 'user')
  if (latestIndex === -1) return ''
  const latest = messages[latestIndex].content.trim()
  if (hasAutomationIntent(normalize(latest))) return latest

  const priorAssistant = [...messages.slice(0, latestIndex)].reverse().find((message) => message.role === 'assistant')
  if (!priorAssistant || !/\b(?:dato(?:er)?|date|ukedag|weekday|klokkeslett|tidspunkt|time)\b/i.test(priorAssistant.content)) return latest
  const priorUser = [...messages.slice(0, latestIndex)].reverse().find((message) => message.role === 'user')
  if (!priorUser || !hasAutomationIntent(normalize(priorUser.content))) return latest
  return `${priorUser.content} ${latest}`
}

function hasAutomationIntent(value: string) {
  return isDeleteRequest(value) || isUpdateRequest(value) || isRecurringRequest(value) || isTripRequest(value)
}

function compactKey(value: string) {
  return normalize(value).replace(/[^a-z0-9æøå]/g, '')
}

function slug(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'event'
}

function pad(value: number) { return String(value).padStart(2, '0') }
function dateKey(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
function localDateTime(date: Date) { return `${dateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00` }
function formatClock(hour: number, minute: number) { return `${pad(hour)}:${pad(minute)}` }
function formatDate(date: Date) { return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }).format(date) }
function weekdayName(day: number) { return ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'][day] }
