import type { RenderableEvent } from './range'

export const PANEL_CALENDAR_ENDPOINT = 'http://127.0.0.1:4173/api/sync-calendar'

export type PanelCalendarEvent = Pick<
  RenderableEvent,
  'id' | 'title' | 'start' | 'end' | 'tone' | 'kind' | 'note' | 'allDay' | 'calendarName'
> & { source: string }

export function eventsForPanel(events: RenderableEvent[]): PanelCalendarEvent[] {
  return events
    .filter((event) => {
      const start = new Date(event.start)
      const end = new Date(event.end)
      return Boolean(event.id && event.title.trim()) && Number.isFinite(+start) && Number.isFinite(+end) && +end > +start
    })
    .map((event) => ({
      id: event.id,
      title: event.title.trim(),
      start: event.start,
      end: event.end,
      tone: event.tone,
      kind: event.kind,
      note: event.note,
      allDay: event.allDay,
      calendarName: event.calendarName,
      source: event.provider ?? 'sync',
    }))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
}

export async function publishCalendarToPanel(events: RenderableEvent[], fetcher: typeof fetch = fetch) {
  const response = await fetcher(PANEL_CALENDAR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ events: eventsForPanel(events) }),
  })
  if (!response.ok) throw new Error(`Panel calendar sync failed (${response.status})`)
}
