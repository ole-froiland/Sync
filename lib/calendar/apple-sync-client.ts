import type { SyncAssistantAction } from '@/lib/assistant/types'

export const APPLE_CALENDAR_CHANGED_EVENT = 'sync:apple-calendar-changed'
export const APPLE_CALENDAR_CONTEXT_KEY = 'sync-apple-calendar-context'
export const APPLE_CALENDAR_EVENTS_KEY = 'sync-apple-calendar-events'

export type AppleClientEvent = {
  id?: string
  title: string
  start: string
  end: string
  allDay?: boolean
  noteId?: string
  description?: string
}

type AppleOperation = 'create' | 'update' | 'delete'

export async function mutateAppleCalendar(
  operation: AppleOperation,
  events: AppleClientEvent[],
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher('/api/calendar/apple/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, events }),
  })
  const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string; results?: unknown[] }
  if (!response.ok) {
    const error = new Error(body.error ?? 'Apple Calendar kunne ikke oppdateres.')
    Object.assign(error, { code: body.code, status: response.status })
    throw error
  }
  return body.results ?? []
}

export async function writeAssistantCalendarActionToApple(
  action: Extract<SyncAssistantAction, {
    kind: 'create_calendar_event' | 'create_calendar_events' | 'update_calendar_events' | 'delete_calendar_events'
  }>,
  fetcher: typeof fetch = fetch,
) {
  if (action.kind === 'delete_calendar_events') return mutateAppleCalendar('delete', action.events, fetcher)
  const events = action.kind === 'create_calendar_event' ? [action] : action.events
  return mutateAppleCalendar(action.kind === 'update_calendar_events' ? 'update' : 'create', events, fetcher)
}
