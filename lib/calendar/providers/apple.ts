import { createDAVClient, type DAVCalendar, type DAVCalendarObject } from 'tsdav'
import { createHash } from 'crypto'
import nodeIcal from 'node-ical'
import type { CalendarConnectionRow, ExternalEvent } from './types'

type RRule = {
  between: (after: Date, before: Date, inc?: boolean) => Date[]
}

type VEvent = {
  type: string
  uid?: string
  summary?: string
  location?: string
  start?: Date
  end?: Date
  datetype?: string
  rrule?: RRule
  exdate?: Record<string, Date>
  recurrences?: Record<string, VEvent>
}

export type AppleWritableEvent = {
  id?: string
  title: string
  start: string
  end: string
  allDay?: boolean
  noteId?: string
  description?: string
}

export type AppleMutation =
  | { operation: 'create'; events: AppleWritableEvent[] }
  | { operation: 'update'; events: AppleWritableEvent[] }
  | { operation: 'delete'; events: Array<Pick<AppleWritableEvent, 'id'>> }

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// node-ical keys exdate/recurrences by several string forms (full ISO, the
// date portion, and the local date); check all so excluded and overridden
// occurrences match regardless of how the source calendar wrote them.
function occurrenceKeys(occ: Date): string[] {
  const iso = occ.toISOString()
  return [iso, iso.slice(0, 10), toLocalDateKey(occ)]
}

function isExcluded(exdate: Record<string, Date> | undefined, occ: Date): boolean {
  if (!exdate) return false
  return occurrenceKeys(occ).some((key) => key in exdate)
}

function findOverride(
  recurrences: Record<string, VEvent> | undefined,
  occ: Date,
): VEvent | undefined {
  if (!recurrences) return undefined
  for (const key of occurrenceKeys(occ)) {
    if (recurrences[key]) return recurrences[key]
  }
  return undefined
}

function buildEvent(
  source: VEvent,
  start: Date,
  end: Date,
  id: string,
  calendarId: string,
  calendarName: string,
): ExternalEvent {
  const allDay = source.datetype === 'date'
  return {
    id,
    title: source.summary ?? '(No title)',
    start: allDay ? toLocalDateKey(start) : new Date(start).toISOString(),
    end: allDay ? toLocalDateKey(end) : new Date(end).toISOString(),
    allDay,
    provider: 'apple',
    calendarId,
    calendarName,
    location: source.location || undefined,
  }
}

export function parseAppleIcs(
  ics: string,
  calendarId: string,
  calendarName: string,
  rangeStart?: Date,
  rangeEnd?: Date,
): ExternalEvent[] {
  const parsed = nodeIcal.sync.parseICS(ics) as Record<string, VEvent>
  const events: ExternalEvent[] = []
  for (const key of Object.keys(parsed)) {
    const component = parsed[key]
    if (component.type !== 'VEVENT' || !component.start) continue
    const baseId = component.uid ?? key
    const start = component.start
    const end = component.end ?? component.start

    if (component.rrule && rangeStart && rangeEnd) {
      const durationMs = end.getTime() - start.getTime()
      for (const occ of component.rrule.between(rangeStart, rangeEnd, true)) {
        if (isExcluded(component.exdate, occ)) continue
        const override = findOverride(component.recurrences, occ)
        const id = `apple:${baseId}:${occ.toISOString()}`
        if (override?.start) {
          events.push(buildEvent(override, override.start, override.end ?? override.start, id, calendarId, calendarName))
        } else {
          events.push(buildEvent(component, occ, new Date(occ.getTime() + durationMs), id, calendarId, calendarName))
        }
      }
      continue
    }

    events.push(buildEvent(component, start, end, `apple:${baseId}`, calendarId, calendarName))
  }
  return events
}

export async function fetchEvents(
  connection: CalendarConnectionRow,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<ExternalEvent[]> {
  if (!connection.caldav_username || !connection.caldav_app_password) {
    throw new Error('Apple CalDAV credentials are missing')
  }

  const client = await createDAVClient({
    serverUrl: connection.caldav_server_url ?? 'https://caldav.icloud.com',
    credentials: {
      username: connection.caldav_username,
      password: connection.caldav_app_password,
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })

  const calendars = await client.fetchCalendars()
  const events: ExternalEvent[] = []

  for (const calendar of calendars) {
    const calendarId = String(calendar.url)
    const calendarName =
      typeof calendar.displayName === 'string' && calendar.displayName
        ? calendar.displayName
        : 'Calendar'
    const objects = await client.fetchCalendarObjects({
      calendar,
      timeRange: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
    })
    for (const object of objects) {
      if (object.data) {
        events.push(...parseAppleIcs(object.data, calendarId, calendarName, rangeStart, rangeEnd))
      }
    }
  }

  return events
}

export async function mutateEvents(connection: CalendarConnectionRow, mutation: AppleMutation) {
  const client = await appleClient(connection)
  const calendars = await client.fetchCalendars()
  const target = selectWritableCalendar(calendars)
  if (!target) throw new Error('No writable Apple calendar was found')

  if (mutation.operation === 'create') {
    const results: Array<{ id: string; status: 'created' | 'existing' }> = []
    for (const event of mutation.events) {
      const uid = syncUid(event)
      const response = await client.createCalendarObject({
        calendar: target,
        filename: `${safeFilename(uid)}.ics`,
        iCalString: buildAppleIcs(event, uid),
      })
      if (!response.ok && response.status !== 409 && response.status !== 412) {
        throw new Error(`Apple Calendar create failed (${response.status})`)
      }
      results.push({ id: `apple:${uid}`, status: response.ok ? 'created' : 'existing' })
    }
    return results
  }

  const objects = await fetchAllCalendarObjects(client, calendars)
  const results: Array<{ id: string; status: 'updated' | 'deleted' | 'missing' }> = []
  for (const event of mutation.events) {
    if (isRecurringAppleOccurrence(event.id)) {
      throw new Error('Recurring Apple Calendar events must be edited in Apple Calendar')
    }
    const uid = appleUidFromId(event.id)
    const object = uid ? objects.find((candidate) => calendarObjectUid(candidate) === uid) : undefined
    if (!uid || !object) {
      results.push({ id: event.id ?? '', status: 'missing' })
      continue
    }
    if (mutation.operation === 'delete') {
      const response = await client.deleteCalendarObject({ calendarObject: object })
      if (!response.ok && response.status !== 404) throw new Error(`Apple Calendar delete failed (${response.status})`)
      results.push({ id: event.id ?? '', status: response.status === 404 ? 'missing' : 'deleted' })
      continue
    }
    const writableEvent = event as AppleWritableEvent
    const response = await client.updateCalendarObject({
      calendarObject: { ...object, data: buildAppleIcs(writableEvent, uid) },
    })
    if (!response.ok) throw new Error(`Apple Calendar update failed (${response.status})`)
    results.push({ id: event.id ?? '', status: 'updated' })
  }
  return results
}

async function appleClient(connection: CalendarConnectionRow) {
  if (!connection.caldav_username || !connection.caldav_app_password) {
    throw new Error('Apple CalDAV credentials are missing')
  }
  return createDAVClient({
    serverUrl: connection.caldav_server_url ?? 'https://caldav.icloud.com',
    credentials: {
      username: connection.caldav_username,
      password: connection.caldav_app_password,
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })
}

export function selectWritableCalendar(calendars: DAVCalendar[]) {
  const candidates = calendars.filter((calendar) => !calendar.components || calendar.components.includes('VEVENT'))
  const preferred = ['calendar', 'kalender', 'personal', 'personlig', 'home', 'hjem', 'privat']
  return candidates.find((calendar) => {
    const name = typeof calendar.displayName === 'string' ? calendar.displayName.toLowerCase() : ''
    return preferred.includes(name)
  }) ?? candidates[0] ?? null
}

export function buildAppleIcs(event: AppleWritableEvent, uid = syncUid(event)) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sync//Apple Calendar Bridge//NO',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${utcIcsDate(new Date())}`,
    `SUMMARY:${escapeIcsText(event.title.trim())}`,
  ]
  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateOnlyIcs(event.start)}`)
    lines.push(`DTEND;VALUE=DATE:${dateOnlyIcs(event.end)}`)
  } else {
    lines.push(icsDateTime('DTSTART', event.start))
    lines.push(icsDateTime('DTEND', event.end))
  }
  const description = [event.description?.trim(), event.noteId ? `Sync-notat: ${event.noteId}` : '']
    .filter(Boolean)
    .join('\n')
  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`)
  if (event.noteId) lines.push(`X-SYNC-NOTE-ID:${escapeIcsText(event.noteId)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR', '')
  return lines.join('\r\n')
}

export function appleUidFromId(id?: string) {
  if (!id?.startsWith('apple:')) return null
  return id.slice('apple:'.length).replace(/:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, '') || null
}

function isRecurringAppleOccurrence(id?: string) {
  return Boolean(id?.match(/:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/))
}

function syncUid(event: AppleWritableEvent) {
  const stable = event.id || `${event.title}|${event.start}|${event.end}`
  return `sync-${createHash('sha256').update(stable).digest('hex').slice(0, 32)}@sync-co-op.netlify.app`
}

function calendarObjectUid(object: DAVCalendarObject) {
  if (typeof object.data !== 'string') return null
  const unfolded = object.data.replace(/\r?\n[ \t]/g, '')
  return unfolded.match(/(?:^|\r?\n)UID(?:;[^:]*)?:([^\r\n]+)/i)?.[1]?.trim() ?? null
}

async function fetchAllCalendarObjects(
  client: Awaited<ReturnType<typeof createDAVClient>>,
  calendars: DAVCalendar[],
) {
  const groups = await Promise.all(calendars.map((calendar) => client.fetchCalendarObjects({ calendar })))
  return groups.flat()
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9@._-]+/gi, '-').slice(0, 160)
}

function escapeIcsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function dateOnlyIcs(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) throw new Error('Invalid all-day Apple Calendar date')
  return `${match[1]}${match[2]}${match[3]}`
}

function icsDateTime(label: string, value: string) {
  const local = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (local) return `${label};TZID=Europe/Oslo:${local[1]}${local[2]}${local[3]}T${local[4]}${local[5]}${local[6] ?? '00'}`
  const date = new Date(value)
  if (Number.isNaN(+date)) throw new Error('Invalid Apple Calendar date')
  return `${label}:${utcIcsDate(date)}`
}

function utcIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}
