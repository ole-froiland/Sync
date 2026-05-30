import { describe, it, expect } from 'vitest'
import { isExpired, buildRefreshRequest } from './token'

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
