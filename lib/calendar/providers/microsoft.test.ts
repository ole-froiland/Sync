import { describe, it, expect } from 'vitest'
import { mapMicrosoftEvents } from './microsoft'

describe('mapMicrosoftEvents', () => {
  it('maps a timed event and forces UTC Z suffix', () => {
    const value = [
      {
        id: 'm1',
        subject: 'Standup',
        isAllDay: false,
        location: { displayName: 'Teams' },
        start: { dateTime: '2026-05-12T07:00:00.0000000', timeZone: 'UTC' },
        end: { dateTime: '2026-05-12T07:30:00.0000000', timeZone: 'UTC' },
      },
    ]
    const out = mapMicrosoftEvents(value, 'primary', 'Outlook')
    expect(out).toEqual([
      {
        id: 'microsoft:m1',
        title: 'Standup',
        start: '2026-05-12T07:00:00.0000000Z',
        end: '2026-05-12T07:30:00.0000000Z',
        allDay: false,
        provider: 'microsoft',
        calendarId: 'primary',
        calendarName: 'Outlook',
        location: 'Teams',
      },
    ])
  })

  it('handles all-day and missing subject/location', () => {
    const out = mapMicrosoftEvents([
      {
        id: 'm2',
        isAllDay: true,
        start: { dateTime: '2026-05-17T00:00:00.0000000', timeZone: 'UTC' },
        end: { dateTime: '2026-05-18T00:00:00.0000000', timeZone: 'UTC' },
      },
    ])
    expect(out[0].allDay).toBe(true)
    expect(out[0].title).toBe('(No title)')
    expect(out[0].location).toBeUndefined()
  })
})
