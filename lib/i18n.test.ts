import { describe, expect, it } from 'vitest'
import { translateText } from './i18n'

const repositoryUi = [
  ['No description.', 'Ingen beskrivelse.'],
  ['More', 'Mer'],
  ['Open in VS Code', 'Åpne i VS Code'],
  ['Copy clone URL', 'Kopier klonings-URL'],
  ['Clone URL copied', 'Klonings-URL kopiert'],
  ['Deploy to', 'Publiser til'],
  ['Updated', 'Oppdatert'],
  ['What this repo does', 'Dette gjør repoet'],
  ['AI summary', 'AI-oppsummering'],
  ['Explain', 'Forklar'],
  ['No README yet', 'Ingen README ennå'],
  ['All repositories', 'Alle repoer'],
  ['Repository not found', 'Fant ikke repoet'],
  ['Failed to load repository', 'Kunne ikke laste repoet'],
  ['Link copied', 'Lenke kopiert'],
  ['Share with synced users', 'Del med synkede brukere'],
  ['No synced users yet', 'Ingen synkede brukere ennå'],
] as const

const projectUi = [
  ['Preview', 'Forhåndsvis'],
  ['View as tree', 'Vis som tre'],
  ['Search folders and content', 'Søk i mapper og innhold'],
  ['Reset view', 'Tilbakestill visning'],
  ['Open entire tree', 'Åpne hele treet'],
  ['Close entire tree', 'Lukk hele treet'],
  ['Document type', 'Dokumenttype'],
  ['Upload', 'Last opp'],
  ['Document or Excel', 'Dokument eller Excel'],
] as const

describe('UI translations', () => {
  it.each([...repositoryUi, ...projectUi])('translates %s to Norwegian and back', (english, norwegian) => {
    expect(translateText(english, 'no')).toBe(norwegian)
    expect(translateText(norwegian, 'en')).toBe(english)
  })

  it('translates dynamic relative times in both directions', () => {
    expect(translateText('4d ago', 'no')).toBe('4 d siden')
    expect(translateText('4 d siden', 'en')).toBe('4d ago')
  })
})
