import type { Project, ProjectFolder, Task } from '@/types'

export type ProjectStatus = Project['status']
export type TaskStatus = Task['status']

export type ProjectDetails = {
  project: Project
  tasks: Task[]
}

export type FolderListItem = Pick<
  ProjectFolder,
  'id' | 'name' | 'description' | 'color' | 'parentId' | 'createdAt'
> & {
  itemCount: number
  childCount: number
}

export type CreateProjectInput = {
  name: string
  description?: string
  status: ProjectStatus
  techStack?: string[]
  githubUrl?: string
  demoUrl?: string
}

export type CreateFolderInput = {
  name: string
  description?: string
  color: string
  parentId?: string
}

export type CreateTaskInput = {
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  assignedTo?: string
}

export interface SyncMcpRepository {
  listProjects(input?: {
    query?: string
    status?: ProjectStatus
    limit?: number
  }): Promise<Project[]>
  getProject(projectId: string): Promise<ProjectDetails | null>
  createProject(input: CreateProjectInput): Promise<Project>
  listFolders(input?: {
    query?: string
    parentId?: string
    limit?: number
  }): Promise<FolderListItem[]>
  createFolder(input: CreateFolderInput): Promise<ProjectFolder>
  listTasks(input: {
    projectId: string
    status?: TaskStatus
  }): Promise<Task[]>
  createTask(input: CreateTaskInput): Promise<Task>
}
