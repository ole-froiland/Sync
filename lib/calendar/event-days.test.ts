import { describe, expect, it } from 'vitest'
import { eventOccursOnDay } from './event-days'

describe('eventOccursOnDay', () => {
  it('shows an all-day trip on every included date and not on the exclusive end date', () => {
    const trip = {
      start: '2027-01-10T00:00:00',
      end: '2027-01-20T00:00:00',
      allDay: true,
    }

    expect(eventOccursOnDay(trip, new Date(2027, 0, 10))).toBe(true)
    expect(eventOccursOnDay(trip, new Date(2027, 0, 15))).toBe(true)
    expect(eventOccursOnDay(trip, new Date(2027, 0, 19))).toBe(true)
    expect(eventOccursOnDay(trip, new Date(2027, 0, 20))).toBe(false)
  })
})
