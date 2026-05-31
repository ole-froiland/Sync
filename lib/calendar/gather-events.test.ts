import { describe, it, expect } from 'vitest'
import { gatherExternalEvents } from './gather-events'
import type { CalendarConnectionRow, CalendarProvider, ExternalEvent } from './providers/types'

function connection(provider: CalendarProvider, id = provider): CalendarConnectionRow {
  return {
    id,
    user_id: 'user-1',
    provider,
    provider_account_id: null,
    provider_account_name: null,
    provider_email: null,
    access_token: null,
    refresh_token: null,
    token_type: null,
    scope: null,
    expires_at: null,
    caldav_server_url: null,
    caldav_username: null,
    caldav_app_password: null,
    status: 'connected',
  }
}

function event(provider: CalendarProvider, id: string): ExternalEvent {
  return {
    id: `${provider}:${id}`,
    title: id,
    start: '2026-05-12T09:00:00.000Z',
    end: '2026-05-12T10:00:00.000Z',
    allDay: false,
    provider,
    calendarId: provider,
    calendarName: provider,
  }
}

const range = { start: new Date('2026-05-01'), end: new Date('2026-06-01') }

describe('gatherExternalEvents', () => {
  it('returns events from all healthy providers', async () => {
    const resolve = async (p: CalendarProvider) => async () => [event(p, '1')]
    const result = await gatherExternalEvents(
      [connection('google'), connection('apple')],
      resolve,
      range.start,
      range.end,
    )
    expect(result.events).toHaveLength(2)
    expect(result.providerErrors).toEqual([])
    expect(result.failedConnectionIds).toEqual([])
  })

  it('isolates a failing provider so others still load', async () => {
    const resolve = async (p: CalendarProvider) => {
      if (p === 'apple') return async () => { throw new Error('Apple CalDAV credentials are missing') }
      return async () => [event(p, '1')]
    }
    const result = await gatherExternalEvents(
      [connection('google'), connection('apple')],
      resolve,
      range.start,
      range.end,
    )
    expect(result.events.map((e) => e.provider)).toEqual(['google'])
    expect(result.providerErrors).toEqual([
      { provider: 'apple', message: 'Apple CalDAV credentials are missing' },
    ])
    expect(result.failedConnectionIds).toEqual(['apple'])
  })

  it('catches a failing adapter resolver (e.g. module import failure)', async () => {
    const resolve = async (p: CalendarProvider) => {
      if (p === 'apple') throw new Error('Cannot find module tsdav')
      return async () => [event(p, '1')]
    }
    const result = await gatherExternalEvents(
      [connection('google'), connection('apple')],
      resolve,
      range.start,
      range.end,
    )
    expect(result.events.map((e) => e.provider)).toEqual(['google'])
    expect(result.providerErrors[0]?.provider).toBe('apple')
    expect(result.failedConnectionIds).toEqual(['apple'])
  })

  it('times out a hanging provider instead of blocking forever', async () => {
    const resolve = async (p: CalendarProvider) => {
      if (p === 'apple') return () => new Promise<ExternalEvent[]>(() => {}) // never resolves
      return async () => [event(p, '1')]
    }
    const result = await gatherExternalEvents(
      [connection('google'), connection('apple')],
      resolve,
      range.start,
      range.end,
      50,
    )
    expect(result.events.map((e) => e.provider)).toEqual(['google'])
    expect(result.providerErrors[0]?.provider).toBe('apple')
    expect(result.providerErrors[0]?.message).toMatch(/timed out/i)
  })
})
