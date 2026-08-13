import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireUser } from '@/lib/api-auth'
import { logAiAuditEvent } from '@/lib/assistant/audit'
import { POST } from './route'

vi.mock('@/lib/api-auth', () => ({ requireUser: vi.fn() }))
vi.mock('@/lib/assistant/audit', () => ({ logAiAuditEvent: vi.fn() }))

describe('Sync AI chat route', () => {
  beforeEach(() => {
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
      profile: null,
    } as never)
    vi.mocked(logAiAuditEvent).mockResolvedValue(undefined)
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
})

function chatRequest(body: unknown) {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
