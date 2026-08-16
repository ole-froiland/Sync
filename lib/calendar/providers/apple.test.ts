import { describe, it, expect } from 'vitest'
import { appleUidFromId, buildAppleIcs, parseAppleIcs, selectWritableCalendar } from './apple'

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
    const out = parseAppleIcs(TIMED_ICS, 'cal-url-1', 'Trening')
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('apple:evt-1@icloud.com')
    expect(out[0].title).toBe('Dentist')
    expect(out[0].location).toBe('Clinic')
    expect(out[0].allDay).toBe(false)
    expect(new Date(out[0].start).toISOString()).toBe('2026-05-12T09:00:00.000Z')
    expect(out[0].provider).toBe('apple')
    expect(out[0].calendarId).toBe('cal-url-1')
    expect(out[0].calendarName).toBe('Trening')
  })

  it('parses an all-day VEVENT as a timezone-independent date string', () => {
    const out = parseAppleIcs(ALLDAY_ICS, 'cal-url-1', 'Trening')
    expect(out[0].allDay).toBe(true)
    expect(out[0].title).toBe('Vacation')
    expect(out[0].start).toBe('2026-06-01')
    expect(out[0].end).toBe('2026-06-02')
  })

  it('returns [] for an ICS with no events', () => {
    expect(parseAppleIcs('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR', 'cal-url-1', 'Trening')).toEqual([])
  })

  const RECURRING_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:run@icloud.com
SUMMARY:Morgen-loping
DTSTART:20260501T064500Z
DTEND:20260501T071500Z
RRULE:FREQ=DAILY;COUNT=20
EXDATE:20260503T064500Z
END:VEVENT
END:VCALENDAR`

  it('expands a daily recurring event across the requested range', () => {
    const out = parseAppleIcs(
      RECURRING_ICS,
      'cal-url-1',
      'Trening',
      new Date('2026-05-01T00:00:00Z'),
      new Date('2026-05-08T00:00:00Z'),
    )
    // May 1-7 inclusive minus the May 3 EXDATE = 6 occurrences
    expect(out).toHaveLength(6)
    const starts = out.map((e) => e.start)
    expect(starts).toContain('2026-05-01T06:45:00.000Z')
    expect(starts).toContain('2026-05-07T06:45:00.000Z')
    // outside the requested range
    expect(starts).not.toContain('2026-05-13T06:45:00.000Z')
    // EXDATE excluded
    expect(starts).not.toContain('2026-05-03T06:45:00.000Z')
    // every occurrence keeps the 30-minute duration
    expect(new Date(out[1].end).getTime() - new Date(out[1].start).getTime()).toBe(30 * 60 * 1000)
  })

  it('gives each recurring occurrence a unique id', () => {
    const out = parseAppleIcs(
      RECURRING_ICS,
      'cal-url-1',
      'Trening',
      new Date('2026-05-01T00:00:00Z'),
      new Date('2026-05-08T00:00:00Z'),
    )
    const ids = out.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toMatch(/^apple:run@icloud\.com:/)
  })

  it('falls back to a single occurrence when no range is given (recurrence not expanded)', () => {
    const out = parseAppleIcs(RECURRING_ICS, 'cal-url-1', 'Trening')
    expect(out).toHaveLength(1)
  })

  it('applies a RECURRENCE-ID override to the matching occurrence', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:standup@icloud.com
SUMMARY:Standup
DTSTART:20260504T080000Z
DTEND:20260504T081500Z
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4
END:VEVENT
BEGIN:VEVENT
UID:standup@icloud.com
RECURRENCE-ID:20260511T080000Z
SUMMARY:Standup (moved)
DTSTART:20260511T090000Z
DTEND:20260511T091500Z
END:VEVENT
END:VCALENDAR`
    const out = parseAppleIcs(
      ics,
      'cal-url-1',
      'Trening',
      new Date('2026-05-01T00:00:00Z'),
      new Date('2026-06-01T00:00:00Z'),
    )
    const moved = out.find((e) => e.title === 'Standup (moved)')
    expect(moved).toBeDefined()
    expect(moved?.start).toBe('2026-05-11T09:00:00.000Z')
    // the original 08:00 occurrence on the 11th should not also appear
    expect(out.filter((e) => e.start.startsWith('2026-05-11')).length).toBe(1)
  })
})

describe('Apple calendar writes', () => {
  it('builds a timed Oslo event with a stable Sync note link', () => {
    const ics = buildAppleIcs({
      id: 'cal-note-1',
      title: 'Bestill pass, og hotell',
      start: '2027-01-10T18:00:00',
      end: '2027-01-10T19:00:00',
      noteId: 'note-1',
    }, 'sync-test@sync')

    expect(ics).toContain('UID:sync-test@sync')
    expect(ics).toContain('SUMMARY:Bestill pass\\, og hotell')
    expect(ics).toContain('DTSTART;TZID=Europe/Oslo:20270110T180000')
    expect(ics).toContain('DTEND;TZID=Europe/Oslo:20270110T190000')
    expect(ics).toContain('X-SYNC-NOTE-ID:note-1')
  })

  it('uses an exclusive end date for an all-day trip', () => {
    const ics = buildAppleIcs({
      title: 'Seoul',
      start: '2027-01-10T00:00:00',
      end: '2027-01-20T00:00:00',
      allDay: true,
    }, 'trip@sync')

    expect(ics).toContain('DTSTART;VALUE=DATE:20270110')
    expect(ics).toContain('DTEND;VALUE=DATE:20270120')
  })

  it('selects a normal Apple calendar over auxiliary calendars', () => {
    const selected = selectWritableCalendar([
      { url: '/birthdays', displayName: 'Birthdays', components: ['VEVENT'] },
      { url: '/calendar', displayName: 'Calendar', components: ['VEVENT'] },
    ])
    expect(selected?.url).toBe('/calendar')
  })

  it('extracts the underlying UID from normal and recurring Apple ids', () => {
    expect(appleUidFromId('apple:event@icloud.com')).toBe('event@icloud.com')
    expect(appleUidFromId('apple:event@icloud.com:2027-01-10T18:00:00.000Z')).toBe('event@icloud.com')
    expect(appleUidFromId('sync:event')).toBeNull()
  })
})
