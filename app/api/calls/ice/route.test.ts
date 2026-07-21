import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}))

import { GET } from './route'

describe('GET /api/calls/ice', () => {
  beforeEach(() => {
    getUser.mockReset()
    process.env.METERED_DOMAIN = 'sync-test.metered.live'
    process.env.METERED_TURN_API_KEY = 'fake-api-key'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.METERED_DOMAIN
    delete process.env.METERED_TURN_API_KEY
  })

  it('requires an authenticated Sync user before contacting Metered', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const response = await GET()
    expect(response.status).toBe(401)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns only the sanitized ICE configuration to an authenticated user', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              urls: 'turn:global.relay.metered.ca:443',
              username: 'turn-user',
              credential: 'turn-password',
              apiKey: 'must-not-leak',
            },
          ])
        )
      )
    )
    const response = await GET()
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body.iceServers).toEqual(
      expect.arrayContaining([
        {
          urls: 'turn:global.relay.metered.ca:443',
          username: 'turn-user',
          credential: 'turn-password',
        },
      ])
    )
    expect(JSON.stringify(body)).not.toContain('apiKey')
    expect(JSON.stringify(body)).not.toContain(process.env.METERED_TURN_API_KEY)
  })

  it('returns a controlled error for missing configuration', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    delete process.env.METERED_DOMAIN
    const response = await GET()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: 'Secure call relay is unavailable. Please try again shortly.',
    })
  })
})
