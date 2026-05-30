import { describe, it, expect } from 'vitest'
import { parseAppleIcs } from './apple'

const TIMED_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-1@icloud.com
SUMMARY:Dentist
LOCATION:Clinic
DTSTART:20260512T090000Z
DTEND:20260512T093000Z
END:VEVENT
END:VCALENDAR`

const ALLDAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-2@icloud.com
SUMMARY:Vacation
DTSTART;VALUE=DATE:20260601
DTEND;VALUE=DATE:20260602
END:VEVENT
END:VCALENDAR`

describe('parseAppleIcs', () => {
  it('parses a timed VEVENT', () => {
    const out = parseAppleIcs(TIMED_ICS)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('apple:evt-1@icloud.com')
    expect(out[0].title).toBe('Dentist')
    expect(out[0].location).toBe('Clinic')
    expect(out[0].allDay).toBe(false)
    expect(new Date(out[0].start).toISOString()).toBe('2026-05-12T09:00:00.000Z')
    expect(out[0].provider).toBe('apple')
  })

  it('parses an all-day VEVENT as a timezone-independent date string', () => {
    const out = parseAppleIcs(ALLDAY_ICS)
    expect(out[0].allDay).toBe(true)
    expect(out[0].title).toBe('Vacation')
    expect(out[0].start).toBe('2026-06-01')
    expect(out[0].end).toBe('2026-06-02')
  })

  it('returns [] for an ICS with no events', () => {
    expect(parseAppleIcs('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR')).toEqual([])
  })
})
