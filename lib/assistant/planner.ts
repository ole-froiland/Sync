import { SYNC_NAV_TARGETS, type SyncAssistantMessage, type SyncAssistantPlan } from './types'

type PlannerContext = {
  currentPath?: string
  now?: Date
}

const OUT_OF_SCOPE_PATTERNS = [
  /\bweather\b/i,
  /\bvær(et)?\b/i,
  /\bnyheter\b/i,
  /\bnews\b/i,
  /\bgoogle\b/i,
  /\bsearch\b/i,
  /\bsøk\b/i,
  /\bhva er klokka\b/i,
  /\bhvem er\b/i,
  /\bwho is\b/i,
  /\bwrite code\b/i,
  /\bkode\b/i,
]

export function planLocalSyncResponse(messages: SyncAssistantMessage[], context: PlannerContext = {}): SyncAssistantPlan {
  const latest = [...messages].reverse().find((message) => message.role === 'user')?.content.trim() ?? ''
  const lower = latest.toLowerCase()
  const now = context.now ?? new Date()

  if (!latest) {
    return {
      reply: 'Ask me to do something inside Sync, like adding a note or creating a calendar event.',
      actions: [],
    }
  }

  if (OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(latest)) && !mentionsSyncSurface(lower)) {
    return {
      outOfScope: true,
      reply: 'Jeg kan bare hjelpe med ting inne i Sync, som notes, kalender, prosjekter, chat, repos og innstillinger.',
      actions: [],
    }
  }

  const modal = modalTarget(lower)
  if (modal) {
    return {
      reply: `Jeg kan åpne ${modal.label}.`,
      actions: [{ kind: 'open_modal', modal: modal.modal }],
    }
  }

  const navigation = navigationTarget(lower)
  if (navigation) {
    return {
      reply: `Jeg kan åpne ${navigation.label} for deg.`,
      actions: [{ kind: 'navigate', href: navigation.href }],
    }
  }

  if (lower.includes('kalender') || lower.includes('calendar') || lower.includes('aktivitet') || lower.includes('møte') || lower.includes('meeting')) {
    if (isBulkCalendarRequest(lower)) {
      return {
        reply: 'Jeg kan legge hendelsene i Sync-kalenderen, men jeg kan ikke gjette eller hente en komplett terminliste. Send dato og tidspunkt for hendelsene du vil legge inn.',
        actions: [],
      }
    }

    const parsed = parseCalendarRequest(latest, now)
    if (!parsed.ok) {
      return {
        reply:
          parsed.missing === 'date'
            ? 'Hvilken dato skal hendelsen være? Skriv for eksempel "i morgen kl. 10:30".'
            : 'Hvilket tidspunkt skal hendelsen starte? Skriv for eksempel "i morgen kl. 10:30".',
        actions: [],
      }
    }

    return {
      reply: `Jeg kan legge "${parsed.event.title}" i kalenderen. Bekreft først, så oppretter jeg aktiviteten.`,
      actions: [
        {
          kind: 'create_calendar_event',
          ...parsed.event,
        },
      ],
    }
  }

  if (isCompleteNoteRequest(lower)) {
    const title = parseCompleteNoteTitle(latest)
    if (title) {
      return {
        reply: `Jeg kan markere notatet "${title}" som ferdig. Bekreft først, så oppdaterer jeg Notes.`,
        actions: [{ kind: 'complete_note', title }],
      }
    }
  }

  if (lower.includes('note') || lower.includes('notes') || lower.includes('notat') || lower.includes('husk') || lower.includes('legg til')) {
    const title = parseNoteTitle(latest)
    if (title) {
      return {
        reply: `Jeg kan legge dette i Notes: "${title}". Bekreft først, så lagrer jeg notatet.`,
        actions: [{ kind: 'create_note', title }],
      }
    }
  }

  if (isProjectCreateRequest(lower)) {
    const name = parseProjectName(latest)
    return {
      reply: `Jeg kan lage prosjektmappen "${name}". Bekreft først, så oppretter jeg den i Projects.`,
      actions: [{ kind: 'create_project_folder', name, description: null }],
    }
  }

  if (isTaskCreateRequest(lower)) {
    const projectId = projectIdFromPath(context.currentPath)
    if (!projectId) {
      return {
        reply: 'Jeg kan lage tasks når du står inne på en prosjektside. Åpne prosjektet først, så kan jeg legge tasken der.',
        actions: [{ kind: 'navigate', href: '/projects' }],
      }
    }
    const title = parseTaskTitle(latest)
    return {
      reply: `Jeg kan lage tasken "${title}" i dette prosjektet. Bekreft først, så oppretter jeg den.`,
      actions: [{ kind: 'create_task', projectId, title, status: 'todo' }],
    }
  }

  if (lower.includes('post') && (lower.includes('lag') || lower.includes('create') || lower.includes('skriv'))) {
    const title = afterFirstMarker(latest, ['post:', 'post ', 'lag post', 'create post']) || 'New Sync post'
    return {
      reply: 'Jeg kan lage et utkast til post. Bekreft først, så oppretter jeg den i feeden.',
      actions: [
        {
          kind: 'create_post',
          title: title.slice(0, 80),
          body: title,
          postType: 'update',
        },
      ],
    }
  }

  return {
    reply: 'Jeg kan hjelpe med Sync-handlinger som notes, kalender, prosjekter, tasks, chat, repos og innstillinger. Prøv for eksempel "legg til note: ring Ola" eller "lag kalenderaktivitet i morgen 10:00".',
    actions: [],
  }
}

export async function planOpenAiSyncResponse(messages: SyncAssistantMessage[], context: PlannerContext): Promise<SyncAssistantPlan | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini'
  const latest = messages.slice(-8)

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            'You are Sync AI, an action planner for the Sync workspace. Return exactly one plan_sync_response function call. Never claim an action will happen unless you return a complete matching action. Use the user\'s language. Refuse requests outside Sync briefly and truthfully.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            currentPath: context.currentPath ?? '/',
            currentProjectId: projectIdFromPath(context.currentPath),
            now: (context.now ?? new Date()).toISOString(),
            messages: latest,
            allowedSurfaces: ['notes', 'calendar', 'projects', 'tasks', 'posts', 'chat', 'repositories', 'people', 'settings'],
            rules: [
              'Only plan actions inside Sync.',
              'For a simple request to open a page or modal, return exactly one navigate or open_modal action; the client executes that safe action automatically.',
              'Use create_project_folder for the project folders shown on the current Projects page. Do not use the legacy project model.',
              'Use create_task only when currentProjectId is present, and set projectId to currentProjectId.',
              'Use open_modal for settings, new_post, and new_repo when the user asks to open those controls.',
              'Only create a calendar event when the user supplied a concrete date and start time. Ask a short clarifying question with zero actions when either is missing.',
              'Never invent sports fixtures, schedules, dates, people, repository data, or other external facts. If external data is required and was not supplied, explain what the user must provide and return zero actions.',
              'Set every unused action field to null.',
              'Refuse briefly with no actions for weather, web search, general knowledge, coding, or other non-Sync requests.',
            ],
          }),
        },
      ],
      tools: [syncPlannerTool()],
      tool_choice: { type: 'function', name: 'plan_sync_response' },
      parallel_tool_calls: false,
    }),
  })

  if (!response.ok) return null
  const data = (await response.json()) as {
    output?: Array<{ type?: string; name?: string; arguments?: string }>
  }

  const call = data.output?.find((item) => item.type === 'function_call' && item.name === 'plan_sync_response')
  if (!call?.arguments) return null

  try {
    const parsed = JSON.parse(call.arguments) as SyncAssistantPlan
    if (!parsed || typeof parsed.reply !== 'string' || !Array.isArray(parsed.actions)) return null
    return parsed
  } catch {
    return null
  }
}

function syncPlannerTool() {
  const nullableString = { type: ['string', 'null'] }
  return {
    type: 'function',
    name: 'plan_sync_response',
    description: 'Plan a truthful Sync-only response and zero to three validated Sync actions.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        reply: { type: 'string' },
        outOfScope: { type: 'boolean' },
        actions: {
          type: 'array',
          maxItems: 3,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: {
                type: 'string',
                enum: [
                  'navigate',
                  'open_modal',
                  'create_note',
                  'complete_note',
                  'create_calendar_event',
                  'create_post',
                  'create_project_folder',
                  'create_task',
                ],
              },
              href: { type: ['string', 'null'], enum: [...SYNC_NAV_TARGETS, null] },
              modal: { type: ['string', 'null'], enum: ['settings', 'new_post', 'new_repo', null] },
              title: nullableString,
              noteId: nullableString,
              start: nullableString,
              end: nullableString,
              eventKind: { type: ['string', 'null'], enum: ['meeting', 'focus', 'launch', 'deadline', null] },
              body: nullableString,
              postType: { type: ['string', 'null'], enum: ['update', 'news', 'question', 'resource', null] },
              sourceUrl: nullableString,
              name: nullableString,
              description: nullableString,
              projectId: nullableString,
              status: { type: ['string', 'null'], enum: ['todo', 'in_progress', 'done', null] },
            },
            required: [
              'kind',
              'href',
              'modal',
              'title',
              'noteId',
              'start',
              'end',
              'eventKind',
              'body',
              'postType',
              'sourceUrl',
              'name',
              'description',
              'projectId',
              'status',
            ],
          },
        },
      },
      required: ['reply', 'outOfScope', 'actions'],
    },
  }
}

function mentionsSyncSurface(value: string) {
  return ['sync', 'note', 'notes', 'notat', 'kalender', 'calendar', 'project', 'prosjekt', 'task', 'chat', 'repo', 'settings', 'innstillinger'].some((word) => value.includes(word))
}

function navigationTarget(value: string) {
  const targets = [
    { href: '/dashboard' as const, label: 'Dashboard', words: ['dashboard', 'feed', 'hjem'] },
    { href: '/projects' as const, label: 'Projects', words: ['projects', 'prosjekter', 'prosjekt'] },
    { href: '/repositories' as const, label: 'Repositories', words: ['repositories', 'repos', 'repo'] },
    { href: '/calendar' as const, label: 'Calendar', words: ['calendar', 'kalender'] },
    { href: '/chat' as const, label: 'Chat', words: ['chat'] },
    { href: '/people' as const, label: 'People', words: ['people', 'folk', 'personer'] },
    { href: '/notes' as const, label: 'Notes', words: ['notes', 'notater'] },
    { href: '/ideas' as const, label: 'Ideas', words: ['ideas', 'ideer'] },
    { href: '/settings' as const, label: 'Settings', words: ['settings', 'innstillinger'] },
  ]
  if (!/\b(open|åpne|gå|go|vis|show)\b/i.test(value)) return null
  return targets.find((target) => target.words.some((word) => value.includes(word))) ?? null
}

function modalTarget(value: string) {
  if (value.includes('settings') || value.includes('innstillinger')) return { modal: 'settings' as const, label: 'innstillinger' }
  if (value.includes('new repo') || value.includes('ny repo') || value.includes('lag repo')) return { modal: 'new_repo' as const, label: 'ny repo' }
  if (value.includes('new post') || value.includes('ny post') || value.includes('lag post')) return { modal: 'new_post' as const, label: 'ny post' }
  return null
}

function parseNoteTitle(text: string) {
  return cleanLeadingCommand(
    afterFirstMarker(text, ['note:', 'notes:', 'notat:', 'husk:', 'legg til note', 'legg til notat', 'add note', 'create note', 'ny note']) || text
  )
}

function isCompleteNoteRequest(value: string) {
  return (
    (value.includes('ferdig') || value.includes('fullfør') || value.includes('complete') || value.includes('done')) &&
    (value.includes('note') || value.includes('notat'))
  )
}

function parseCompleteNoteTitle(text: string) {
  return cleanLeadingCommand(
    afterFirstMarker(text, ['note:', 'notat:', 'fullfør note', 'fullfør notat', 'complete note', 'marker note', 'mark note']) || text
  )
    .replace(/\b(som ferdig|ferdig|done|complete)\b/gi, '')
    .trim()
}

function isProjectCreateRequest(value: string) {
  return (
    (value.includes('prosjekt') || value.includes('project')) &&
    (value.includes('lag') || value.includes('opprett') || value.includes('create') || value.includes('ny ')) &&
    !value.includes('task') &&
    !value.includes('oppgave')
  )
}

function parseProjectName(text: string) {
  return (
    cleanLeadingCommand(afterFirstMarker(text, ['prosjekt:', 'project:', 'nytt prosjekt', 'ny prosjekt', 'lag prosjekt', 'create project']) || text)
      .replace(/\b(prosjekt|project)\b/gi, '')
      .trim() || 'New Sync project'
  ).slice(0, 120)
}

function isTaskCreateRequest(value: string) {
  return (
    (value.includes('task') || value.includes('oppgave')) &&
    (value.includes('lag') || value.includes('opprett') || value.includes('create') || value.includes('legg til') || value.includes('ny '))
  )
}

function parseTaskTitle(text: string) {
  return (
    cleanLeadingCommand(afterFirstMarker(text, ['task:', 'oppgave:', 'lag task', 'lag oppgave', 'create task', 'add task']) || text)
      .replace(/\b(task|oppgave)\b/gi, '')
      .trim() || 'New task'
  ).slice(0, 160)
}

function projectIdFromPath(path?: string) {
  const match = path?.match(/^\/projects\/([^/?#]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

function parseCalendarRequest(text: string, now: Date) {
  const day = requestedCalendarDay(text, now)
  if (!day) return { ok: false as const, missing: 'date' as const }

  const time = requestedCalendarTime(text)
  if (!time) return { ok: false as const, missing: 'time' as const }

  day.setHours(time.hour, time.minute, 0, 0)
  const end = requestedCalendarEnd(text, day)
  const lower = text.toLowerCase()

  return {
    ok: true as const,
    event: {
      title: parseCalendarTitle(text) || 'Sync activity',
      start: localDateTime(day),
      end: localDateTime(end),
      eventKind: lower.includes('focus') || lower.includes('fokus') ? 'focus' as const : 'meeting' as const,
    },
  }
}

function isBulkCalendarRequest(value: string) {
  return (
    /\b(alle|all|hver|every|samtlige)\b/i.test(value) &&
    /\b(kamper|kampene|matches|fixtures|games|hendelser|events|møter|meetings)\b/i.test(value)
  )
}

function requestedCalendarDay(text: string, now: Date) {
  const lower = text.toLowerCase()
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) return validLocalDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const dotted = text.match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\b/)
  if (dotted) {
    const hasYear = Boolean(dotted[3])
    let year = hasYear ? Number(dotted[3]) : now.getFullYear()
    let candidate = validLocalDate(year, Number(dotted[2]), Number(dotted[1]))
    if (candidate && !hasYear && +candidate < +day) {
      year += 1
      candidate = validLocalDate(year, Number(dotted[2]), Number(dotted[1]))
    }
    return candidate
  }

  if (lower.includes('overmorgen') || lower.includes('day after tomorrow')) {
    day.setDate(day.getDate() + 2)
    return day
  }
  if (lower.includes('i morgen') || lower.includes('tomorrow')) {
    day.setDate(day.getDate() + 1)
    return day
  }
  if (lower.includes('i dag') || lower.includes('today')) return day
  if (lower.includes('neste uke') || lower.includes('next week')) {
    day.setDate(day.getDate() + 7)
    return day
  }

  const weekdays = [
    ['søndag', 'sunday'],
    ['mandag', 'monday'],
    ['tirsdag', 'tuesday'],
    ['onsdag', 'wednesday'],
    ['torsdag', 'thursday'],
    ['fredag', 'friday'],
    ['lørdag', 'saturday'],
  ]
  const weekday = weekdays.findIndex((names) => names.some((name) => lower.includes(name)))
  if (weekday !== -1) {
    const offset = (weekday - day.getDay() + 7) % 7 || 7
    day.setDate(day.getDate() + offset)
    return day
  }

  return null
}

function requestedCalendarTime(text: string) {
  const withoutDates = text
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
    .replace(/\b\d{1,2}\.\d{1,2}(?:\.\d{4})?\b/g, '')
  const match =
    withoutDates.match(/\b(?:kl(?:okka)?\.?|at)\s*([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\b/i) ??
    withoutDates.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (!match) return null
  return { hour: Number(match[1]), minute: match[2] ? Number(match[2]) : 0 }
}

function requestedCalendarEnd(text: string, start: Date) {
  const end = new Date(start)
  const explicitEnd = text.match(/\b(?:til|to)\s*([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\b/i)
  if (explicitEnd) {
    end.setHours(Number(explicitEnd[1]), explicitEnd[2] ? Number(explicitEnd[2]) : 0, 0, 0)
    if (+end > +start) return end
  }

  const duration = text.match(/\b(?:i|for)\s+(\d+(?:[.,]\d+)?)\s*(?:timer?|hours?)\b/i)
  if (duration) {
    end.setTime(+start + Number(duration[1].replace(',', '.')) * 60 * 60 * 1000)
    return end
  }

  end.setHours(end.getHours() + 1)
  return end
}

function parseCalendarTitle(text: string) {
  return cleanLeadingCommand(text)
    .replace(/\b(kalenderaktivitet|kalenderhendelse|calendar event)\b/gi, '')
    .replace(/\b(?:i|på)\s+(?:min\s+)?kalender(?:en)?\b/gi, '')
    .replace(/\b(i dag|today|i morgen|tomorrow|overmorgen|day after tomorrow|neste uke|next week)\b/gi, '')
    .replace(/\b(mandag|monday|tirsdag|tuesday|onsdag|wednesday|torsdag|thursday|fredag|friday|lørdag|saturday|søndag|sunday)\b/gi, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
    .replace(/\b\d{1,2}\.\d{1,2}(?:\.\d{4})?\b/g, '')
    .replace(/\b(?:kl(?:okka)?\.?|at)\s*([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\b/gi, '')
    .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, '')
    .replace(/\b(?:til|to)\s*([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\b/gi, '')
    .replace(/\b(?:i|for)\s+\d+(?:[.,]\d+)?\s*(?:timer?|hours?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function validLocalDate(year: number, month: number, day: number) {
  const candidate = new Date(year, month - 1, day)
  return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day
    ? candidate
    : null
}

function afterFirstMarker(text: string, markers: string[]) {
  const lower = text.toLowerCase()
  for (const marker of markers) {
    const index = lower.indexOf(marker)
    if (index !== -1) return text.slice(index + marker.length).trim()
  }
  return ''
}

function cleanLeadingCommand(value: string) {
  return value
    .replace(/^(?:hei|hello)(?:\s+(?:sync\s+)?ai)?[,!:.\s-]*/i, '')
    .replace(/^(?:kan du|could you|please|pls|vennligst)\s+/i, '')
    .replace(/^(?:lag|legg(?:e)?\s+(?:til|inn)|opprett|create|add)\s+/i, '')
    .replace(/^[:\-–—\s]+/, '')
    .trim()
    .slice(0, 240)
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function localDateTime(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}
