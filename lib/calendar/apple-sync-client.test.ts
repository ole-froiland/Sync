import { describe, expect, it, vi } from 'vitest'
import { mutateAppleCalendar, writeAssistantCalendarActionToApple } from './apple-sync-client'

describe('Apple calendar sync client', () => {
  it('sends assistant-created events through the Apple mutation endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ results: [{ status: 'created' }] }))
    await writeAssistantCalendarActionToApple({
      kind: 'create_calendar_events',
      events: [{ id: 'trip-1', title: 'Seoul', start: '2027-01-10T00:00:00', end: '2027-01-20T00:00:00', allDay: true }],
    }, fetcher)

    expect(fetcher).toHaveBeenCalledWith('/api/calendar/apple/events', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        operation: 'create',
        events: [{ id: 'trip-1', title: 'Seoul', start: '2027-01-10T00:00:00', end: '2027-01-20T00:00:00', allDay: true }],
      }),
    }))
  })

  it('preserves an API error instead of pretending the calendars are synced', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      error: 'Apple Calendar is not connected',
      code: 'APPLE_NOT_CONNECTED',
    }, { status: 409 }))

    await expect(mutateAppleCalendar('create', [{ title: 'Test', start: '2026-08-14T10:00:00', end: '2026-08-14T11:00:00' }], fetcher))
      .rejects.toMatchObject({ message: 'Apple Calendar is not connected', code: 'APPLE_NOT_CONNECTED', status: 409 })
  })
})
