import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchMeteredIceServers,
  hasTurnServer,
  IceConfigurationError,
  parseIceServers,
} from './call-ice'

const validResponse = [
  { urls: 'stun:global.relay.metered.ca:80' },
  {
    urls: 'turn:global.relay.metered.ca:443?transport=tcp',
    username: 'turn-user',
    credential: 'turn-password',
    apiKey: 'must-not-leak',
    extra: 'must-not-leak',
  },
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('call ICE configuration', () => {
  it('accepts only STUN and authenticated TURN URLs and strips unknown fields', () => {
    const parsed = parseIceServers(validResponse)
    expect(parsed).toEqual([
      { urls: 'stun:global.relay.metered.ca:80' },
      {
        urls: 'turn:global.relay.metered.ca:443?transport=tcp',
        username: 'turn-user',
        credential: 'turn-password',
      },
    ])
    expect(JSON.stringify(parsed)).not.toContain('apiKey')
    expect(JSON.stringify(parsed)).not.toContain('extra')
    expect(hasTurnServer(parsed!)).toBe(true)
  })

  it('rejects unsafe URLs and TURN entries without credentials', () => {
    expect(parseIceServers([{ urls: 'https://example.com/ice' }])).toBeNull()
    expect(parseIceServers([{ urls: 'turn:relay.example.com:443' }])).toBeNull()
    expect(
      parseIceServers([
        {
          urls: ['stun:relay.example.com:80', 'javascript:alert(1)'],
        },
      ])
    ).toBeNull()
  })

  it('rejects missing or invalid Metered configuration before fetching', async () => {
    const fetchImpl = vi.fn()
    await expect(
      fetchMeteredIceServers({ domain: undefined, apiKey: undefined, fetchImpl })
    ).rejects.toMatchObject({ status: 503 } satisfies Partial<IceConfigurationError>)
    await expect(
      fetchMeteredIceServers({
        domain: 'https://attacker.example.com',
        apiKey: 'fake-key',
        fetchImpl,
      })
    ).rejects.toMatchObject({ status: 503 } satisfies Partial<IceConfigurationError>)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects provider responses without relay and never logs credentials', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args
      return new Response(JSON.stringify([{ urls: 'stun:global.relay.metered.ca:80' }]))
    })

    await expect(
      fetchMeteredIceServers({
        domain: 'sync-test.metered.live',
        apiKey: 'fake-key',
        fetchImpl,
      })
    ).rejects.toMatchObject({ status: 502 } satisfies Partial<IceConfigurationError>)
    expect(logSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('returns Google STUN fallback plus a validated Metered relay list', async () => {
    const fetchImpl = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args
      return new Response(JSON.stringify(validResponse))
    })
    const servers = await fetchMeteredIceServers({
      domain: 'sync-test.metered.live',
      apiKey: 'fake-key',
      fetchImpl,
    })
    expect(servers[0]).toEqual({ urls: 'stun:stun.l.google.com:19302' })
    expect(hasTurnServer(servers)).toBe(true)
    const requestedUrl = String(fetchImpl.mock.calls[0]?.[0])
    expect(requestedUrl).toBe(
      'https://sync-test.metered.live/api/v1/turn/credentials?apiKey=fake-key'
    )
  })
})
