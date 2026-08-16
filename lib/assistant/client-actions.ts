import type { ProjectFolder } from '@/types'
import type { SyncAssistantAction, SyncAssistantActionEnvelope } from './types'

export const PROJECT_FOLDERS_STORAGE_KEY = 'sync-project-folders-v1'
export const PROJECT_FOLDER_CREATED_EVENT = 'sync:assistant-project-folder-created'
export const TASK_CREATED_EVENT = 'sync:assistant-task-created'
export const PROJECTS_TREE_EVENT = 'sync:assistant-open-projects-tree'
export const PROJECTS_VIEW_STORAGE_KEY = 'sync:assistant-projects-view'

export type AssistantLocalCalendarEvent = {
  id: string
  title: string
  start: string
  end: string
  kind: 'meeting' | 'focus' | 'launch' | 'deadline'
  tone: 'violet' | 'sky' | 'emerald' | 'amber'
  note?: string
  allDay?: boolean
}

type AssistantProfile = {
  id: string
  name: string
  avatar_url: string | null
}

type ProjectFolderBuildOptions = {
  id?: string
  now?: string
}

export function automaticBrowserAction(actions: SyncAssistantActionEnvelope[]) {
  if (actions.length !== 1) return null
  const action = actions[0]
  if (action.requiresConfirmation || action.confirmationToken) return null
  return action.action.kind === 'navigate' ||
    action.action.kind === 'open_modal' ||
    action.action.kind === 'open_projects_tree'
    ? action
    : null
}

export function calendarEventsForAction(
  action: Extract<SyncAssistantAction, { kind: 'create_calendar_event' | 'create_calendar_events' | 'update_calendar_events' }>,
  idFactory: () => string = () => crypto.randomUUID()
): AssistantLocalCalendarEvent[] {
  const inputs = action.kind === 'create_calendar_events' || action.kind === 'update_calendar_events'
    ? action.events
    : [{ ...action, id: undefined, sourceUrl: null }]

  return inputs.map((event) => {
    const eventKind = event.eventKind ?? 'meeting'
    return {
      id: event.id ? (event.id.startsWith('cal-') ? event.id : `cal-ai-${event.id}`) : `cal-ai-${idFactory()}`,
      title: event.title,
      start: localDateTimeString(new Date(event.start)),
      end: localDateTimeString(new Date(event.end)),
      kind: eventKind,
      tone: toneForKind(eventKind),
      note: event.sourceUrl ? `Kilde: ${event.sourceUrl}` : undefined,
      allDay: event.allDay === true,
    }
  })
}

export function applyCalendarAction(
  existing: AssistantLocalCalendarEvent[],
  action: Extract<SyncAssistantAction, {
    kind: 'create_calendar_event' | 'create_calendar_events' | 'update_calendar_events' | 'delete_calendar_events'
  }>,
  idFactory: () => string = () => crypto.randomUUID()
) {
  if (action.kind === 'delete_calendar_events') {
    const rawIds = new Set(action.events.map((event) => event.id).filter((id): id is string => Boolean(id)))
    const assistantIds = new Set([...rawIds].map((id) => id.startsWith('cal-ai-') ? id : `cal-ai-${id}`))
    return existing.filter((event) => !rawIds.has(event.id) && !assistantIds.has(event.id))
  }
  return calendarEventsForAction(action, idFactory).reduce(upsertCalendarEvent, existing)
}

export function buildAssistantProjectFolder(
  action: Extract<SyncAssistantAction, { kind: 'create_project_folder' }>,
  profile: AssistantProfile | null,
  options: ProjectFolderBuildOptions = {}
): ProjectFolder {
  return {
    id: options.id ?? `folder-ai-${crypto.randomUUID()}`,
    name: action.name,
    description: action.description ?? '',
    color: 'bg-fuchsia-600',
    logo: { type: 'icon', value: 'folder' },
    createdAt: options.now ?? new Date().toISOString(),
    members: profile
      ? [{ id: profile.id, name: profile.name, avatar_url: profile.avatar_url, role: 'creator' }]
      : [],
    items: [],
  }
}

function toneForKind(kind: AssistantLocalCalendarEvent['kind']): AssistantLocalCalendarEvent['tone'] {
  if (kind === 'focus') return 'sky'
  if (kind === 'launch') return 'emerald'
  if (kind === 'deadline') return 'amber'
  return 'violet'
}

function upsertCalendarEvent(events: AssistantLocalCalendarEvent[], event: AssistantLocalCalendarEvent) {
  return events.some((item) => item.id === event.id)
    ? events.map((item) => (item.id === event.id ? event : item))
    : [...events, event]
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function localDateTimeString(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
