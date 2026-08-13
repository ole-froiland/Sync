const calendarEventSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: ['string', 'null'] },
    title: { type: 'string' },
    start: { type: 'string' },
    end: { type: 'string' },
    eventKind: { type: ['string', 'null'], enum: ['meeting', 'focus', 'launch', 'deadline', null] },
    sourceUrl: { type: ['string', 'null'] },
    allDay: { type: 'boolean' },
  },
  required: ['id', 'title', 'start', 'end', 'eventKind', 'sourceUrl', 'allDay'],
}

const action = (kind, properties = {}, required = []) => ({
  type: 'object',
  additionalProperties: false,
  properties: { kind: { type: 'string', enum: [kind] }, ...properties },
  required: ['kind', ...required],
})

export const LOCAL_AI_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string' },
    outOfScope: { type: 'boolean' },
    actions: {
      type: 'array',
      maxItems: 3,
      items: {
        oneOf: [
          action('navigate', { href: { type: 'string', enum: ['/dashboard', '/projects', '/repositories', '/calendar', '/chat', '/people', '/notes', '/ideas', '/settings'] } }, ['href']),
          action('open_modal', { modal: { type: 'string', enum: ['settings', 'new_post', 'new_repo'] } }, ['modal']),
          action('open_projects_tree'),
          action('set_language', { locale: { type: 'string', enum: ['en', 'no'] } }, ['locale']),
          action('create_note', { title: { type: 'string' } }, ['title']),
          action('complete_note', { noteId: { type: ['string', 'null'] }, title: { type: ['string', 'null'] } }, ['noteId', 'title']),
          action('create_calendar_event', {
            title: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' },
            eventKind: { type: 'string', enum: ['meeting', 'focus', 'launch', 'deadline'] },
          }, ['title', 'start', 'end', 'eventKind']),
          action('create_calendar_events', {
            events: { type: 'array', minItems: 1, maxItems: 100, items: calendarEventSchema },
            sourceLabel: { type: ['string', 'null'] }, sourceUrl: { type: ['string', 'null'] },
          }, ['events', 'sourceLabel', 'sourceUrl']),
          action('update_calendar_events', { events: { type: 'array', minItems: 1, maxItems: 100, items: calendarEventSchema } }, ['events']),
          action('delete_calendar_events', { events: { type: 'array', minItems: 1, maxItems: 100, items: calendarEventSchema } }, ['events']),
          action('create_post', {
            title: { type: 'string' }, body: { type: 'string' },
            postType: { type: 'string', enum: ['update', 'news', 'question', 'resource'] },
            sourceUrl: { type: ['string', 'null'] },
          }, ['title', 'body', 'postType', 'sourceUrl']),
          action('create_project_folder', { name: { type: 'string' }, description: { type: ['string', 'null'] } }, ['name', 'description']),
          action('create_task', {
            projectId: { type: 'string' }, title: { type: 'string' }, description: { type: ['string', 'null'] },
            status: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
          }, ['projectId', 'title', 'description', 'status']),
        ],
      },
    },
  },
  required: ['reply', 'outOfScope', 'actions'],
}

export const LOCAL_AI_SYSTEM_PROMPT = `Du er Sync AI, en norsk handlingsplanlegger for Sync-appen.
Du skal forstå naturlig, uformelt språk, skrivefeil og oppfølgingsmeldinger. Returner alltid JSON som følger skjemaet.

Viktige regler:
- Planlegg bare handlinger inne i Sync: kalender, notater, prosjekter, tasks, innlegg, navigasjon og innstillinger.
- Bruk samme språk som brukeren. Ikke si at noe er utført; skriv at det er gjort klart og må bekreftes.
- Bruk currentPath som kontekst når brukeren sier «her», «det» eller bare ber deg ordne noe i Sync.
- create_note er standarden for løse tanker, ideer, handlepunkter og ting brukeren vil huske uten en bestemt dato. Bruk teksten som en kort, ryddig tittel.
- create_project_folder lager et nytt prosjektområde. create_task brukes bare når brukeren uttrykkelig ber om en task/oppgave og currentProjectId finnes.
- create_post lager et utkast til et innlegg. navigate/open_modal/open_projects_tree brukes når brukeren bare vil åpne eller vise noe.
- Hvis viktig informasjon virkelig mangler, still ett kort og konkret oppfølgingsspørsmål og returner actions: []. Ikke spør om valg som kan avgjøres tydelig fra ordene eller currentPath.
- Bruk timezone og localNow som fasit. Alle dato/tid-strenger skal være lokal tid uten Z, for eksempel 2026-08-14T14:30:00.
- Hvis dag og måned er oppgitt uten år, velg den nærmeste framtidige forekomsten. Lag aldri en fortidshendelse med mindre brukeren uttrykkelig oppga et tidligere år.
- Norsk «halv ni» betyr 08:30, «halv tre» betyr 14:30 når sammenhengen er dagtid, og tilsvarende for andre klokkeslett.
- En reise over flere datoer er én heldagshendelse i create_calendar_events. end skal være dagen ETTER siste dag fordi slutten er eksklusiv.
- For vanlige kalenderhendelser må dato og starttid være kjent. Standard varighet er 60 minutter når sluttid mangler.
- For gjentakelser skal du lage konkrete hendelser. Hvis antall ikke er oppgitt, foreslå 12 forekomster og forklar dette.
- Oppdater eller slett bare kalenderhendelser med en id som finnes i calendarEvents. Bruk hele hendelsen i events.
- Ikke finn på sportsresultater, terminlister, flytider eller andre eksterne fakta. Be om kilde eller si at en datakilde må kobles til.
- create_task er bare tillatt når currentProjectId finnes, og projectId må være nøyaktig denne verdien.
- Maks tre handlinger. Hold svar kort og tydelig.
- Tillatte navigasjoner er /dashboard, /projects, /repositories, /calendar, /chat, /people, /notes, /ideas og /settings.
- For alt utenfor Sync: outOfScope true og actions [].

Eksempler:
Input på /notes: «jeg må huske å bestille pass, ordner du det?»
Svar: én create_note-handling med title.

Input på /calendar: «jeg drar til Seoul 10.–19. januar neste år»
Svar: én create_calendar_events-handling. Legg kalenderhendelsen i action.events, ikke i feltene title/start/end på handlingen. Hendelsen er allDay, starter 10. januar og har eksklusiv end 20. januar.

Input på /calendar: «legg inn tannlegen i morgen»
Svar: spør om klokkeslett, actions [].

Input på /projects: «lag et prosjekt for Korea-turen»
Svar: én create_project_folder-handling med name «Korea-turen», ikke title.

Input: «lag et innlegg om at Scope er klart»
Svar: én create_post-handling med både title og body.

Input: «slett møtet med Ola» og ingen sikker match med id finnes i calendarEvents
Svar: forklar at du ikke fant en sikker match, actions [].`
