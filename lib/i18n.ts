export type Locale = 'en' | 'no'

export const DEFAULT_LOCALE: Locale = 'en'
export const LANGUAGE_STORAGE_KEY = 'sync-language'

type TranslationPair = readonly [en: string, no: string]

const pairs = [
  ['Sync - Co-op made easy', 'Sync - samarbeid gjort enkelt'],
  ['Sync – Co-op made easy', 'Sync - samarbeid gjort enkelt'],
  ['The collaborative workspace for co-op teams.', 'Samarbeidsflaten for team som bygger sammen.'],
  ['Co-op made easy', 'Samarbeid gjort enkelt'],
  ['Settings', 'Innstillinger'],
  ['Dashboard', 'Dashbord'],
  ['Projects', 'Prosjekter'],
  ['Repositories', 'Repoer'],
  ['Calendar', 'Kalender'],
  ['Chat', 'Chat'],
  ['People', 'Folk'],
  ['Ideas', 'Ideer'],
  ['How to Sync', 'Slik bruker du Sync'],
  ['Profile', 'Profil'],
  ['User', 'Bruker'],
  ['Help', 'Hjelp'],
  ['Log out', 'Logg ut'],
  ['Logging out...', 'Logger ut...'],
  ['Edit profile', 'Rediger profil'],
  ['Display name', 'Visningsnavn'],
  ['Email', 'E-post'],
  ['Email address', 'E-postadresse'],
  ['Email or username', 'E-post eller brukernavn'],
  ['Password', 'Passord'],
  ['New password', 'Nytt passord'],
  ['Confirm password', 'Bekreft passord'],
  ['Role / title', 'Rolle / tittel'],
  ['Your name', 'Navnet ditt'],
  ['Your password', 'Passordet ditt'],
  ['e.g. Full-stack developer', 'f.eks. fullstack-utvikler'],
  ['Save', 'Lagre'],
  ['Saved', 'Lagret'],
  ['Save changes', 'Lagre endringer'],
  ['Cancel', 'Avbryt'],
  ['Close', 'Lukk'],
  ['Create', 'Opprett'],
  ['Delete', 'Slett'],
  ['Remove', 'Fjern'],
  ['Search', 'Søk'],
  ['Loading', 'Laster'],
  ['Loading...', 'Laster...'],
  ['Error', 'Feil'],
  ['Retry', 'Prøv igjen'],
  ['Copy', 'Kopier'],
  ['Copied', 'Kopiert'],
  ['Connected', 'Tilkoblet'],
  ['Connect', 'Koble til'],
  ['Disconnect', 'Koble fra'],
  ['Not connected', 'Ikke tilkoblet'],
  ['New repo', 'Nytt repo'],
  ['New post', 'Nytt innlegg'],
  ['New project', 'Nytt prosjekt'],
  ['Invite member', 'Inviter medlem'],
  ['Share repository', 'Del repo'],
  ['Share project folder', 'Del prosjektmappe'],
  ['Create post', 'Opprett innlegg'],
  ['Create project', 'Opprett prosjekt'],
  ['Create event', 'Opprett hendelse'],
  ['Create GitHub Repository', 'Opprett GitHub-repo'],
  ['Create repository', 'Opprett repo'],
  ['Repository name', 'Repo-navn'],
  ['Description', 'Beskrivelse'],
  ['Description (optional)', 'Beskrivelse (valgfritt)'],
  ['Source URL (optional)', 'Kilde-URL (valgfritt)'],
  ['GitHub URL (optional)', 'GitHub-URL (valgfritt)'],
  ['Demo URL (optional)', 'Demo-URL (valgfritt)'],
  ['Visibility', 'Synlighet'],
  ['Public', 'Offentlig'],
  ['Private', 'Privat'],
  ['Private repo', 'Privat repo'],
  ['Type', 'Type'],
  ['Title', 'Tittel'],
  ['Body', 'Innhold'],
  ["What's on your mind?", 'Hva tenker du på?'],
  ['Write something...', 'Skriv noe...'],
  ['Write a comment...', 'Skriv en kommentar...'],
  ['No comments yet.', 'Ingen kommentarer ennå.'],
  ['Post', 'Innlegg'],
  ['Feed', 'Feed'],
  ['Discover', 'Oppdag'],
  ['Trending', 'Trender'],
  ['Today', 'I dag'],
  ['This week', 'Denne uken'],
  ['This month', 'Denne måneden'],
  ['Custom', 'Egendefinert'],
  ['All', 'Alle'],
  ['Repositories', 'Repoer'],
  ['Developers', 'Utviklere'],
  ['Language:', 'Språk:'],
  ['Search repositories', 'Søk i repoer'],
  ['Search developers', 'Søk i utviklere'],
  ['Failed to load GitHub Trending', 'Kunne ikke laste GitHub Trending'],
  ['Failed to load', 'Kunne ikke laste'],
  ['No avatar selected yet.', 'Ingen avatar valgt ennå.'],
  ['Want to build something?', 'Vil du bygge noe?'],
  ["That's what Sync is for.", 'Det er det Sync er til for.'],
  ['Create your first project', 'Opprett ditt første prosjekt'],
  ['Create a new project. Give it a name. Add your repo.', 'Opprett et nytt prosjekt. Gi det et navn. Legg til repoet ditt.'],
  ['Open it in your favorite AI coder.', 'Åpne det i favorittverktøyet ditt for AI-koding.'],
  ['Build together', 'Bygg sammen'],
  ['Invite your friends. Sync with them. Share your project.', 'Inviter venner. Sync med dem. Del prosjektet ditt.'],
  ['Start', 'Start'],
  ['Start ->', 'Start ->'],
  ['Next', 'Neste'],
  ['Start syncing', 'Start syncing'],
  ['Starting...', 'Starter...'],
  ['Create. Connect. Invite. Build.', 'Opprett. Koble til. Inviter. Bygg.'],
  ['Go to slide', 'Gå til slide'],
  ['Reset your password', 'Tilbakestill passordet ditt'],
  ['Send reset link', 'Send tilbakestillingslenke'],
  ['Sending...', 'Sender...'],
  ['Back to login', 'Tilbake til innlogging'],
  ['Link expired or invalid', 'Lenken er utløpt eller ugyldig'],
  ['Set new password', 'Sett nytt passord'],
  ['Update password', 'Oppdater passord'],
  ['Updating...', 'Oppdaterer...'],
  ['Password updated', 'Passordet er oppdatert'],
  ['Hide password', 'Skjul passord'],
  ['Show password', 'Vis passord'],
  ['Sign up', 'Registrer deg'],
  ['Log in', 'Logg inn'],
  ['Signing in...', 'Logger inn...'],
  ['Redirecting...', 'Videresender...'],
  ['Continue with GitHub', 'Fortsett med GitHub'],
  ['Create your account with GitHub - it only takes a moment.', 'Opprett konto med GitHub - det tar bare et øyeblikk.'],
  ['GitHub login failed. Please try again.', 'GitHub-innlogging feilet. Prøv igjen.'],
  ['GitHub signup failed. Please try again.', 'GitHub-registrering feilet. Prøv igjen.'],
  ['An error occurred. Please try again.', 'Det oppsto en feil. Prøv igjen.'],
  ['Something went wrong. Please try again.', 'Noe gikk galt. Prøv igjen.'],
  ['Verifying reset link...', 'Sjekker tilbakestillingslenke...'],
  ['Tools I use', 'Verktøy jeg bruker'],
  ['These show on your profile and help teammates find collaborators.', 'Disse vises på profilen din og hjelper teammedlemmer å finne samarbeidspartnere.'],
  ['Connected accounts', 'Tilkoblede kontoer'],
  ['Manage third-party integrations. Tokens are stored server-side only.', 'Administrer tredjepartsintegrasjoner. Tokens lagres kun på serveren.'],
  ['GitHub Repositories', 'GitHub-repoer'],
  ['Not connected - required for repository access', 'Ikke tilkoblet - kreves for repo-tilgang'],
  ['GitHub connected successfully!', 'GitHub er koblet til.'],
  ['GitHub authorization was cancelled.', 'GitHub-godkjenningen ble avbrutt.'],
  ['GitHub returned an unexpected response.', 'GitHub returnerte et uventet svar.'],
  ['OAuth state mismatch - please try again.', 'OAuth-state stemmer ikke - prøv igjen.'],
  ['GitHub OAuth is not configured on this server.', 'GitHub OAuth er ikke konfigurert på denne serveren.'],
  ['Failed to exchange GitHub authorization code for a token.', 'Kunne ikke bytte GitHub-godkjenningskode mot token.'],
  ['Token was received but could not be saved. Check Supabase table and RLS policies.', 'Token ble mottatt, men kunne ikke lagres. Sjekk Supabase-tabell og RLS-regler.'],
  ['GitHub connection failed. Please try again.', 'GitHub-tilkobling feilet. Prøv igjen.'],
  ['Could not save profile changes.', 'Kunne ikke lagre profilendringer.'],
  ['Upload image', 'Last opp bilde'],
  ['Drag and drop an image onto the avatar.', 'Dra og slipp et bilde på avataren.'],
  ['or drag and drop an image here', 'eller dra og slipp et bilde her'],
  ['Sync with others', 'Sync med andre'],
  ['Invite someone by email - they will get a link to join Sync.', 'Inviter noen med e-post - de får en lenke for å bli med i Sync.'],
  ['Invite link', 'Invitasjonslenke'],
  ['or share a link', 'eller del en lenke'],
  ['Invite sent to', 'Invitasjon sendt til'],
  ['Search synced people...', 'Søk i synkede personer...'],
  ['Sync with people from the People page to share repositories with them.', 'Sync med folk fra Folk-siden for å dele repoer med dem.'],
  ['Send', 'Send'],
  ['Sent', 'Sendt'],
  ['Failed to send', 'Kunne ikke sende'],
  ['Failed to load people', 'Kunne ikke laste folk'],
  ['Failed to load synced users.', 'Kunne ikke laste synkede brukere.'],
  ['How to use Sync', 'Slik bruker du Sync'],
  ['Create or join a project', 'Opprett eller bli med i et prosjekt'],
  ['Add tasks, links and members', 'Legg til oppgaver, lenker og medlemmer'],
  ['Use the feed to stay updated', 'Bruk feeden for å holde deg oppdatert'],
  ['Use chat to coordinate', 'Bruk chat for å koordinere'],
  ['Sync gives you one place for your projects, code, and people.', 'Sync gir deg ett sted for prosjekter, kode og folk.'],
  ['Create a project', 'Opprett et prosjekt'],
  ['Give it a name, connect a repo, and keep everything organized.', 'Gi det et navn, koble til et repo og hold alt organisert.'],
  ['Open it where you build', 'Åpne det der du bygger'],
  ['Use GitHub, VS Code, Cursor, Codex, or your favorite AI coding tool.', 'Bruk GitHub, VS Code, Cursor, Codex eller favorittverktøyet ditt for AI-koding.'],
  ['Sync with your team', 'Sync med teamet ditt'],
  ['Invite friends, share projects, and work together in one place.', 'Inviter venner, del prosjekter og jobb sammen på ett sted.'],
  ['Project', 'Prosjekt'],
  ['Project not found', 'Prosjekt ikke funnet'],
  ['This project does not exist.', 'Dette prosjektet finnes ikke.'],
  ['Request to join', 'Be om å bli med'],
  ['Requested', 'Forespurt'],
  ['No members yet', 'Ingen medlemmer ennå'],
  ['Member', 'Medlem'],
  ['Links', 'Lenker'],
  ['Stats', 'Statistikk'],
  ['Tasks', 'Oppgaver'],
  ['Done', 'Ferdig'],
  ['Members', 'Medlemmer'],
  ['Messages', 'Meldinger'],
  ['Send a message...', 'Send en melding...'],
  ['Add task', 'Legg til oppgave'],
  ['Task title', 'Oppgavetittel'],
  ['Status', 'Status'],
  ['Type and press Enter to add...', 'Skriv og trykk Enter for å legge til...'],
  ['Created', 'Opprettet'],
  ['Connected', 'Tilkoblet'],
  ['Open repo', 'Åpne repo'],
  ['Create project folder', 'Lag prosjektmappe'],
  ['Search project folders', 'Søk i prosjektmapper'],
  ['Show subfolders', 'Vis undermapper'],
  ['Folder options', 'Mappevalg'],
  ['Change task status', 'Bytt oppgavestatus'],
  ['Remove content', 'Fjern innhold'],
  ['Change project logo', 'Endre prosjektlogo'],
  ['Choose logo', 'Velg logo'],
  ['Delete content', 'Slett innhold'],
  ['Delete folder', 'Slett mappe'],
  ['Rename folder', 'Endre mappenavn'],
  ['New project folder', 'Ny prosjektmappe'],
  ['Share project folder', 'Del prosjektmappe'],
  ['Name', 'Navn'],
  ['Folder name', 'Mappenavn'],
  ['e.g. Website, app, client project', 'F.eks. Nettside, app, kundeprosjekt'],
  ['What should be collected in this folder?', 'Hva skal samles i denne mappen?'],
  ['Search for a friend...', 'Søk etter venn...'],
  ['Add Resource', 'Legg til ressurs'],
  ['Add folder', 'Legg til mappe'],
  ['Search your repositories', 'Søk i repoene dine'],
  ['my-new-project', 'mitt-nye-prosjekt'],
  ['Link name', 'Navn på lenken'],
  ['File name', 'Navn på filen'],
  ['Link', 'Lenke'],
  ['Folder path', 'Mappe-sti'],
  ['e.g. Frontend, Design, Assets', 'F.eks. Frontend, Design, Assets'],
  ['Create folder', 'Opprett mappe'],
  ['Delete folder', 'Slett mappe'],
  ['Rename folder', 'Endre mappenavn'],
  ['Delete content', 'Slett innhold'],
  ['Are you sure you want to delete', 'Er du sikker på at du vil slette'],
  ['This removes the item from the project folder.', 'Dette fjerner elementet fra prosjektmappen.'],
  ['Calendar pulse', 'Kalenderpuls'],
  ['Calendar sources', 'Kalenderkilder'],
  ['Connector-ready targets for sync.', 'Tilkoblingsklare mål for sync.'],
  ['Ready', 'Klar'],
  ['Upcoming', 'Kommende'],
  ['Filtered by the current search.', 'Filtrert etter gjeldende søk.'],
  ['Focus', 'Fokus'],
  ['Meetings', 'Møter'],
  ['Meeting', 'Møte'],
  ['Launch', 'Lansering'],
  ['Deadline', 'Frist'],
  ['Search events...', 'Søk i hendelser...'],
  ['Event title', 'Hendelsestittel'],
  ['Start', 'Start'],
  ['End', 'Slutt'],
  ['Save event', 'Lagre hendelse'],
  ['Create event at', 'Opprett hendelse kl.'],
  ['Search or write a new idea...', 'Søk eller skriv en ny idé...'],
  ['Previous month', 'Forrige måned'],
  ['Next month', 'Neste måned'],
  ['Remove image', 'Fjern bilde'],
  ['Preview image', 'Forhåndsvis bilde'],
  ['Sync request', 'Sync-forespørsel'],
  ['Accept sync before sending images', 'Godta sync før du sender bilder'],
  ['Share rejected', 'Deling avvist'],
  ['Sync accepted', 'Sync godtatt'],
  ['Sync rejected', 'Sync avvist'],
  ['Accepted', 'Godtatt'],
  ['Rejected', 'Avvist'],
  ['Open image', 'Åpne bilde'],
  ['Shared project folder', 'Delt prosjektmappe'],
  ['Repository', 'Repo'],
  ['Remove bookmark', 'Fjern bokmerke'],
  ['Save article', 'Lagre artikkel'],
  ['Save', 'Lagre'],
  ['Summarize', 'Oppsummer'],
  ['Read:', 'Les:'],
  ['Home', 'Hjem'],
  ['Shared with me', 'Delt med meg'],
  ['Add subfolder', 'Legg til undermappe'],
  ['New folder', 'Ny mappe'],
  ['Search folders and repositories...', 'Søk i mapper og repoer...'],
  ['Search repositories...', 'Søk i repoer...'],
  ['Open on GitHub', 'Åpne på GitHub'],
  ['More actions', 'Flere handlinger'],
  ['Fork', 'Fork'],
  ['Archived', 'Arkivert'],
  ['Connect your GitHub account', 'Koble til GitHub-kontoen din'],
  ['GitHub token expired', 'GitHub-token er utløpt'],
  ['Reconnect GitHub', 'Koble til GitHub på nytt'],
  ['Connect GitHub', 'Koble til GitHub'],
  ['Your GitHub token has expired or been revoked. Please reconnect.', 'GitHub-tokenet ditt er utløpt eller trukket tilbake. Koble til på nytt.'],
  ['Link your GitHub to view and manage your repositories directly from Sync. Your token is stored securely server-side.', 'Koble til GitHub for å se og administrere repoene dine direkte fra Sync. Tokenet ditt lagres sikkert på serveren.'],
  ['Repositories synced users have shared with you.', 'Repoer synkede brukere har delt med deg.'],
  ['Wants to Sync with you', 'Vil synce med deg'],
  ['Synced', 'Synket'],
  ['Sync', 'Sync'],
  ['Sync request cancelled', 'Sync-forespørsel avbrutt'],
  ['Sync request sent', 'Sync-forespørsel sendt'],
  ['Sync removed', 'Sync fjernet'],
  ['Could not update Sync.', 'Kunne ikke oppdatere Sync.'],
  ['Could not accept Sync.', 'Kunne ikke godta Sync.'],
  ['Could not reject request.', 'Kunne ikke avvise forespørsel.'],
  ['Could not update follow.', 'Kunne ikke oppdatere følging.'],
  ['Something went wrong loading people.', 'Noe gikk galt under lasting av folk.'],
  ['Codex requests', 'Codex-forespørsler'],
  ['Tokens', 'Tokens'],
  ['Last active', 'Sist aktiv'],
  ['Most used model', 'Mest brukte modell'],
  ['From OpenAI Usage API', 'Fra OpenAI Usage API'],
  ['Open Claude', 'Åpne Claude'],
  ['Open ChatGPT', 'Åpne ChatGPT'],
  ['Toggle theme', 'Bytt tema'],
  ['Norsk/Engelsk', 'Norsk/Engelsk'],
  ['English', 'Engelsk'],
  ['Norwegian', 'Norsk'],
  ['Language', 'Språk'],
  ['Choose the language used across Sync on this device.', 'Velg språket som brukes i Sync på denne enheten.'],
  ['Current language', 'Gjeldende språk'],
] as const satisfies readonly TranslationPair[]

const normalizers: Array<[RegExp, (match: RegExpMatchArray, locale: Locale) => string]> = [
  [
    /^Go to slide (\d+)$/,
    (match, locale) => (locale === 'no' ? `Gå til slide ${match[1]}` : `Go to slide ${match[1]}`),
  ],
  [
    /^Create event at ([\d:]+)$/,
    (match, locale) =>
      locale === 'no' ? `Opprett hendelse kl. ${match[1]}` : `Create event at ${match[1]}`,
  ],
  [
    /^Mappevalg for (.+)$/,
    (match, locale) => (locale === 'no' ? `Mappevalg for ${match[1]}` : `Folder options for ${match[1]}`),
  ],
  [
    /^Folder options for (.+)$/,
    (match, locale) => (locale === 'no' ? `Mappevalg for ${match[1]}` : `Folder options for ${match[1]}`),
  ],
  [
    /^Vis mapper i (.+)$/,
    (match, locale) => (locale === 'no' ? `Vis mapper i ${match[1]}` : `Show folders in ${match[1]}`),
  ],
  [
    /^Show folders in (.+)$/,
    (match, locale) => (locale === 'no' ? `Vis mapper i ${match[1]}` : `Show folders in ${match[1]}`),
  ],
  [
    /^(\d+) medlemmer$/,
    (match, locale) => (locale === 'no' ? `${match[1]} medlemmer` : `${match[1]} members`),
  ],
  [
    /^(\d+) members$/,
    (match, locale) => (locale === 'no' ? `${match[1]} medlemmer` : `${match[1]} members`),
  ],
  [
    /^Dette sletter elementet og (\d+) underliggende elementer\.$/,
    (match, locale) =>
      locale === 'no'
        ? `Dette sletter elementet og ${match[1]} underliggende elementer.`
        : `This deletes the item and ${match[1]} nested items.`,
  ],
  [
    /^This deletes the item and (\d+) nested items\.$/,
    (match, locale) =>
      locale === 'no'
        ? `Dette sletter elementet og ${match[1]} underliggende elementer.`
        : `This deletes the item and ${match[1]} nested items.`,
  ],
  [
    /^Er du sikker på at du vil slette "(.+)"\?$/,
    (match, locale) =>
      locale === 'no'
        ? `Er du sikker på at du vil slette "${match[1]}"?`
        : `Are you sure you want to delete "${match[1]}"?`,
  ],
  [
    /^Are you sure you want to delete "(.+)"\?$/,
    (match, locale) =>
      locale === 'no'
        ? `Er du sikker på at du vil slette "${match[1]}"?`
        : `Are you sure you want to delete "${match[1]}"?`,
  ],
  [
    /^(.+) added to your workspace$/,
    (match, locale) =>
      locale === 'no' ? `${match[1]} lagt til i arbeidsområdet ditt` : `${match[1]} added to your workspace`,
  ],
]

const enToNo = new Map<string, string>()
const noToEn = new Map<string, string>()
const aliasesToEnglish = new Map<string, string>([
  ['Add mappe', 'Add folder'],
  ['Legg til mappe', 'Add folder'],
])
const aliasesToNorwegian = new Map<string, string>([
  ['Add mappe', 'Legg til mappe'],
])

for (const [en, no] of pairs) {
  enToNo.set(en, no)
  noToEn.set(no, en)
}

function restoreWhitespace(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] ?? ''
  const trailing = original.match(/\s*$/)?.[0] ?? ''
  return `${leading}${translated}${trailing}`
}

function normalizePunctuation(value: string) {
  return value.replaceAll('—', '-').replaceAll('…', '...')
}

export function coerceLocale(value: string | null | undefined): Locale {
  return value === 'no' ? 'no' : 'en'
}

export function translateText(value: string, locale: Locale): string {
  const trimmed = value.trim()
  if (!trimmed) return value

  const direct = locale === 'no' ? enToNo.get(trimmed) : noToEn.get(trimmed)
  if (direct) return restoreWhitespace(value, direct)

  const alias = locale === 'no' ? aliasesToNorwegian.get(trimmed) : aliasesToEnglish.get(trimmed)
  if (alias) return restoreWhitespace(value, alias)

  const normalized = normalizePunctuation(trimmed)
  const normalizedDirect = locale === 'no' ? enToNo.get(normalized) : noToEn.get(normalized)
  if (normalizedDirect) return restoreWhitespace(value, normalizedDirect)

  for (const [pattern, render] of normalizers) {
    const match = trimmed.match(pattern)
    if (match) return restoreWhitespace(value, render(match, locale))
  }

  return value
}

export function translateAttribute(value: string | null, locale: Locale) {
  if (value == null) return value
  return translateText(value, locale)
}

export function t(locale: Locale, text: string, params?: Record<string, string | number>) {
  let translated = translateText(text, locale)
  if (!params) return translated

  for (const [key, value] of Object.entries(params)) {
    translated = translated.replaceAll(`{${key}}`, String(value))
  }

  return translated
}

export function languageLabel(locale: Locale) {
  return locale === 'no' ? 'Norsk' : 'English'
}
