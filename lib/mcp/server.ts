import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'
import type { SyncMcpRepository } from '@/lib/mcp/types'

const projectStatusSchema = z.enum(['idea', 'building', 'live'])
const taskStatusSchema = z.enum(['todo', 'in_progress', 'done'])

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  tech_stack: z.array(z.string()).nullable(),
  github_url: z.string().nullable(),
  demo_url: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string(),
})

const taskSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatusSchema,
  assigned_to: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string(),
})

const folderSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  color: z.string(),
  parentId: z.string().optional(),
  createdAt: z.string(),
  itemCount: z.number().int().nonnegative(),
  childCount: z.number().int().nonnegative(),
})

const createdFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  color: z.string(),
  parentId: z.string().optional(),
  createdAt: z.string(),
})

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const

function success(structuredContent: Record<string, unknown>, text: string) {
  return {
    structuredContent,
    content: [{ type: 'text' as const, text }],
  }
}

function toolError(reason: unknown) {
  const text = reason instanceof Error ? reason.message : 'Sync could not complete the request.'
  return {
    isError: true,
    content: [{ type: 'text' as const, text }],
  }
}

export function createSyncMcpServer(repository: SyncMcpRepository) {
  const server = new McpServer(
    { name: 'sync-workspace', version: '0.1.0' },
    {
      instructions:
        'Sync is a private project workspace. Use read tools to resolve stable IDs before creating related records. Never invent project or folder IDs. Creation tools change the user’s Sync workspace.',
    }
  )

  server.registerTool(
    'get_sync_overview',
    {
      title: 'Get Sync overview',
      description: 'Summarize the projects and project folders in the current Sync workspace.',
      inputSchema: {},
      outputSchema: {
        projects: z.array(projectSchema),
        folders: z.array(folderSchema),
      },
      annotations: readOnlyAnnotations,
    },
    async () => {
      try {
        const [projects, folders] = await Promise.all([
          repository.listProjects({ limit: 10 }),
          repository.listFolders({ limit: 10 }),
        ])
        return success(
          { projects, folders },
          `Sync has ${projects.length} visible projects and ${folders.length} project folders in this overview.`
        )
      } catch (reason) {
        return toolError(reason)
      }
    }
  )

  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'Find or review projects in the current Sync workspace.',
      inputSchema: {
        query: z.string().trim().min(1).max(100).optional(),
        status: projectStatusSchema.optional(),
        limit: z.number().int().min(1).max(50).default(20),
      },
      outputSchema: {
        projects: z.array(projectSchema),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ query, status, limit }) => {
      try {
        const projects = await repository.listProjects({ query, status, limit })
        return success({ projects }, `Found ${projects.length} projects.`)
      } catch (reason) {
        return toolError(reason)
      }
    }
  )

  server.registerTool(
    'get_project',
    {
      title: 'Get project',
      description: 'Get one Sync project and its tasks by stable project ID.',
      inputSchema: {
        project_id: z.string().trim().min(1).max(100),
      },
      outputSchema: {
        project: projectSchema,
        tasks: z.array(taskSchema),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ project_id }) => {
      try {
        const details = await repository.getProject(project_id)
        if (!details) return toolError(new Error('Project not found.'))
        return success(details, `Opened ${details.project.name} with ${details.tasks.length} tasks.`)
      } catch (reason) {
        return toolError(reason)
      }
    }
  )

  server.registerTool(
    'create_project',
    {
      title: 'Create project',
      description: 'Create a new project in Sync after the user has clearly asked for it.',
      inputSchema: {
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(2000).optional(),
        status: projectStatusSchema.default('idea'),
        tech_stack: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
        github_url: z.url().max(2000).optional(),
        demo_url: z.url().max(2000).optional(),
      },
      outputSchema: {
        project: projectSchema,
      },
      annotations: writeAnnotations,
    },
    async ({ name, description, status, tech_stack, github_url, demo_url }) => {
      try {
        const project = await repository.createProject({
          name,
          description,
          status,
          techStack: tech_stack,
          githubUrl: github_url,
          demoUrl: demo_url,
        })
        return success({ project }, `Created the Sync project “${project.name}”.`)
      } catch (reason) {
        return toolError(reason)
      }
    }
  )

  server.registerTool(
    'list_project_folders',
    {
      title: 'List project folders',
      description: 'Find folders and folder contents in the user’s Sync project overview.',
      inputSchema: {
        query: z.string().trim().min(1).max(100).optional(),
        parent_id: z.string().trim().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      },
      outputSchema: {
        folders: z.array(folderSchema),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ query, parent_id, limit }) => {
      try {
        const folders = await repository.listFolders({
          query,
          parentId: parent_id,
          limit,
        })
        return success({ folders }, `Found ${folders.length} project folders.`)
      } catch (reason) {
        return toolError(reason)
      }
    }
  )

  server.registerTool(
    'create_project_folder',
    {
      title: 'Create project folder',
      description:
        'Create a top-level project folder or a subfolder in the user’s Sync project overview.',
      inputSchema: {
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(1000).optional(),
        color: z
          .enum([
            'bg-fuchsia-600',
            'bg-sky-600',
            'bg-emerald-600',
            'bg-amber-600',
            'bg-rose-600',
          ])
          .default('bg-fuchsia-600'),
        parent_id: z.string().trim().min(1).max(100).optional(),
      },
      outputSchema: {
        folder: createdFolderSchema,
      },
      annotations: writeAnnotations,
    },
    async ({ name, description, color, parent_id }) => {
      try {
        const created = await repository.createFolder({
          name,
          description,
          color,
          parentId: parent_id,
        })
        const folder = {
          id: created.id,
          name: created.name,
          description: created.description,
          color: created.color,
          parentId: created.parentId,
          createdAt: created.createdAt,
        }
        return success({ folder }, `Created the project folder “${created.name}”.`)
      } catch (reason) {
        return toolError(reason)
      }
    }
  )

  server.registerTool(
    'list_tasks',
    {
      title: 'List project tasks',
      description: 'List tasks for one Sync project, optionally filtered by status.',
      inputSchema: {
        project_id: z.string().trim().min(1).max(100),
        status: taskStatusSchema.optional(),
      },
      outputSchema: {
        tasks: z.array(taskSchema),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ project_id, status }) => {
      try {
        const tasks = await repository.listTasks({ projectId: project_id, status })
        return success({ tasks }, `Found ${tasks.length} tasks.`)
      } catch (reason) {
        return toolError(reason)
      }
    }
  )

  server.registerTool(
    'create_task',
    {
      title: 'Create project task',
      description: 'Create a task in an existing Sync project after resolving its project ID.',
      inputSchema: {
        project_id: z.string().trim().min(1).max(100),
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(2000).optional(),
        status: taskStatusSchema.default('todo'),
        assigned_to: z.string().uuid().optional(),
      },
      outputSchema: {
        task: taskSchema,
      },
      annotations: writeAnnotations,
    },
    async ({ project_id, title, description, status, assigned_to }) => {
      try {
        const task = await repository.createTask({
          projectId: project_id,
          title,
          description,
          status,
          assignedTo: assigned_to,
        })
        return success({ task }, `Created the task “${task.title}”.`)
      } catch (reason) {
        return toolError(reason)
      }
    }
  )

  return server
}
