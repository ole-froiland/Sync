import { afterEach, describe, expect, it, vi } from 'vitest'
import { planLocalSyncResponse, planOpenAiSyncResponse } from './planner'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('planLocalSyncResponse', () => {
  const now = new Date('2026-07-08T12:00:00')

  it('plans note creation from Norwegian input', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'legg til note: ring Ola' }],
      { now }
    )

    expect(plan.actions).toEqual([{ kind: 'create_note', title: 'ring Ola' }])
  })

  it('plans calendar creation with tomorrow and time', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'lag kalenderaktivitet demo med teamet i morgen 10:30' }],
      { now }
    )

    expect(plan.actions[0]).toMatchObject({
      kind: 'create_calendar_event',
      title: 'demo med teamet',
      start: '2026-07-09T10:30:00',
      end: '2026-07-09T11:30:00',
    })
  })

  it('does not invent fixtures or dates for a bulk sports calendar request', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'hei ai, kan du legge inn alle manchester united sine kamper i kalenderen min' }],
      { now }
    )

    expect(plan.actions).toEqual([])
    expect(plan.reply.toLowerCase()).toContain('dato')
  })

  it('parses a conversational calendar request without leaking kalenderen into the title', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'hei ai, kan du legge inn møte med Ola i kalenderen i morgen kl 14:00' }],
      { now }
    )

    expect(plan.actions).toEqual([
      {
        kind: 'create_calendar_event',
        title: 'møte med Ola',
        start: '2026-07-09T14:00:00',
        end: '2026-07-09T15:00:00',
        eventKind: 'meeting',
      },
    ])
  })

  it('asks for missing calendar time instead of defaulting to 09:00', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'legg inn tannlegetime i kalenderen i morgen' }],
      { now }
    )

    expect(plan.actions).toEqual([])
    expect(plan.reply.toLowerCase()).toContain('tidspunkt')
  })

  it('parses an explicit Norwegian date and time', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'legg inn kamp i kalenderen 15.07.2026 kl 18:30' }],
      { now }
    )

    expect(plan.actions[0]).toMatchObject({
      kind: 'create_calendar_event',
      title: 'kamp',
      start: '2026-07-15T18:30:00',
      end: '2026-07-15T19:30:00',
    })
  })

  it('refuses requests outside Sync', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'hva er været i Tokyo?' }],
      { now }
    )

    expect(plan.outOfScope).toBe(true)
    expect(plan.actions).toEqual([])
  })

  it('opens settings as an overlay action', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'åpne settings' }],
      { now }
    )

    expect(plan.actions).toEqual([{ kind: 'open_modal', modal: 'settings' }])
  })

  it('opens the calendar from the exact misspelled Norwegian request', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'kan du åpne kalendern min i sync?' }],
      { now }
    )

    expect(plan.actions).toEqual([{ kind: 'navigate', href: '/calendar' }])
  })

  it('opens Projects directly in tree view', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'kan du åpne prosjekter jeg har i tre-form?' }],
      { now }
    )

    expect(plan.actions).toEqual([{ kind: 'open_projects_tree' }])
  })

  it('changes the Sync language to English', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'kan du endre språk på sync fra norsk til engelsk?' }],
      { now }
    )

    expect(plan.actions).toEqual([{ kind: 'set_language', locale: 'en' }])
  })

  it('uses the prior calendar request when the user answers a clarification', () => {
    const plan = planLocalSyncResponse(
      [
        { role: 'user', content: 'legg tannlege i kalenderen' },
        { role: 'assistant', content: 'Hvilken dato og hvilket tidspunkt?' },
        { role: 'user', content: 'i morgen kl 14' },
      ],
      { now }
    )

    expect(plan.actions[0]).toMatchObject({
      kind: 'create_calendar_event',
      title: 'tannlege',
      start: '2026-07-09T14:00:00',
    })
  })

  it('creates tasks from a project route', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'lag task: skriv readme' }],
      { now, currentPath: '/projects/project-123' }
    )

    expect(plan.actions).toEqual([
      { kind: 'create_task', projectId: 'project-123', title: 'skriv readme', status: 'todo' },
    ])
  })

  it('creates a project folder used by the current Projects page', () => {
    const plan = planLocalSyncResponse(
      [{ role: 'user', content: 'lag prosjekt: Ny nettside' }],
      { now }
    )

    expect(plan.actions).toEqual([
      { kind: 'create_project_folder', name: 'Ny nettside', description: null },
    ])
  })
})

describe('planOpenAiSyncResponse', () => {
  it('uses strict function calling and parses the Responses API function call', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    const captured: { body?: Record<string, unknown> } = {}
    vi.stubGlobal('fetch', async (_input: string | URL | Request, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(
        JSON.stringify({
          output: [
            {
              type: 'function_call',
              name: 'plan_sync_response',
              arguments: JSON.stringify({
                reply: 'Jeg åpner kalenderen.',
                outOfScope: false,
                actions: [
                  {
                    kind: 'navigate',
                    href: '/calendar',
                    modal: null,
                    title: null,
                    noteId: null,
                    start: null,
                    end: null,
                    eventKind: null,
                    body: null,
                    postType: null,
                    sourceUrl: null,
                    name: null,
                    description: null,
                    projectId: null,
                    status: null,
                  },
                ],
              }),
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })

    const plan = await planOpenAiSyncResponse(
      [{ role: 'user', content: 'åpne kalenderen' }],
      { now: new Date('2026-07-11T08:00:00Z'), currentPath: '/dashboard' }
    )

    const tools = captured.body?.tools as Array<Record<string, unknown>>
    expect(tools[0]).toMatchObject({ strict: true })
    expect(captured.body?.parallel_tool_calls).toBe(false)
    expect(plan?.actions).toEqual([
      expect.objectContaining({ kind: 'navigate', href: '/calendar' }),
    ])
  })
})
