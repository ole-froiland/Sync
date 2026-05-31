import { createDAVClient } from 'tsdav'
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
