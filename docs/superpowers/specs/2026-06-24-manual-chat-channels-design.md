# Design: Manuelle chat-kanaler

**Dato:** 2026-06-24
**Status:** Godkjent — klar for implementeringsplan

## Mål

I dag autogenereres chat-kanalene: hver prosjektmappe (og 3 demo-prosjekter) blir
automatisk en kanal. Resultatet er at lista fylles med «masse chatter» brukeren ikke
har bedt om.

Målet er å snu dette: **kanaler lages manuelt av brukeren**. En kanal blir et
frittstående chat-rom, helt frakoblet prosjektmapper og demo-data. Chatten starter
**tom** til brukeren selv oppretter kanaler.

Endringen skal **gjenbruke eksisterende meldingslagring** (localStorage-basert lokal
meldingssti), ikke bygge et nytt meldingssystem.

## Bakgrunn: dagens system

All relevant logikk ligger i [`app/(app)/chat/page.tsx`](../../../app/(app)/chat/page.tsx).

- **Kanallista** rendres fra `projects`-staten ([linje ~880](../../../app/(app)/chat/page.tsx)).
- `projects` fylles i `load()`-useEffect fra:
  - `mockProjects` (3 demo-prosjekter, kun når Supabase ikke er konfigurert),
  - `readProjectFolderChannels()` — leser prosjektmapper fra localStorage-nøkkelen
    `sync-project-folders-v1` og mapper hver mappe til et `Project`,
  - `/api/projects` (når Supabase er konfigurert).
- **Lokal melding-sti finnes allerede:** ider med prefiks `LOCAL_PROJECT_PREFIX`
  (`project-folder:`) regnes som «lokale» via `isLocalProjectId()`. For slike:
  - `fetchProjectMessages` → `readLocalProjectMessages(id)` (localStorage-nøkkel
    `sync-project-folder-chat:<id>`),
  - tekst-send (`sendMessage`) og bilde-send (`sendImageMessage`) skriver via
    `writeLocalProjectMessages(id, ...)`,
  - realtime-subscription hoppes over (`return` ved lokal id).
- **DM-delen** («Direct») fylles separat fra folk/connections og endres **ikke**.
- Chat-siden bruker **ikke** i18n (`t()`); UI-strenger er hardkodet engelsk
  («Channels», «Direct», «No channels yet»). Nye strenger holdes engelske for
  konsistens.
- **Stack:** Next.js 16.2.4, React 19.2.4, Tailwind 4, `lucide-react`, `cn()` i
  `lib/utils`, modal-mønster i `components/ui/Modal.tsx`. Tester: vitest.

## Valgt løsning (bekreftet med bruker)

1. **Kun manuelt** — chatten starter tom, kanaler lages via en `+`-knapp.
2. **Start helt tomt** — fjern alle auto-kanaler (både mappe-avledede og demo).
   Ingen engangsimport.

## Datamodell

- Ny localStorage-nøkkel: `sync-chat-channels-v1`.
- Lagrer en liste med lette kanal-objekter: `{ id: string; name: string; createdAt: string }[]`.
- **Kanal-id** får eget prefiks `chat-channel:<uuid>` (egen konstant
  `CHAT_CHANNEL_PREFIX`), generert med `crypto.randomUUID()`.
- Kanaler mappes til `Project`-formen (samme som mappene gjør i dag) når de legges i
  `projects`-staten, slik at sidefelt og `active`-tilstand fungerer uendret.

## Meldingssti (gjenbruk)

- `isLocalProjectId()` utvides til å returnere `true` også for `CHAT_CHANNEL_PREFIX`,
  slik at all eksisterende lokal melding-logikk (fetch, tekst-send, bilde-send, hopp
  over realtime) virker for kanaler **uten** ny send-/lese-kode.
- Meldinger lagres per kanal i `sync-project-folder-chat:<channelId>` via eksisterende
  `read/writeLocalProjectMessages`. (Nøkkelnavnet beholdes for å unngå unødig churn;
  funksjonen er generisk «lokal melding-lagring».)

## Endringer i `load()`

- Erstatt kilden til `projects` i **begge** grener:
  - Fjern `mockProjects` fra kanallista.
  - Fjern `readProjectFolderChannels()`.
  - Slutt å bruke `/api/projects` til kanaler (fjern fetchen fra `Promise.all`; behold
    `/api/people` og `/api/connections` for DM-delen).
  - Sett `projects = readChatChannels()` (mappet til `Project`). Tom liste = ingen
    kanaler.
- Initial `active`: hvis det finnes kanaler, velg første (eller `PROJECT_CHAT_TARGET_KEY`
  hvis den matcher en kanal); ellers fall tilbake til DM som i dag, eller `null`.

## Nye hjelpere

- `readChatChannels(): Project[]` — leser og mapper fra `sync-chat-channels-v1`;
  tom/korrupt JSON → `[]`.
- `writeChatChannels(channels)` — persisterer rå kanal-objektene.
- `createChatChannel(name): Project` — lager `{ id, name, createdAt }`, prepender til
  lagret liste, returnerer mappet `Project`.
- `deleteChatChannel(id)` — fjerner kanal fra lista og sletter dens
  `sync-project-folder-chat:<id>`-meldinger.

## UI

- **`+`-knapp** ved «CHANNELS»-overskriften ([linje ~864](../../../app/(app)/chat/page.tsx)).
  Klikk → liten modal (`components/ui/Modal.tsx`-mønster) med ett tekstfelt
  («Channel name», påkrevd, trimmes) + «Create»/«Cancel».
- På opprett: `createChatChannel(name)` → prepend til `projects`-staten → `selectProject`
  på den nye kanalen (tom samtale) → lukk modal.
- **Tom tilstand:** erstatt «No channels yet.» med «No channels yet — create one with +».
- **Slett kanal:** liten `×` som vises ved hover på en kanal-rad i sidefeltet, med
  bekreftelse (`window.confirm` eller liten bekreftelsesmodal). Sletter kanal +
  meldinger; hvis den slettede var aktiv, nullstill `active` (eller velg første
  gjenværende kanal).

## Kjente sideeffekter (akseptert)

- «Åpne chat» fra en mappe på Prosjekter-siden
  ([`projects/page.tsx:791`](../../../app/(app)/projects/page.tsx)) skriver en mappe-id til
  `PROJECT_CHAT_TARGET_KEY` som ikke lenger finnes som kanal. Chatten åpner da bare
  generelt (ingen spesifikk kanal). **Beholdes uendret** i denne omgangen.
- Eksisterende mappe-chat-historikk (`sync-project-folder-chat:*`) røres ikke — den
  vises bare ikke lenger i chat.
- Funksjonen `readProjectFolderChannels()` blir ubrukt i chat-siden og fjernes.
  `mockProjects`-importen fjernes hvis den blir ubrukt etter endringen (`mockMessages`
  kan fortsatt være i bruk — sjekkes ved implementering).

## Testing

- **Enhetstester** (vitest) for kanal-hjelperne, helst trukket ut i en liten ren modul
  (f.eks. `chat-channels.ts`) så de kan testes uten React:
  - round-trip `write` → `read`,
  - `read` med tom og korrupt localStorage → `[]`,
  - `createChatChannel` prepender og persisterer,
  - `deleteChatChannel` fjerner kanal og rydder meldinger.
- **Manuell verifisering:** tom start → lag kanal → send tekst + bilde → reload
  (vedvarer) → lag kanal nr. 2 → slett en kanal (meldinger borte) → ingen kanaler
  auto-dukker opp fra mapper.

## Ikke i scope (YAGNI)

- Gi nytt navn til kanal.
- Synkronisering av kanaler til Supabase / på tvers av enheter (rent lokalt nå).
- Endre mappe→chat-deep-linken på Prosjekter-siden.
