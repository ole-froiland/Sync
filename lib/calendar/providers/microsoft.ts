import { getValidAccessToken } from '@/lib/calendar/token'
import type { CalendarConnectionRow, ExternalEvent } from './types'

type MsDateTime = { dateTime: string; timeZone: string }
type MsEvent = {
  id: string
  subject?: string
  isAllDay?: boolean
  location?: { displayName?: string }
  start: MsDateTime
  end: MsDateTime
}

// Graph returns dateTime without an offset; we request UTC via the Prefer
// header in fetchEvents, so append Z to make it a valid ISO instant.
function toIso(dt: MsDateTime): string {
  return dt.dateTime.endsWith('Z') ? dt.dateTime : `${dt.dateTime}Z`
}

export function mapMicrosoftEvents(
  value: MsEvent[],
  calendarId = 'primary',
  calendarName = 'Outlook',
): ExternalEvent[] {
  return value.map((event) => ({
    id: `microsoft:${event.id}`,
    title: event.subject ?? '(No title)',
    start: toIso(event.start),
    end: toIso(event.end),
    allDay: Boolean(event.isAllDay),
    provider: 'microsoft' as const,
    calendarId,
    calendarName,
    location: event.location?.displayName || undefined,
  }))
}

export async function fetchEvents(
  connection: CalendarConnectionRow,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<ExternalEvent[]> {
  const token = await getValidAccessToken(connection)
  const params = new URLSearchParams({
    startDateTime: rangeStart.toISOString(),
    endDateTime: rangeEnd.toISOString(),
    $top: '250',
    $orderby: 'start/dateTime',
  })
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    },
  )
  if (!res.ok) {
    throw new Error(`Microsoft Graph API error: ${res.status}`)
  }
  const data = (await res.json()) as { value?: MsEvent[] }
  // Primary calendar only; pass calendarId/calendarName when multi-calendar support lands.
  return mapMicrosoftEvents(data.value ?? [])
}
