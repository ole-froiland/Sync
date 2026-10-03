import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireUser } from '@/lib/api-auth'
import { mutateEvents } from '@/lib/calendar/providers/apple'
import { POST } from './route'

vi.mock('@/lib/api-auth', () => ({ requireUser: vi.fn() }))
vi.mock('@/lib/calendar/providers/apple', () => ({ mutateEvents: vi.fn() }))

describe('Apple Calendar mutation route', () => {
  const maybeSingle = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    maybeSingle.mockResolvedValue({ data: { id: 'connection-1', provider: 'apple' }, error: null })
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    }
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: { from: vi.fn(() => builder) },
      profile: null,
    } as never)
    vi.mocked(mutateEvents).mockResolvedValue([{ id: 'apple:sync-1', status: 'created' }])
  })

  it('writes a validated event to the authenticated Apple connection', async () => {
    const response = await POST(calendarRequest({
      operation: 'create',
      events: [{
        id: 'cal-1',
        title: 'Trening',
        start: '2026-08-18T18:00:00',
        end: '2026-08-18T20:00:00',
        noteId: 'note-1',
      }],
    }))

    expect(response.status).toBe(200)
    expect(mutateEvents).toHaveBeenCalledWith(expect.objectContaining({ id: 'connection-1' }), {
      operation: 'create',
      events: [expect.objectContaining({ id: 'cal-1', title: 'Trening', noteId: 'note-1' })],
    })
  })

  it('returns a distinct status when Apple Calendar is not connected', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    const response = await POST(calendarRequest({
      operation: 'delete',
      events: [{ id: 'apple:event@icloud.com' }],
    }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'APPLE_NOT_CONNECTED' })
    expect(mutateEvents).not.toHaveBeenCalled()
  })

  it('rejects incomplete events without contacting Apple', async () => {
    const response = await POST(calendarRequest({ operation: 'create', events: [{ title: 'Missing dates' }] }))
    expect(response.status).toBe(400)
    expect(mutateEvents).not.toHaveBeenCalled()
  })
})

function calendarRequest(body: unknown) {
  return new Request('http://localhost/api/calendar/apple/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
