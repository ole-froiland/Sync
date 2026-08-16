import { describe, expect, it } from 'vitest'
import { buildActionEnvelopes } from './envelope'

describe('assistant action envelopes', () => {
  it('requires one browser confirmation for a bulk calendar write', () => {
    const envelopes = buildActionEnvelopes('user-1', [
      {
        kind: 'create_calendar_events',
        sourceLabel: 'PremierLeague.com',
        sourceUrl: 'https://www.premierleague.com/en/clubs/1/fixtures',
        events: [
          {
            id: 'pl-1',
            title: 'Hull City – Manchester United',
            start: '2026-08-22T11:30:00.000Z',
            end: '2026-08-22T13:30:00.000Z',
            eventKind: 'meeting',
          },
        ],
      },
    ])

    expect(envelopes).toHaveLength(1)
    expect(envelopes[0]).toMatchObject({
      risk: 'write',
      requiresConfirmation: true,
      confirmationToken: undefined,
      action: { kind: 'create_calendar_events' },
    })
  })

  it('keeps project tree navigation safe and automatic', () => {
    const envelopes = buildActionEnvelopes('user-1', [{ kind: 'open_projects_tree' }])

    expect(envelopes[0]).toMatchObject({
      risk: 'navigation',
      requiresConfirmation: false,
      confirmationToken: undefined,
      action: { kind: 'open_projects_tree' },
    })
  })

  it('requires confirmation before deleting calendar events', () => {
    const envelopes = buildActionEnvelopes('user-1', [{
      kind: 'delete_calendar_events',
      events: [{ id: 'cal-ai-training', title: 'Trening', start: '2027-01-05T18:00:00', end: '2027-01-05T20:00:00' }],
    }])

    expect(envelopes[0]).toMatchObject({
      risk: 'write',
      requiresConfirmation: true,
      confirmationToken: undefined,
      action: { kind: 'delete_calendar_events' },
    })
  })
})
