import { describe, expect, it } from 'vitest'
import {
  ACTIVE_NOW_WINDOW_MS,
  formatLastActiveValue,
  formatMemberSince,
  getPresenceInfo,
} from './people-presence'

const NOW = Date.parse('2026-07-16T12:00:00.000Z')

describe('people presence', () => {
  it('treats recent heartbeats as active', () => {
    const heartbeat = new Date(NOW - ACTIVE_NOW_WINDOW_MS).toISOString()
    expect(getPresenceInfo(heartbeat, NOW).state).toBe('active')
  })

  it('treats older heartbeats as away', () => {
    const heartbeat = new Date(NOW - ACTIVE_NOW_WINDOW_MS - 1).toISOString()
    expect(getPresenceInfo(heartbeat, NOW).state).toBe('away')
  })

  it('handles missing and invalid timestamps', () => {
    expect(getPresenceInfo(null, NOW).state).toBe('unknown')
    expect(getPresenceInfo('not-a-date', NOW).state).toBe('unknown')
  })

  it('formats recent activity in English and Norwegian', () => {
    const twelveMinutesAgo = new Date(NOW - 12 * 60_000)
    expect(formatLastActiveValue(twelveMinutesAgo, 'en', NOW)).toBe('12m ago')
    expect(formatLastActiveValue(twelveMinutesAgo, 'no', NOW)).toBe('12 min siden')
  })

  it('formats the member month using the selected locale', () => {
    expect(formatMemberSince('2026-05-10T12:00:00Z', 'en')).toBe('May 2026')
    expect(formatMemberSince('2026-05-10T12:00:00Z', 'no')).toBe('mai 2026')
  })
})
