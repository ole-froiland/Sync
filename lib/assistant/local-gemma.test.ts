import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  decryptBody,
  encryptBody,
  localGemmaAllowedForUser,
  normalizeLocalModelPlan,
  planLocalGemmaResponse,
  signBridgePayload,
  validBridgeEnvelope,
} from './local-gemma'

describe('local Gemma bridge', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows only explicitly configured owner users', () => {
    expect(localGemmaAllowedForUser('owner', 'owner')).toBe(true)
    expect(localGemmaAllowedForUser('second-owner', 'owner, second-owner ')).toBe(true)
    expect(localGemmaAllowedForUser('other-user', 'owner')).toBe(false)
    expect(localGemmaAllowedForUser('owner', undefined)).toBe(false)
    expect(localGemmaAllowedForUser(undefined, 'owner')).toBe(false)
  })

  it('does not contact the bridge for a non-owner user', async () => {
    vi.stubEnv('LOCAL_AI_OWNER_USER_IDS', 'owner')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key')
    vi.stubEnv('LOCAL_AI_BRIDGE_TOKEN', 'test-token')

    await expect(planLocalGemmaResponse(
      [{ role: 'user', content: 'hjelp meg' }],
      { userId: 'other-user' },
    )).resolves.toBeNull()
  })

  it('accepts a valid note plan', () => {
    expect(normalizeLocalModelPlan({
      reply: 'Jeg har gjort notatet klart. Bekreft for å lagre det.',
      outOfScope: false,
      actions: [{ kind: 'create_note', title: 'Bestill pass' }],
    }, {})).toEqual({
      reply: 'Jeg har gjort notatet «Bestill pass» klart. Bekreft for å lagre det.',
      outOfScope: false,
      actions: [{ kind: 'create_note', title: 'Bestill pass' }],
    })
  })

  it('rejects invented calendar ids and wrong project ids', () => {
    expect(normalizeLocalModelPlan({
      reply: 'Ferdig.',
      outOfScope: false,
      actions: [{
        kind: 'delete_calendar_events',
        events: [{ id: 'invented', title: 'Møte', start: '2026-08-14T10:00:00', end: '2026-08-14T11:00:00' }],
      }],
    }, { calendarEvents: [] })).toBeNull()

    expect(normalizeLocalModelPlan({
      reply: 'Task klar.',
      outOfScope: false,
      actions: [{ kind: 'create_task', projectId: 'wrong', title: 'Test' }],
    }, { currentPath: '/projects/right' })).toBeNull()
  })

  it('uses the trusted calendar event when deleting', () => {
    const existing = { id: 'event-1', title: 'Riktig møte', start: '2026-08-14T10:00:00', end: '2026-08-14T11:00:00' }
    const plan = normalizeLocalModelPlan({
      reply: 'Jeg fant møtet. Bekreft sletting.',
      outOfScope: false,
      actions: [{
        kind: 'delete_calendar_events',
        events: [{ id: 'event-1', title: 'Skjult annet navn', start: '2028-01-01T10:00:00', end: '2028-01-01T11:00:00' }],
      }],
    }, { calendarEvents: [existing] })

    expect(plan?.actions).toEqual([{ kind: 'delete_calendar_events', events: [existing] }])
  })

  it('authenticates and decodes bridge payloads', () => {
    const token = 'test-secret'
    const id = 'job-1'
    const body = encryptBody({ reply: 'hei' }, token)
    const signature = signBridgePayload(token, id, body)

    expect(decryptBody(body, token)).toEqual({ reply: 'hei' })
    expect(validBridgeEnvelope({ id, body, signature }, token, id)).toBe(true)
    expect(validBridgeEnvelope({ id, body, signature: `${signature}0` }, token, id)).toBe(false)

    const encrypted = encryptBody({ private: 'kalendertekst' }, token)
    expect(encrypted).not.toContain('kalendertekst')
    expect(decryptBody(encrypted, token)).toEqual({ private: 'kalendertekst' })
    expect(decryptBody(encrypted, 'wrong-secret')).toBeNull()
  })

  it.runIf(process.env.LOCAL_AI_LIVE_TEST === '1')('round-trips a free-form request through the local model', async () => {
    vi.stubEnv('LOCAL_AI_OWNER_USER_IDS', 'live-test-user')
    const plan = await planLocalGemmaResponse(
      [{ role: 'user', content: 'jeg må virkelig huske å bestille nytt pass, kan du ordne det i sync?' }],
      { userId: 'live-test-user', currentPath: '/notes', now: new Date('2026-08-13T15:00:00+02:00') },
    )

    expect(plan?.actions[0]).toMatchObject({ kind: 'create_note' })
    expect(JSON.stringify(plan?.actions).toLowerCase()).toContain('pass')
  }, 35_000)
})
