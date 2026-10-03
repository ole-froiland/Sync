import { describe, expect, it } from 'vitest'
import { safeInternalRedirect } from '@/lib/auth-redirect'

describe('safeInternalRedirect', () => {
  it('keeps an internal path with query parameters', () => {
    expect(safeInternalRedirect('/oauth/consent?authorization_id=abc')).toBe(
      '/oauth/consent?authorization_id=abc'
    )
  })

  it.each([
    'https://evil.example/path',
    '//evil.example/path',
    'javascript:alert(1)',
    '',
  ])('rejects unsafe redirect %s', (value) => {
    expect(safeInternalRedirect(value)).toBe('/dashboard')
  })
})
