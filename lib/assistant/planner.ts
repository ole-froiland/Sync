import type { SyncAssistantMessage, SyncAssistantPlan } from './types'

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
    const parsed = parseCalendarRequest(latest, now)
    return {
      reply: `Jeg kan legge "${parsed.title}" i kalenderen. Bekreft først, så oppretter jeg aktiviteten.`,
      actions: [
        {
          kind: 'create_calendar_event',
          title: parsed.title,
          start: parsed.start,
          end: parsed.end,
          eventKind: parsed.eventKind,
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
      reply: `Jeg kan lage prosjektet "${name}". Bekreft først, så oppretter jeg det i Projects.`,
      actions: [{ kind: 'create_project', name, status: 'idea', techStack: [] }],
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
            'You are Sync AI. You only help with actions inside the Sync workspace. If the user asks for anything outside Sync, refuse briefly. Return exactly one function call using plan_sync_response.',
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
              'Use create_task only when currentProjectId is present, and set projectId to currentProjectId.',
              'Use open_modal for settings, new_post, and new_repo when the user asks to open those controls.',
              'Refuse briefly with no actions for weather, web search, general knowledge, coding, or other non-Sync requests.',
            ],
          }),
        },
      ],
      tools: [
        {
          type: 'function',
          name: 'plan_sync_response',
          description: 'Plan a Sync-only response and zero to three Sync actions.',
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
                  additionalProperties: true,
                  properties: {
                    kind: {
                      type: 'string',
                      enum: ['navigate', 'open_modal', 'create_note', 'complete_note', 'create_calendar_event', 'create_post', 'create_project', 'create_task'],
                    },
                  },
                  required: ['kind'],
                },
              },
            },
            required: ['reply', 'actions'],
          },
        },
      ],
      tool_choice: { type: 'function', name: 'plan_sync_response' },
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
  const lower = text.toLowerCase()
  const day = new Date(now)
  if (lower.includes('i morgen') || lower.includes('tomorrow')) day.setDate(day.getDate() + 1)
  if (lower.includes('neste uke') || lower.includes('next week')) day.setDate(day.getDate() + 7)

  const timeMatch = text.match(/\b([01]?\d|2[0-3])(?::|\.)([0-5]\d)\b/) ?? text.match(/\b([01]?\d|2[0-3])\b/)
  const hour = timeMatch ? Number(timeMatch[1]) : 9
  const minute = timeMatch?.[2] ? Number(timeMatch[2]) : 0
  day.setHours(hour, minute, 0, 0)
  const end = new Date(day)
  end.setHours(end.getHours() + 1)

  const title =
    cleanLeadingCommand(afterFirstMarker(text, ['kalenderaktivitet', 'calendar event', 'aktivitet', 'møte', 'meeting', 'kalender']) || text)
      .replace(/\b(i morgen|tomorrow|neste uke|next week)\b/gi, '')
      .replace(/\bkl\.?\s*/gi, '')
      .replace(/\b([01]?\d|2[0-3])(?::|\.)([0-5]\d)\b/g, '')
      .replace(/\b([01]?\d|2[0-3])\b/g, '')
      .trim() || 'Sync activity'

  return {
    title,
    start: localDateTime(day),
    end: localDateTime(end),
    eventKind: lower.includes('focus') || lower.includes('fokus') ? 'focus' as const : 'meeting' as const,
  }
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
    .replace(/^(kan du|please|pls|vennligst|lag|legg til|opprett|create|add)\s+/i, '')
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
