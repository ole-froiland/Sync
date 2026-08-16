import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireUser } from '@/lib/api-auth'
import { logAiAuditEvent } from '@/lib/assistant/audit'
import { planCalendarAutomation } from '@/lib/assistant/calendar-automation'
import { planLocalGemmaResponse } from '@/lib/assistant/local-gemma'
import { planNorwegianFootballFixtures } from '@/lib/assistant/norwegian-fixtures'
import { planPremierLeagueFixtures } from '@/lib/assistant/sports-fixtures'
import { POST } from './route'

vi.mock('@/lib/api-auth', () => ({ requireUser: vi.fn() }))
vi.mock('@/lib/assistant/audit', () => ({ logAiAuditEvent: vi.fn() }))
vi.mock('@/lib/assistant/calendar-automation', () => ({ planCalendarAutomation: vi.fn() }))
vi.mock('@/lib/assistant/norwegian-fixtures', () => ({ planNorwegianFootballFixtures: vi.fn() }))
vi.mock('@/lib/assistant/sports-fixtures', () => ({ planPremierLeagueFixtures: vi.fn() }))
vi.mock('@/lib/assistant/local-gemma', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/assistant/local-gemma')>()
  return { ...actual, planLocalGemmaResponse: vi.fn() }
})

describe('Sync AI chat route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
      profile: null,
    } as never)
    vi.mocked(logAiAuditEvent).mockResolvedValue(undefined)
    vi.mocked(planNorwegianFootballFixtures).mockResolvedValue(null)
    vi.mocked(planPremierLeagueFixtures).mockResolvedValue(null)
    vi.mocked(planLocalGemmaResponse).mockResolvedValue(null)
    vi.mocked(planCalendarAutomation).mockReturnValue(null)
  })

  it('validates a browser-local plan and returns normal action envelopes', async () => {
    const response = await POST(chatRequest({
      messages: [{ role: 'user', content: 'husk passet' }],
      currentPath: '/notes',
      clientPlan: {
        reply: 'Jeg har gjort notatet klart.',
        outOfScope: false,
        actions: [{ kind: 'create_note', title: 'Husk passet' }],
      },
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.planner).toBe('browser')
    expect(body.model).toBe('browser-local')
    expect(body.actions[0].action).toEqual({ kind: 'create_note', title: 'Husk passet' })
    expect(body.actions[0].requiresConfirmation).toBe(true)
  })

  it('rejects an invalid browser-local plan', async () => {
    const response = await POST(chatRequest({
      messages: [{ role: 'user', content: 'gjør noe' }],
      currentPath: '/notes',
      clientPlan: { reply: 'Ugyldig', actions: [{ kind: 'unknown' }] },
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid local AI plan' })
  })

  it('uses owner Gemma for an actionable trip before the rule-based calendar fallback', async () => {
    vi.mocked(planLocalGemmaResponse).mockResolvedValue({
      reply: 'Reisen er klar.',
      actions: [{
        kind: 'create_calendar_events',
        events: [{
          id: 'trip-seoul',
          title: 'Reise til Seoul',
          start: '2027-01-10T00:00:00',
          end: '2027-01-20T00:00:00',
          allDay: true,
        }],
      }],
    })
    vi.mocked(planCalendarAutomation).mockReturnValue({ reply: 'Regelfallback', actions: [] })

    const response = await POST(chatRequest({
      messages: [{ role: 'user', content: 'jeg skal til Seoul 10 til 19 januar' }],
      currentPath: '/calendar',
    }))
    const body = await response.json()

    expect(body.planner).toBe('gemma')
    expect(body.actions[0].action).toMatchObject({ kind: 'create_calendar_events' })
    expect(planCalendarAutomation).not.toHaveBeenCalled()
  })

  it('uses verified fixture data before asking Gemma to plan sports dates', async () => {
    vi.mocked(planPremierLeagueFixtures).mockResolvedValue({
      reply: 'Offisielle kamper klare.',
      actions: [{
        kind: 'create_calendar_events',
        events: [{
          id: 'pl-1',
          title: 'Arsenal – Manchester City',
          start: '2026-09-12T14:00:00.000Z',
          end: '2026-09-12T16:00:00.000Z',
        }],
      }],
    })

    const response = await POST(chatRequest({
      messages: [{ role: 'user', content: 'legg inn alle Arsenal-kampene' }],
      currentPath: '/calendar',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.actions[0].action).toMatchObject({ kind: 'create_calendar_events' })
    expect(planLocalGemmaResponse).not.toHaveBeenCalled()
  })
})

function chatRequest(body: unknown) {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
