import { describe, expect, it } from 'vitest'
import { buildRepoSummary } from './route'

describe('buildRepoSummary', () => {
  it('returns Norwegian fallback copy for the Norwegian interface', () => {
    expect(buildRepoSummary({ full_name: 'ole/sync', locale: 'no' })).toBe(
      'ole/sync har ingen beskrivelse eller README ennå, så det er ikke mulig å forstå hva repoet gjør uten mer kontekst.'
    )
  })

  it('keeps English fallback copy for the English interface', () => {
    expect(buildRepoSummary({ full_name: 'ole/sync', locale: 'en' })).toBe(
      "ole/sync has no description or README yet, so it isn't possible to infer what it does without more context."
    )
  })
})
