import { createDAVClient } from 'tsdav'
import nodeIcal from 'node-ical'
import type { CalendarConnectionRow, ExternalEvent } from './types'

type VEvent = {
  type: string
  uid?: string
  summary?: string
  location?: string
  start?: Date
  end?: Date
  datetype?: string
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseAppleIcs(ics: string): ExternalEvent[] {
  const parsed = nodeIcal.sync.parseICS(ics) as Record<string, VEvent>
  const events: ExternalEvent[] = []
  for (const key of Object.keys(parsed)) {
    const component = parsed[key]
    if (component.type !== 'VEVENT' || !component.start) continue
    const start = component.start
    const end = component.end ?? component.start
    const allDay = component.datetype === 'date'
    events.push({
      id: `apple:${component.uid ?? key}`,
      title: component.summary ?? '(No title)',
      start: allDay ? toLocalDateKey(start) : new Date(start).toISOString(),
      end: allDay ? toLocalDateKey(end) : new Date(end).toISOString(),
      allDay,
      provider: 'apple',
      location: component.location || undefined,
    })
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
    const objects = await client.fetchCalendarObjects({
      calendar,
      timeRange: {
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
      },
    })
    for (const object of objects) {
      if (object.data) {
        events.push(...parseAppleIcs(object.data))
      }
    }
  }

  return events
}
