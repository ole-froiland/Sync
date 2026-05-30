import { describe, it, expect } from 'vitest'
import { visibleRange, externalToCalendarEvent } from './range'

describe('visibleRange', () => {
  it('covers the whole 6-week month grid for month view', () => {
    const { start, end } = visibleRange('month', new Date(2026, 4, 15))
    // May 2026 grid (Mon-start) begins Apr 27, ends Jun 7; with 1-day buffer.
    expect(start.getTime()).toBeLessThanOrEqual(new Date(2026, 3, 27).getTime())
    expect(end.getTime()).toBeGreaterThanOrEqual(new Date(2026, 5, 7).getTime())
  })

  it('returns a 1-day span (plus buffer) for day view', () => {
    const { start, end } = visibleRange('day', new Date(2026, 4, 15))
    expect(end.getTime() - start.getTime()).toBeLessThanOrEqual(4 * 24 * 60 * 60 * 1000)
  })
})

describe('externalToCalendarEvent', () => {
  it('maps an external event to a read-only calendar event with a provider tone', () => {
    const ev = externalToCalendarEvent({
      id: 'google:abc',
      title: 'Sync',
      start: '2026-05-12T09:00:00Z',
      end: '2026-05-12T10:00:00Z',
      allDay: false,
      provider: 'google',
    })
    expect(ev.external).toBe(true)
    expect(ev.provider).toBe('google')
    expect(ev.tone).toBe('sky')
    expect(ev.id).toBe('google:abc')
  })
})
