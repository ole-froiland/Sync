export type SyncAssistantRole = 'user' | 'assistant'

export type SyncAssistantMessage = {
  role: SyncAssistantRole
  content: string
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
  planner: 'openai' | 'local'
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
    if (!title || !isValidDateTime(start) || !isValidDateTime(end)) return null
    const eventKind = normalizeEventKind(value.eventKind)
    return { kind, title, start, end, eventKind }
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
  return !['navigate', 'open_modal', 'create_calendar_event', 'create_project_folder'].includes(action.kind)
}

export function actionRequiresConfirmation(action: SyncAssistantAction) {
  return !['navigate', 'open_modal'].includes(action.kind)
}

export function actionRisk(action: SyncAssistantAction): SyncAssistantActionRisk {
  if (action.kind === 'navigate' || action.kind === 'open_modal') return 'navigation'
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
    case 'create_note':
      return 'Create note'
    case 'complete_note':
      return 'Complete note'
    case 'create_calendar_event':
      return 'Create calendar event'
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
    case 'create_note':
      return action.title
    case 'complete_note':
      return action.title ? `Mark "${action.title}" as done.` : `Mark note ${action.noteId} as done.`
    case 'create_calendar_event':
      return `${action.title} from ${formatActionDate(action.start)} to ${formatActionDate(action.end)}.`
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
