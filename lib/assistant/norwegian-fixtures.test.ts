import { describe, expect, it, vi } from 'vitest'
import { planNorwegianFootballFixtures } from './norwegian-fixtures'

const nffHtml = `
  <div id="NextMatchesContainer" class="matchesContainer">
    <a href="/fotballdata/kamp/?fiksId=8986268"><div class="a_matchCard">
      <span class="headingElement">l&#xF8;rdag 15.08.26</span>
      <div class="time">16:00</div>
      <div class="teamName">KFUM</div><div class="teamName">Lillestr&#xF8;m</div>
      <span class="footerElement">KFUM-Arena</span>
    </div></a>
    <a href="/fotballdata/kamp/?fiksId=9177349"><div class="a_matchCard">
      <span class="headingElement">l&#xF8;rdag 22.08.26</span>
      <div class="time">16:00</div>
      <div class="teamName">Ready</div><div class="teamName">KFUM</div>
      <span class="footerElement">Gressbanen kunstgress</span>
    </div></a>
  </div>
  <div id="PrevMatchesContainer"></div>`

describe('Norwegian football fixtures', () => {
  it('gets KFUM fixtures from the official NFF team page', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(nffHtml, { status: 200 }))
    const plan = await planNorwegianFootballFixtures(
      [{ role: 'user', content: 'legg inn alle kampene til kfum' }],
      { fetcher, now: new Date('2026-08-13T12:00:00+02:00') }
    )

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(plan?.actions[0]).toMatchObject({
      kind: 'create_calendar_events',
      sourceLabel: 'Norges Fotballforbund',
      events: [
        { id: 'nff-8986268', title: 'KFUM – Lillestrøm', start: '2026-08-15T16:00:00' },
        { id: 'nff-9177349', title: 'Ready – KFUM', start: '2026-08-22T16:00:00' },
      ],
    })
  })

  it('returns null for unrelated requests', async () => {
    const fetcher = vi.fn<typeof fetch>()
    expect(await planNorwegianFootballFixtures(
      [{ role: 'user', content: 'legg inn en tur til Oslo' }],
      { fetcher }
    )).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
})
