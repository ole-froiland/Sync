import { describe, it, expect } from 'vitest'
import { mapGoogleEvents } from './google'

describe('mapGoogleEvents', () => {
  it('maps a timed event', () => {
    const out = mapGoogleEvents([
      {
        id: 'abc',
        summary: 'Sprint planning',
        location: 'Room 1',
        status: 'confirmed',
        start: { dateTime: '2026-05-12T09:00:00+02:00' },
        end: { dateTime: '2026-05-12T10:00:00+02:00' },
      },
    ], 'primary', 'Primary')
    expect(out).toEqual([
      {
        id: 'google:abc',
        title: 'Sprint planning',
        start: '2026-05-12T09:00:00+02:00',
        end: '2026-05-12T10:00:00+02:00',
        allDay: false,
        provider: 'google',
        calendarId: 'primary',
        calendarName: 'Primary',
        location: 'Room 1',
      },
    ])
  })

  it('maps an all-day event using date fields', () => {
    const out = mapGoogleEvents([
      { id: 'd1', summary: 'Holiday', start: { date: '2026-05-17' }, end: { date: '2026-05-18' } },
    ])
    expect(out[0].allDay).toBe(true)
    expect(out[0].start).toBe('2026-05-17')
  })

  it('falls back to a placeholder title and drops cancelled events', () => {
    const out = mapGoogleEvents([
      { id: 'x', status: 'cancelled', start: { dateTime: '2026-05-12T09:00:00Z' }, end: { dateTime: '2026-05-12T10:00:00Z' } },
      { id: 'y', start: { dateTime: '2026-05-12T11:00:00Z' }, end: { dateTime: '2026-05-12T12:00:00Z' } },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('(No title)')
  })
})
