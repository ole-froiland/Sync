import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { Project, ProjectFolder, Task } from '@/types'
import { createSyncMcpServer } from '@/lib/mcp/server'
import type { SyncMcpRepository } from '@/lib/mcp/types'

const project: Project = {
  id: 'project-1',
  name: 'Sync',
  description: 'Team workspace',
  status: 'building',
  tech_stack: ['Next.js'],
  github_url: null,
  demo_url: null,
  created_by: 'user-1',
  created_at: '2026-07-26T12:00:00.000Z',
}

const task: Task = {
  id: 'task-1',
  project_id: project.id,
  title: 'Ship MCP',
  description: null,
  status: 'todo',
  assigned_to: null,
  created_by: 'user-1',
  created_at: '2026-07-26T12:05:00.000Z',
}

const folder: ProjectFolder = {
  id: 'folder-1',
  name: 'MCP',
  description: '',
  color: 'bg-fuchsia-600',
  createdAt: '2026-07-26T12:10:00.000Z',
  items: [],
}

describe('Sync MCP server', () => {
  let client: Client
  let server: ReturnType<typeof createSyncMcpServer>
  let repository: SyncMcpRepository

  beforeEach(async () => {
    repository = {
      listProjects: vi.fn().mockResolvedValue([project]),
      getProject: vi.fn().mockResolvedValue({ project, tasks: [task] }),
      createProject: vi.fn().mockResolvedValue(project),
      listFolders: vi.fn().mockResolvedValue([
        {
          id: folder.id,
          name: folder.name,
          description: folder.description,
          color: folder.color,
          createdAt: folder.createdAt,
          itemCount: 0,
          childCount: 0,
        },
      ]),
      createFolder: vi.fn().mockResolvedValue(folder),
      listTasks: vi.fn().mockResolvedValue([task]),
      createTask: vi.fn().mockResolvedValue(task),
    }

    server = createSyncMcpServer(repository)
    client = new Client({ name: 'sync-mcp-test', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)
    await client.connect(clientTransport)
  })

  afterEach(async () => {
    await client.close()
  })

  it('advertises focused read and write tools with safety annotations', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name)).toEqual([
      'get_sync_overview',
      'list_projects',
      'get_project',
      'create_project',
      'list_project_folders',
      'create_project_folder',
      'list_tasks',
      'create_task',
    ])

    expect(tools.find((tool) => tool.name === 'list_projects')?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    })
    expect(tools.find((tool) => tool.name === 'create_project')?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    })
  })

  it('returns structured project details', async () => {
    const result = await client.callTool({
      name: 'get_project',
      arguments: { project_id: project.id },
    })

    expect(result.isError).not.toBe(true)
    expect(result.structuredContent).toEqual({ project, tasks: [task] })
    expect(repository.getProject).toHaveBeenCalledWith(project.id)
  })

  it('creates a nested project folder with validated arguments', async () => {
    const result = await client.callTool({
      name: 'create_project_folder',
      arguments: {
        name: 'MCP',
        parent_id: 'folder-parent',
        color: 'bg-fuchsia-600',
      },
    })

    expect(result.isError).not.toBe(true)
    expect(repository.createFolder).toHaveBeenCalledWith({
      name: 'MCP',
      description: undefined,
      color: 'bg-fuchsia-600',
      parentId: 'folder-parent',
    })
    expect(result.structuredContent).toEqual({
      folder: {
        id: folder.id,
        name: folder.name,
        description: folder.description,
        color: folder.color,
        createdAt: folder.createdAt,
      },
    })
  })
})
