import { describe, expect, it } from 'vitest'
import { planCalendarAutomation } from './calendar-automation'

const now = new Date('2026-08-13T14:00:00')

describe('calendar automation', () => {
  it('creates a future all-day trip from a Norwegian date range', () => {
    const plan = planCalendarAutomation(
      [{ role: 'user', content: 'Ferie til Seoul 10.–19. januar' }],
      { now }
    )
    expect(plan?.actions[0]).toMatchObject({
      kind: 'create_calendar_events',
      events: [{ title: 'Ferie i Seoul', start: '2027-01-10T00:00:00', end: '2027-01-20T00:00:00', allDay: true }],
    })
  })

  it('creates the next twelve weekly workouts with exact times', () => {
    const plan = planCalendarAutomation(
      [{ role: 'user', content: 'Hver tirsdag: trening 18–20' }],
      { now }
    )
    const action = plan?.actions[0]
    expect(action?.kind).toBe('create_calendar_events')
    if (action?.kind !== 'create_calendar_events') return
    expect(action.events).toHaveLength(12)
    expect(action.events[0]).toMatchObject({ title: 'Trening', start: '2026-08-18T18:00:00', end: '2026-08-18T20:00:00' })
    expect(action.events.at(-1)?.start).toBe('2026-11-03T18:00:00')
  })

  it('moves one matching event while preserving its duration', () => {
    const plan = planCalendarAutomation(
      [{ role: 'user', content: 'flytt treningen neste tirsdag til kl 19' }],
      {
        now,
        events: [{ id: 'training-1', title: 'Trening', start: '2026-08-18T18:00:00', end: '2026-08-18T20:00:00', eventKind: 'focus' }],
      }
    )
    expect(plan?.actions).toEqual([{
      kind: 'update_calendar_events',
      events: [{ id: 'training-1', title: 'Trening', start: '2026-08-18T19:00:00', end: '2026-08-18T21:00:00', eventKind: 'focus', allDay: false }],
    }])
  })

  it('deletes only matching events in the requested month', () => {
    const plan = planCalendarAutomation(
      [{ role: 'user', content: 'slett alle treningene i januar' }],
      {
        now,
        events: [
          { id: 'jan', title: 'Trening', start: '2027-01-05T18:00:00', end: '2027-01-05T20:00:00' },
          { id: 'feb', title: 'Trening', start: '2027-02-02T18:00:00', end: '2027-02-02T20:00:00' },
          { id: 'other', title: 'Møte', start: '2027-01-05T10:00:00', end: '2027-01-05T11:00:00' },
        ],
      }
    )
    expect(plan?.actions).toEqual([{ kind: 'delete_calendar_events', events: [expect.objectContaining({ id: 'jan' })] }])
  })

  it('does nothing destructive when no event matches', () => {
    const plan = planCalendarAutomation(
      [{ role: 'user', content: 'slett alle treningene i januar' }],
      { now, events: [] }
    )
    expect(plan?.actions).toEqual([])
    expect(plan?.reply).toContain('Ingenting blir slettet')
  })
})
