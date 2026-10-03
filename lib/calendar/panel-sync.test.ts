import { describe, expect, it, vi } from 'vitest'
import { eventsForPanel, publishCalendarToPanel } from './panel-sync'
import type { RenderableEvent } from './range'

const valid: RenderableEvent = {
  id: 'one', title: ' Plan ', start: '2026-08-12T09:00:00', end: '2026-08-12T10:00:00',
  tone: 'sky', kind: 'meeting', provider: 'google', calendarName: 'Arbeid',
}

describe('eventsForPanel', () => {
  it('keeps valid Sync calendar data, identifies its source, and sorts it', () => {
    const result = eventsForPanel([
      valid,
      { ...valid, id: 'earlier', start: '2026-08-12T08:00:00', end: '2026-08-12T08:30:00', provider: undefined },
      { ...valid, id: 'invalid', end: 'bad' },
    ])
    expect(result.map((event) => event.id)).toEqual(['earlier', 'one'])
    expect(result[0].source).toBe('sync')
    expect(result[1]).toMatchObject({ title: 'Plan', source: 'google', calendarName: 'Arbeid' })
  })

  it('posts a plain-text JSON snapshot to the local panel bridge', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    await publishCalendarToPanel([valid], fetcher)
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:4173/api/sync-calendar', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    }))
  })
})
