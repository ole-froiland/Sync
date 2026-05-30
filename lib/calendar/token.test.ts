import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isExpired, buildRefreshRequest, getValidAccessToken } from './token'

const updateEq = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ update: () => ({ eq: updateEq }) }),
  })),
}))

function makeConnection(overrides = {}) {
  return {
    id: 'conn-1',
    user_id: 'user-1',
    provider: 'google',
    provider_account_id: null,
    provider_account_name: null,
    provider_email: null,
    access_token: 'cached-token',
    refresh_token: 'refresh-token',
    token_type: 'Bearer',
    scope: null,
    expires_at: new Date(Date.now() + 600_000).toISOString(),
    caldav_server_url: null,
    caldav_username: null,
    caldav_app_password: null,
    status: 'connected',
    ...overrides,
  }
}

describe('isExpired', () => {
  it('is true when expiry is within the skew window', () => {
    expect(isExpired(new Date(Date.now() + 30_000).toISOString())).toBe(true)
  })

  it('is false when expiry is comfortably in the future', () => {
    expect(isExpired(new Date(Date.now() + 600_000).toISOString())).toBe(false)
  })

  it('is true when expiry is null (force refresh)', () => {
    expect(isExpired(null)).toBe(true)
  })
})

describe('buildRefreshRequest', () => {
  it('builds a Google refresh request', () => {
    const req = buildRefreshRequest('google', 'rt', 'cid', 'secret')
    expect(req.url).toBe('https://oauth2.googleapis.com/token')
    expect(req.body.get('grant_type')).toBe('refresh_token')
    expect(req.body.get('refresh_token')).toBe('rt')
    expect(req.body.get('client_id')).toBe('cid')
    expect(req.body.get('client_secret')).toBe('secret')
  })

  it('builds a Microsoft refresh request with scope', () => {
    const req = buildRefreshRequest('microsoft', 'rt', 'cid', 'secret')
    expect(req.url).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token')
    expect(req.body.get('scope')).toBe('offline_access User.Read Calendars.Read')
  })
})

describe('getValidAccessToken', () => {
  beforeEach(() => {
    updateEq.mockReset().mockResolvedValue({ error: null })
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'cid'
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'secret'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the cached token when it is not expired', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const token = await getValidAccessToken(makeConnection() as never)
    expect(token).toBe('cached-token')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('throws for Apple connections', async () => {
    await expect(
      getValidAccessToken(makeConnection({ provider: 'apple' }) as never),
    ).rejects.toThrow(/Apple/)
  })

  it('throws when there is no refresh token and no access token', async () => {
    await expect(
      getValidAccessToken(
        makeConnection({ access_token: null, refresh_token: null, expires_at: null }) as never,
      ),
    ).rejects.toThrow(/No refresh token/)
  })

  it('throws when OAuth is not configured on the server', async () => {
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID
    await expect(
      getValidAccessToken(makeConnection({ expires_at: null }) as never),
    ).rejects.toThrow(/not configured/)
  })

  it('refreshes an expired token, persists it, and returns the new token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ access_token: 'new-token', expires_in: 3600 }),
      })),
    )
    const token = await getValidAccessToken(makeConnection({ expires_at: null }) as never)
    expect(token).toBe('new-token')
    expect(updateEq).toHaveBeenCalledWith('id', 'conn-1')
  })

  it('throws when the refresh request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error_description: 'bad refresh token' }),
      })),
    )
    await expect(
      getValidAccessToken(makeConnection({ expires_at: null }) as never),
    ).rejects.toThrow(/bad refresh token/)
  })
})
