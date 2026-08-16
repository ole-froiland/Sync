import { describe, expect, it } from 'vitest'
import type { ProjectFolder } from '@/types'
import {
  collaborationFingerprint,
  collaborationSnapshot,
  extractProjectFolderTree,
  mergeProjectFolderCollaborations,
  personalProjectFolders,
  type ProjectFolderCollaboration,
} from './project-folder-collaboration'

function folder(id: string, parentId?: string): ProjectFolder {
  return {
    id,
    name: id,
    description: '',
    color: 'bg-fuchsia-600',
    parentId,
    createdAt: '2026-07-21T00:00:00.000Z',
    items: [],
  }
}

function collaboration(folders: ProjectFolder[]): ProjectFolderCollaboration {
  return {
    id: 'collaboration-1',
    ownerId: 'owner-1',
    rootFolderId: 'shared-root',
    folders,
    updatedAt: '2026-07-21T00:00:00.000Z',
    members: [],
  }
}

describe('project folder collaboration trees', () => {
  it('shares the selected folder and all nested folders, but not siblings', () => {
    const folders = [
      folder('other-root'),
      folder('shared-root'),
      folder('child', 'shared-root'),
      folder('grandchild', 'child'),
      folder('other-child', 'other-root'),
    ]

    expect(extractProjectFolderTree(folders, 'shared-root').map((item) => item.id)).toEqual([
      'shared-root',
      'child',
      'grandchild',
    ])
  })

  it('replaces a cached shared tree with new server-side subfolders', () => {
    const cachedRoot = {
      ...folder('shared-root'),
      collaborationId: 'collaboration-1',
      collaborationOwnerId: 'owner-1',
      collaborationRootId: 'shared-root',
    }
    const latest = collaboration([folder('shared-root'), folder('new-child', 'shared-root')])

    const merged = mergeProjectFolderCollaborations([folder('private'), cachedRoot], [latest])

    expect(merged.map((item) => item.id)).toEqual(['private', 'shared-root', 'new-child'])
    expect(merged[2].collaborationId).toBe('collaboration-1')
  })

  it('keeps owned shared folders in private state but excludes received collaborations', () => {
    const folders = [folder('private'), folder('shared-root'), folder('child', 'shared-root')]
    const shared = collaboration([folder('shared-root'), folder('child', 'shared-root')])

    expect(personalProjectFolders(folders, [shared], 'member-1').map((item) => item.id)).toEqual(['private'])
    expect(personalProjectFolders(folders, [shared], 'owner-1').map((item) => item.id)).toEqual([
      'private',
      'shared-root',
      'child',
    ])
  })

  it('does not persist a cached received collaboration before server hydration finishes', () => {
    const received = {
      ...folder('shared-root'),
      collaborationId: 'collaboration-1',
      collaborationOwnerId: 'owner-1',
      collaborationRootId: 'shared-root',
    }

    expect(personalProjectFolders([folder('private'), received], [], 'member-1').map((item) => item.id)).toEqual([
      'private',
    ])
  })

  it('strips collaboration metadata from server snapshots', () => {
    const root = {
      ...folder('shared-root'),
      collaborationId: 'collaboration-1',
      collaborationOwnerId: 'owner-1',
      collaborationRootId: 'shared-root',
    }

    expect(collaborationSnapshot([root], 'shared-root')[0]).not.toHaveProperty('collaborationId')
  })
})

describe('collaboration fingerprint', () => {
  it('stays the same when nothing changed, regardless of row order', () => {
    const rows = [
      { id: 'b', updated_at: '2026-08-16T10:00:00Z' },
      { id: 'a', updated_at: '2026-08-15T09:00:00Z' },
    ]
    expect(collaborationFingerprint(rows)).toBe(collaborationFingerprint([...rows].reverse()))
  })

  it('changes when a folder tree is touched, added or removed', () => {
    const base = [{ id: 'a', updated_at: '2026-08-15T09:00:00Z' }]
    const touched = [{ id: 'a', updated_at: '2026-08-16T09:00:00Z' }]
    const added = [...base, { id: 'b', updated_at: '2026-08-16T10:00:00Z' }]

    expect(collaborationFingerprint(touched)).not.toBe(collaborationFingerprint(base))
    expect(collaborationFingerprint(added)).not.toBe(collaborationFingerprint(base))
    expect(collaborationFingerprint([])).not.toBe(collaborationFingerprint(base))
  })
})
