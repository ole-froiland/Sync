export type SyncAssistantRole = 'user' | 'assistant'

export type SyncAssistantMessage = {
  role: SyncAssistantRole
  content: string
}

export type SyncAssistantCalendarEvent = {
  id?: string
  title: string
  start: string
  end: string
  eventKind?: 'meeting' | 'focus' | 'launch' | 'deadline'
  sourceUrl?: string | null
  allDay?: boolean
}

export type SyncAssistantAction =
  | {
      kind: 'navigate'
      href: '/dashboard' | '/projects' | '/repositories' | '/calendar' | '/chat' | '/people' | '/notes' | '/ideas' | '/settings'
    }
  | {
      kind: 'open_modal'
      modal: 'settings' | 'new_post' | 'new_repo'
    }
  | {
      kind: 'open_projects_tree'
    }
  | {
      kind: 'set_language'
      locale: 'en' | 'no'
    }
  | {
      kind: 'create_note'
      title: string
    }
  | {
      kind: 'complete_note'
      noteId?: string
      title?: string
    }
  | {
      kind: 'create_calendar_event'
      title: string
      start: string
      end: string
      eventKind?: 'meeting' | 'focus' | 'launch' | 'deadline'
    }
  | {
      kind: 'create_calendar_events'
      events: SyncAssistantCalendarEvent[]
      sourceLabel?: string | null
      sourceUrl?: string | null
    }
  | {
      kind: 'update_calendar_events'
      events: SyncAssistantCalendarEvent[]
    }
  | {
      kind: 'delete_calendar_events'
      events: SyncAssistantCalendarEvent[]
    }
  | {
      kind: 'create_post'
      title: string
      body: string
      postType?: 'update' | 'news' | 'question' | 'resource'
      sourceUrl?: string | null
    }
  | {
      kind: 'create_project_folder'
      name: string
      description?: string | null
    }
  | {
      kind: 'create_project'
      name: string
      description?: string | null
      status?: 'idea' | 'building' | 'live'
      techStack?: string[]
    }
  | {
      kind: 'create_task'
      projectId: string
      title: string
      description?: string | null
      status?: 'todo' | 'in_progress' | 'done'
    }

export type SyncAssistantActionRisk = 'navigation' | 'write' | 'high'

export type SyncAssistantActionEnvelope = {
  id: string
  action: SyncAssistantAction
  label: string
  description: string
  risk: SyncAssistantActionRisk
  requiresConfirmation: boolean
  confirmationToken?: string
}

export type SyncAssistantPlan = {
  reply: string
  actions: SyncAssistantAction[]
  outOfScope?: boolean
}

export type SyncAssistantChatResponse = {
  message: SyncAssistantMessage
  actions: SyncAssistantActionEnvelope[]
  planner: 'openai' | 'gemma' | 'local'
  model?: string
}

export const SYNC_NAV_TARGETS = [
  '/dashboard',
  '/projects',
  '/repositories',
  '/calendar',
  '/chat',
  '/people',
  '/notes',
  '/ideas',
  '/settings',
] as const

export type SyncNavHref = typeof SYNC_NAV_TARGETS[number]

export function normalizeAssistantAction(input: unknown): SyncAssistantAction | null {
  if (!input || typeof input !== 'object') return null
  const value = input as Record<string, unknown>
  const kind = value.kind

  if (kind === 'navigate') {
    const href = value.href
    return typeof href === 'string' && SYNC_NAV_TARGETS.includes(href as never)
      ? { kind, href: href as SyncNavHref }
      : null
  }

  if (kind === 'open_modal') {
    const modal = value.modal
    return modal === 'settings' || modal === 'new_post' || modal === 'new_repo'
      ? { kind, modal }
      : null
  }

  if (kind === 'open_projects_tree') return { kind }

  if (kind === 'set_language') {
    return value.locale === 'en' || value.locale === 'no' ? { kind, locale: value.locale } : null
  }

  if (kind === 'create_note') {
    const title = stringValue(value.title)
    return title ? { kind, title } : null
  }

  if (kind === 'complete_note') {
    const noteId = stringValue(value.noteId)
    const title = stringValue(value.title)
    return noteId || title ? { kind, noteId: noteId || undefined, title: title || undefined } : null
  }

  if (kind === 'create_calendar_event') {
    const title = stringValue(value.title)
    const start = stringValue(value.start)
    const end = stringValue(value.end)
    if (!title || !isValidDateTime(start) || !isValidDateTime(end) || +new Date(end) <= +new Date(start)) return null
    const eventKind = normalizeEventKind(value.eventKind)
    return { kind, title, start, end, eventKind }
  }

  if (kind === 'create_calendar_events') {
    if (!Array.isArray(value.events)) return null
    const events = value.events
      .map(normalizeCalendarEvent)
      .filter((event): event is SyncAssistantCalendarEvent => Boolean(event))
      .slice(0, 100)
    if (events.length === 0) return null
    return {
      kind,
      events,
      sourceLabel: stringValue(value.sourceLabel) || null,
      sourceUrl: safeHttpUrl(value.sourceUrl),
    }
  }

  if (kind === 'update_calendar_events' || kind === 'delete_calendar_events') {
    if (!Array.isArray(value.events)) return null
    const events = value.events
      .map(normalizeCalendarEvent)
      .filter((event): event is SyncAssistantCalendarEvent => Boolean(event?.id))
      .slice(0, 100)
    return events.length > 0 ? { kind, events } : null
  }

  if (kind === 'create_post') {
    const title = stringValue(value.title)
    const body = stringValue(value.body)
    if (!title || !body) return null
    return {
      kind,
      title,
      body,
      postType: normalizePostType(value.postType),
      sourceUrl: stringValue(value.sourceUrl) || null,
    }
  }

  if (kind === 'create_project_folder') {
    const name = stringValue(value.name)
    if (!name) return null
    return {
      kind,
      name,
      description: stringValue(value.description) || null,
    }
  }

  if (kind === 'create_project') {
    const name = stringValue(value.name)
    if (!name) return null
    return {
      kind,
      name,
      description: stringValue(value.description) || null,
      status: normalizeProjectStatus(value.status),
      techStack: arrayOfStrings(value.techStack),
    }
  }

  if (kind === 'create_task') {
    const projectId = stringValue(value.projectId)
    const title = stringValue(value.title)
    if (!projectId || !title) return null
    return {
      kind,
      projectId,
      title,
      description: stringValue(value.description) || null,
      status: normalizeTaskStatus(value.status),
    }
  }

  return null
}

export function actionRequiresServer(action: SyncAssistantAction) {
  return ![
    'navigate',
    'open_modal',
    'open_projects_tree',
    'set_language',
    'create_calendar_event',
    'create_calendar_events',
    'update_calendar_events',
    'delete_calendar_events',
    'create_project_folder',
  ].includes(action.kind)
}

export function actionRequiresConfirmation(action: SyncAssistantAction) {
  return !['navigate', 'open_modal', 'open_projects_tree'].includes(action.kind)
}

export function actionRisk(action: SyncAssistantAction): SyncAssistantActionRisk {
  if (action.kind === 'navigate' || action.kind === 'open_modal' || action.kind === 'open_projects_tree') return 'navigation'
  return 'write'
}

export function actionLabel(action: SyncAssistantAction) {
  switch (action.kind) {
    case 'navigate':
      return `Open ${action.href.replace('/', '') || 'dashboard'}`
    case 'open_modal':
      return action.modal === 'settings'
        ? 'Open settings'
        : action.modal === 'new_post'
          ? 'Open new post'
          : 'Open new repo'
    case 'open_projects_tree':
      return 'Open project tree'
    case 'set_language':
      return 'Change Sync language'
    case 'create_note':
      return 'Create note'
    case 'complete_note':
      return 'Complete note'
    case 'create_calendar_event':
      return 'Create calendar event'
    case 'create_calendar_events':
      return `Add ${action.events.length} calendar events`
    case 'update_calendar_events':
      return `Endre ${action.events.length} kalender${action.events.length === 1 ? 'hendelse' : 'hendelser'}`
    case 'delete_calendar_events':
      return `Slett ${action.events.length} kalender${action.events.length === 1 ? 'hendelse' : 'hendelser'}`
    case 'create_post':
      return 'Create post'
    case 'create_project_folder':
      return 'Create project folder'
    case 'create_project':
      return 'Create project'
    case 'create_task':
      return 'Create task'
  }
}

export function actionDescription(action: SyncAssistantAction) {
  switch (action.kind) {
    case 'navigate':
      return `Go to ${action.href}.`
    case 'open_modal':
      return `Open ${action.modal.replace('_', ' ')}.`
    case 'open_projects_tree':
      return 'Show all project folders as a tree.'
    case 'set_language':
      return action.locale === 'en' ? 'Change Sync to English.' : 'Endre Sync til norsk.'
    case 'create_note':
      return action.title
    case 'complete_note':
      return action.title ? `Mark "${action.title}" as done.` : `Mark note ${action.noteId} as done.`
    case 'create_calendar_event':
      return `${action.title} from ${formatActionDate(action.start)} to ${formatActionDate(action.end)}.`
    case 'create_calendar_events':
      return `${summarizeCalendarEvents(action.events, 'legges til')}${action.sourceLabel ? ` Kilde: ${action.sourceLabel}.` : ''}`
    case 'update_calendar_events':
      return summarizeCalendarEvents(action.events, 'endres')
    case 'delete_calendar_events':
      return summarizeCalendarEvents(action.events, 'slettes')
    case 'create_post':
      return action.title
    case 'create_project_folder':
      return action.description ? `${action.name} — ${action.description}` : action.name
    case 'create_project':
      return action.name
    case 'create_task':
      return action.title
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 2000) : ''
}

function normalizeCalendarEvent(input: unknown): SyncAssistantCalendarEvent | null {
  if (!input || typeof input !== 'object') return null
  const value = input as Record<string, unknown>
  const title = stringValue(value.title)
  const start = stringValue(value.start)
  const end = stringValue(value.end)
  if (!title || !isValidDateTime(start) || !isValidDateTime(end) || +new Date(end) <= +new Date(start)) return null
  return {
    id: stringValue(value.id) || undefined,
    title,
    start,
    end,
    eventKind: normalizeEventKind(value.eventKind),
    sourceUrl: safeHttpUrl(value.sourceUrl),
    allDay: value.allDay === true,
  }
}

function safeHttpUrl(value: unknown) {
  const url = stringValue(value)
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function arrayOfStrings(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 12)
}

function isValidDateTime(value: string) {
  return Boolean(value) && !Number.isNaN(+new Date(value))
}

function normalizeEventKind(value: unknown) {
  return value === 'meeting' || value === 'focus' || value === 'launch' || value === 'deadline'
    ? value
    : 'meeting'
}

function normalizePostType(value: unknown) {
  return value === 'news' || value === 'question' || value === 'resource' || value === 'update'
    ? value
    : 'update'
}

function normalizeProjectStatus(value: unknown) {
  return value === 'building' || value === 'live' || value === 'idea' ? value : 'idea'
}

function normalizeTaskStatus(value: unknown) {
  return value === 'in_progress' || value === 'done' || value === 'todo' ? value : 'todo'
}

function formatActionDate(value: string) {
  try {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function summarizeCalendarEvents(events: SyncAssistantCalendarEvent[], verb: string) {
  const preview = events.slice(0, 3).map((event) => `${event.title} (${formatActionDate(event.start)})`).join(', ')
  const rest = events.length > 3 ? ` + ${events.length - 3} til` : ''
  return `${preview}${rest} ${verb}.`
}
