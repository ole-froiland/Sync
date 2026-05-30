import type { ExternalEvent, CalendarProvider } from './providers/types'

export type CalendarView = 'month' | 'week' | 'day'

export type RenderableEvent = {
  id: string
  title: string
  start: string
  end: string
  tone: 'violet' | 'emerald' | 'amber' | 'sky'
  kind: 'focus' | 'meeting' | 'launch' | 'deadline'
  note?: string
  external?: boolean
  provider?: CalendarProvider
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeekMonday(date: Date): Date {
  const start = startOfDay(date)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

// Mirrors the grid the Calendar page renders, with a 1-day buffer each side.
export function visibleRange(view: CalendarView, viewDate: Date): { start: Date; end: Date } {
  if (view === 'day') {
    const start = startOfDay(viewDate)
    return { start: new Date(+start - DAY_MS), end: new Date(+start + 2 * DAY_MS) }
  }
  if (view === 'week') {
    const start = startOfWeekMonday(viewDate)
    return { start: new Date(+start - DAY_MS), end: new Date(+start + 8 * DAY_MS) }
  }
  // month: 6-week grid starting on the Monday on/before the 1st
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const gridStart = startOfWeekMonday(first)
  return { start: new Date(+gridStart - DAY_MS), end: new Date(+gridStart + 43 * DAY_MS) }
}

const PROVIDER_TONE: Record<CalendarProvider, RenderableEvent['tone']> = {
  google: 'sky',
  microsoft: 'violet',
  apple: 'amber',
}

export function externalToCalendarEvent(event: ExternalEvent): RenderableEvent {
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    tone: PROVIDER_TONE[event.provider],
    kind: 'meeting',
    note: event.location,
    external: true,
    provider: event.provider,
  }
}
