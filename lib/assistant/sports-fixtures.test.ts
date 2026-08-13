import { describe, expect, it, vi } from 'vitest'
import { planPremierLeagueFixtures } from './sports-fixtures'

const teamsResponse = {
  data: [
    { id: '1', name: 'Manchester United', shortName: 'Man Utd', abbr: 'MUN' },
    { id: '43', name: 'Manchester City', shortName: 'Man City', abbr: 'MCI' },
  ],
}

const matchesResponse = {
  data: [
    {
      matchId: '2645198',
      competitionId: '8',
      competition: 'Premier League',
      season: '2026',
      kickoff: '2026-08-22 12:30:00',
      kickoffTimezoneString: 'Europe/London',
      homeTeam: { id: '88', name: 'Hull City', shortName: 'Hull', abbr: 'HUL' },
      awayTeam: { id: '1', name: 'Manchester United', shortName: 'Man Utd', abbr: 'MUN' },
    },
    {
      matchId: '2645212',
      competitionId: '8',
      competition: 'Premier League',
      season: '2026',
      kickoff: '2026-08-30 16:30:00',
      kickoffTimezoneString: 'Europe/London',
      homeTeam: { id: '1', name: 'Manchester United', shortName: 'Man Utd', abbr: 'MUN' },
      awayTeam: { id: '40', name: 'Ipswich Town', shortName: 'Ipswich', abbr: 'IPS' },
    },
  ],
}

describe('planPremierLeagueFixtures', () => {
  it('builds one confirmed bulk calendar action from official fixture data', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(teamsResponse))
      .mockResolvedValueOnce(Response.json(matchesResponse))

    const plan = await planPremierLeagueFixtures(
      [{ role: 'user', content: 'kan du legge inn alle manchester united sine kamper i premier league sesong 26/27 inn i kalenderen' }],
      { fetcher }
    )

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(plan?.actions).toHaveLength(1)
    expect(plan?.actions[0]).toMatchObject({
      kind: 'create_calendar_events',
      sourceLabel: 'PremierLeague.com',
      events: [
        {
          id: 'pl-2645198',
          title: 'Hull City – Manchester United',
          start: '2026-08-22T11:30:00.000Z',
        },
        {
          id: 'pl-2645212',
          title: 'Manchester United – Ipswich Town',
          start: '2026-08-30T15:30:00.000Z',
        },
      ],
    })
  })

  it('understands the natural Manchester United request without requiring the league name', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(teamsResponse))
      .mockResolvedValueOnce(Response.json(matchesResponse))

    const plan = await planPremierLeagueFixtures(
      [{ role: 'user', content: 'jeg vil ha alle Manchester United-kampene inn i kalenderen' }],
      { fetcher, now: new Date('2026-08-13T10:00:00Z') }
    )

    expect(plan?.actions[0]).toMatchObject({ kind: 'create_calendar_events' })
  })

  it('understands the exact short import request without the word calendar', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(teamsResponse))
      .mockResolvedValueOnce(Response.json(matchesResponse))

    const plan = await planPremierLeagueFixtures(
      [{ role: 'user', content: 'kan du legge inn alle manchester united kampene' }],
      { fetcher, now: new Date('2026-08-13T10:00:00Z') }
    )

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(plan?.actions[0]).toMatchObject({ kind: 'create_calendar_events' })
  })

  it('understands a common Manchester United typo', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(teamsResponse))
      .mockResolvedValueOnce(Response.json(matchesResponse))

    const plan = await planPremierLeagueFixtures(
      [{ role: 'user', content: 'legg inn alle manchester untied sine kamper i kalenderen' }],
      { fetcher, now: new Date('2026-08-13T10:00:00Z') }
    )

    expect(plan?.actions[0]).toMatchObject({ kind: 'create_calendar_events' })
  })

  it('returns null without calling the provider for unrelated requests', async () => {
    const fetcher = vi.fn<typeof fetch>()

    const plan = await planPremierLeagueFixtures(
      [{ role: 'user', content: 'åpne kalenderen' }],
      { fetcher }
    )

    expect(plan).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('creates no actions when the official provider is unavailable', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('Unavailable', { status: 503 }))

    const plan = await planPremierLeagueFixtures(
      [{ role: 'user', content: 'legg inn alle Manchester United-kamper i Premier League 26/27 i kalenderen' }],
      { fetcher }
    )

    expect(plan?.actions).toEqual([])
    expect(plan?.reply).toContain('Ingen kalenderhendelser ble opprettet')
  })
})
