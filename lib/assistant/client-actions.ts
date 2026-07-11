import type { ProjectFolder } from '@/types'
import type { SyncAssistantAction, SyncAssistantActionEnvelope } from './types'

export const PROJECT_FOLDERS_STORAGE_KEY = 'sync-project-folders-v1'
export const PROJECT_FOLDER_CREATED_EVENT = 'sync:assistant-project-folder-created'
export const TASK_CREATED_EVENT = 'sync:assistant-task-created'

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
  return action.action.kind === 'navigate' || action.action.kind === 'open_modal' ? action : null
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
