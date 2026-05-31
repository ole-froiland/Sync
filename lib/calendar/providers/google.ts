import { getValidAccessToken } from '@/lib/calendar/token'
import type { CalendarConnectionRow, ExternalEvent } from './types'

type GoogleDate = { dateTime?: string; date?: string }
type GoogleEvent = {
  id: string
  summary?: string
  location?: string
  status?: string
  start?: GoogleDate
  end?: GoogleDate
}

export function mapGoogleEvents(
  items: GoogleEvent[],
  calendarId = 'primary',
  calendarName = 'Primary',
): ExternalEvent[] {
  return items
    .filter((item) => item.status !== 'cancelled')
    .map((item) => {
      const allDay = Boolean(item.start?.date && !item.start?.dateTime)
      return {
        id: `google:${item.id}`,
        title: item.summary ?? '(No title)',
        start: item.start?.dateTime ?? item.start?.date ?? '',
        end: item.end?.dateTime ?? item.end?.date ?? '',
        allDay,
        provider: 'google' as const,
        calendarId,
        calendarName,
        location: item.location || undefined,
      }
    })
    .filter((event) => event.start && event.end)
}

export async function fetchEvents(
  connection: CalendarConnectionRow,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<ExternalEvent[]> {
  const token = await getValidAccessToken(connection)
  const params = new URLSearchParams({
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) {
    throw new Error(`Google Calendar API error: ${res.status}`)
  }
  const data = (await res.json()) as { items?: GoogleEvent[] }
  // Primary calendar only; pass calendarId/calendarName when multi-calendar support lands.
  return mapGoogleEvents(data.items ?? [])
}
