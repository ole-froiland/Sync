import type { CalendarProvider } from './providers/types'

export type CalendarSource = 'sync' | CalendarProvider

export type CalendarEntry = {
  id: string
  name: string
  source: CalendarSource
  color: string
}

type FilterableEvent = {
  provider?: CalendarProvider
  calendarId?: string
  calendarName?: string
}

const SOURCE_ORDER: Record<CalendarSource, number> = {
  sync: 0,
  google: 1,
  apple: 2,
  microsoft: 3,
}

const SOURCE_FALLBACK_NAME: Record<CalendarSource, string> = {
  sync: 'Sync blocks',
  google: 'Google',
  apple: 'Apple',
  microsoft: 'Outlook',
}

// Distinct, readable dot colours. Picked by a stable hash of the calendar id.
const PALETTE = ['#a78bfa', '#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#22d3ee', '#fb7185', '#a3e635']

function hashColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export function eventSource(event: FilterableEvent): CalendarSource {
  return event.provider ?? 'sync'
}

export function eventCalendarId(event: FilterableEvent): string {
  return event.provider ? event.calendarId ?? `${event.provider}:primary` : 'sync'
}

export function buildCalendarList(events: FilterableEvent[]): CalendarEntry[] {
  const byId = new Map<string, CalendarEntry>()
  for (const event of events) {
    const id = eventCalendarId(event)
    if (byId.has(id)) continue
    const source = eventSource(event)
    const name = event.provider
      ? event.calendarName ?? SOURCE_FALLBACK_NAME[source]
      : SOURCE_FALLBACK_NAME.sync
    byId.set(id, { id, name, source, color: hashColor(id) })
  }
  return [...byId.values()].sort((a, b) =>
    SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] || a.name.localeCompare(b.name),
  )
}

export function filterByCalendars<T extends FilterableEvent>(
  events: T[],
  hiddenIds: Set<string>,
): T[] {
  if (hiddenIds.size === 0) return events
  return events.filter((event) => !hiddenIds.has(eventCalendarId(event)))
}
