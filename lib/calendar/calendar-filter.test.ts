import { describe, it, expect } from 'vitest'
import { buildCalendarList, filterByCalendars, eventCalendarId } from './calendar-filter'

type E = {
  id: string
  provider?: 'google' | 'apple' | 'microsoft'
  calendarId?: string
  calendarName?: string
}

const events: E[] = [
  { id: 'a', provider: 'apple', calendarId: 'url-trening', calendarName: 'Trening' },
  { id: 'b', provider: 'apple', calendarId: 'url-jobb', calendarName: 'Jobb' },
  { id: 'c', provider: 'google', calendarId: 'primary', calendarName: 'Primary' },
  { id: 'd' }, // local Sync block
]

describe('eventCalendarId', () => {
  it('uses calendarId for external and "sync" for local', () => {
    expect(eventCalendarId(events[0])).toBe('url-trening')
    expect(eventCalendarId(events[3])).toBe('sync')
  })
})

describe('buildCalendarList', () => {
  it('lists distinct calendars grouped sync→google→apple, sorted by name', () => {
    const list = buildCalendarList(events)
    expect(list.map((c) => c.id)).toEqual(['sync', 'primary', 'url-jobb', 'url-trening'])
    expect(list.map((c) => c.source)).toEqual(['sync', 'google', 'apple', 'apple'])
    expect(list.find((c) => c.id === 'sync')?.name).toBe('Sync blocks')
  })

  it('assigns a stable colour per calendar id regardless of order', () => {
    const a = buildCalendarList(events)
    const b = buildCalendarList([...events].reverse())
    const colorOf = (list: ReturnType<typeof buildCalendarList>, id: string) =>
      list.find((c) => c.id === id)?.color
    expect(colorOf(a, 'url-trening')).toBe(colorOf(b, 'url-trening'))
  })
})

describe('filterByCalendars', () => {
  it('drops events whose calendar is hidden', () => {
    const out = filterByCalendars(events, new Set(['url-trening', 'sync']))
    expect(out.map((e) => e.id)).toEqual(['b', 'c'])
  })

  it('keeps everything when nothing is hidden', () => {
    expect(filterByCalendars(events, new Set())).toHaveLength(4)
  })
})
