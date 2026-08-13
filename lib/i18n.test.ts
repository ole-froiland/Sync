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
  [
    'Set your local projects folder once to open the right repository in either app.',
    'Velg den lokale prosjektmappen én gang for å åpne riktig repo i begge appene.',
  ],
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

const learningUi = [
  ['Learn', 'Lære'],
  ['Other courses', 'Andre kurs'],
  ['Welcome to Sync', 'Velkommen til Sync'],
  ['Create focused projects', 'Lag fokuserte prosjekter'],
  ['Connect where you already build', 'Koble til der du allerede bygger'],
  ['Your team', 'Teamet ditt'],
] as const

const peopleUi = [
  ['Active now', 'Aktiv nå'],
  ['Last active', 'Sist aktiv'],
  ['No recent activity', 'Ingen nylig aktivitet'],
  ['Overview', 'Oversikt'],
  ['Shared projects', 'Delte prosjekter'],
  ['Member since', 'Medlem siden'],
] as const

describe('UI translations', () => {
  it.each([...repositoryUi, ...projectUi, ...learningUi, ...peopleUi])('translates %s to Norwegian and back', (english, norwegian) => {
    expect(translateText(english, 'no')).toBe(norwegian)
    expect(translateText(norwegian, 'en')).toBe(english)
  })

  it('translates dynamic relative times in both directions', () => {
    expect(translateText('4d ago', 'no')).toBe('4 d siden')
    expect(translateText('4 d siden', 'en')).toBe('4d ago')
  })
})
