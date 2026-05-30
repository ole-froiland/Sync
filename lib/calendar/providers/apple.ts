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

export function parseAppleIcs(ics: string): ExternalEvent[] {
  const parsed = nodeIcal.sync.parseICS(ics) as Record<string, VEvent>
  const events: ExternalEvent[] = []
  for (const key of Object.keys(parsed)) {
    const component = parsed[key]
    if (component.type !== 'VEVENT' || !component.start) continue
    const start = component.start
    const end = component.end ?? component.start
    events.push({
      id: `apple:${component.uid ?? key}`,
      title: component.summary ?? '(No title)',
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      allDay: component.datetype === 'date',
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
