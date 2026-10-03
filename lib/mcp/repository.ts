import type { SupabaseClient } from '@supabase/supabase-js'
import type { Project, ProjectFolder, Task } from '@/types'
import type {
  CreateFolderInput,
  CreateProjectInput,
  CreateTaskInput,
  FolderListItem,
  ProjectDetails,
  ProjectStatus,
  SyncMcpRepository,
  TaskStatus,
} from '@/lib/mcp/types'

const DEFAULT_LIMIT = 20

function isProjectFolder(value: unknown): value is ProjectFolder {
  if (!value || typeof value !== 'object') return false
  const folder = value as Partial<ProjectFolder>
  return (
    typeof folder.id === 'string' &&
    typeof folder.name === 'string' &&
    typeof folder.description === 'string' &&
    typeof folder.color === 'string' &&
    typeof folder.createdAt === 'string' &&
    Array.isArray(folder.items)
  )
}

function folderStateUnavailable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === '42P01' ||
    error?.message?.toLowerCase().includes('project_folder_states') ||
    error?.message?.toLowerCase().includes('does not exist')
  )
}

function errorMessage(prefix: string, error: { message?: string } | null) {
  return `${prefix}: ${error?.message || 'Unknown database error'}`
}

export class SupabaseSyncMcpRepository implements SyncMcpRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly userId: string
  ) {}

  async listProjects(input: {
    query?: string
    status?: ProjectStatus
    limit?: number
  } = {}): Promise<Project[]> {
    let query = this.supabase
      .from('projects')
      .select('id, name, description, status, tech_stack, github_url, demo_url, created_by, created_at')
      .order('created_at', { ascending: false })
      .limit(input.limit ?? DEFAULT_LIMIT)

    if (input.status) query = query.eq('status', input.status)
    if (input.query) query = query.ilike('name', `%${input.query}%`)

    const { data, error } = await query
    if (error) throw new Error(errorMessage('Could not list projects', error))
    return (data ?? []) as Project[]
  }

  async getProject(projectId: string): Promise<ProjectDetails | null> {
    const { data: project, error: projectError } = await this.supabase
      .from('projects')
      .select('id, name, description, status, tech_stack, github_url, demo_url, created_by, created_at')
      .eq('id', projectId)
      .maybeSingle()

    if (projectError) throw new Error(errorMessage('Could not get project', projectError))
    if (!project) return null

    const tasks = await this.listTasks({ projectId })
    return { project: project as Project, tasks }
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const { data, error } = await this.supabase
      .from('projects')
      .insert({
        name: input.name,
        description: input.description || null,
        status: input.status,
        tech_stack: input.techStack?.length ? input.techStack : null,
        github_url: input.githubUrl || null,
        demo_url: input.demoUrl || null,
        created_by: this.userId,
      })
      .select('id, name, description, status, tech_stack, github_url, demo_url, created_by, created_at')
      .single()

    if (error) throw new Error(errorMessage('Could not create project', error))

    const { error: membershipError } = await this.supabase.from('project_members').insert({
      project_id: data.id,
      user_id: this.userId,
      role: 'owner',
    })

    if (membershipError) {
      console.warn('[mcp] Project created, but owner membership could not be added.')
    }

    return data as Project
  }

  async listFolders(input: {
    query?: string
    parentId?: string
    limit?: number
  } = {}): Promise<FolderListItem[]> {
    const folders = await this.readFolders()
    const normalizedQuery = input.query?.trim().toLocaleLowerCase()

    return folders
      .filter((folder) =>
        input.parentId === undefined
          ? true
          : (folder.parentId ?? '') === input.parentId
      )
      .filter((folder) => {
        if (!normalizedQuery) return true
        return (
          folder.name.toLocaleLowerCase().includes(normalizedQuery) ||
          folder.description.toLocaleLowerCase().includes(normalizedQuery) ||
          folder.items.some((item) =>
            item.title.toLocaleLowerCase().includes(normalizedQuery)
          )
        )
      })
      .slice(0, input.limit ?? DEFAULT_LIMIT)
      .map((folder) => ({
        id: folder.id,
        name: folder.name,
        description: folder.description,
        color: folder.color,
        parentId: folder.parentId,
        createdAt: folder.createdAt,
        itemCount: folder.items.length,
        childCount: folders.filter((candidate) => candidate.parentId === folder.id).length,
      }))
  }

  async createFolder(input: CreateFolderInput): Promise<ProjectFolder> {
    const folders = await this.readFolders()

    if (input.parentId && !folders.some((folder) => folder.id === input.parentId)) {
      throw new Error('Parent folder was not found.')
    }

    const folder: ProjectFolder = {
      id: `folder-${crypto.randomUUID()}`,
      name: input.name,
      description: input.description || '',
      color: input.color,
      logo: { type: 'icon', value: 'folder' },
      parentId: input.parentId,
      createdAt: new Date().toISOString(),
      items: [],
    }

    const { error } = await this.supabase.from('project_folder_states').upsert(
      {
        user_id: this.userId,
        folders: [folder, ...folders],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (folderStateUnavailable(error)) {
      throw new Error('Project folder sync is not installed in this Sync workspace.')
    }
    if (error) throw new Error(errorMessage('Could not create folder', error))

    return folder
  }

  async listTasks(input: {
    projectId: string
    status?: TaskStatus
  }): Promise<Task[]> {
    let query = this.supabase
      .from('tasks')
      .select('id, project_id, title, description, status, assigned_to, created_by, created_at')
      .eq('project_id', input.projectId)
      .order('created_at', { ascending: true })

    if (input.status) query = query.eq('status', input.status)

    const { data, error } = await query
    if (error) throw new Error(errorMessage('Could not list tasks', error))
    return (data ?? []) as Task[]
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const { data, error } = await this.supabase
      .from('tasks')
      .insert({
        project_id: input.projectId,
        title: input.title,
        description: input.description || null,
        status: input.status,
        assigned_to: input.assignedTo || null,
        created_by: this.userId,
      })
      .select('id, project_id, title, description, status, assigned_to, created_by, created_at')
      .single()

    if (error) throw new Error(errorMessage('Could not create task', error))
    return data as Task
  }

  private async readFolders(): Promise<ProjectFolder[]> {
    const { data, error } = await this.supabase
      .from('project_folder_states')
      .select('folders')
      .eq('user_id', this.userId)
      .maybeSingle()

    if (folderStateUnavailable(error)) return []
    if (error) throw new Error(errorMessage('Could not list folders', error))

    return Array.isArray(data?.folders) ? data.folders.filter(isProjectFolder) : []
  }
}
