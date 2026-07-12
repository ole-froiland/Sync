import { describe, expect, it } from 'vitest'
import type { ProjectFolder } from '@/types'
import { filterProjectFolderLevel } from './project-folder-view'

function folder(id: string, parentId?: string, items: ProjectFolder['items'] = []): ProjectFolder {
  return { id, name: id, description: '', color: 'bg-fuchsia-600', parentId, createdAt: '2026-01-01', items }
}

describe('filterProjectFolderLevel', () => {
  const document = { id: 'doc', type: 'docs' as const, title: 'Plan', body: '', createdAt: '2026-01-01' }
  const nestedDocument = { ...document, id: 'nested', title: 'Skjult', parentId: 'local-folder' }
  const folders = [folder('parent', undefined, [document, nestedDocument]), folder('child', 'parent')]

  it('returns both child folders and direct resources for the active folder', () => {
    const level = filterProjectFolderLevel(folders, 'parent', '')
    expect(level.folders.map((item) => item.id)).toEqual(['child'])
    expect(level.items.map((item) => item.id)).toEqual(['doc'])
  })

  it('filters visible resources without exposing items nested in local folders', () => {
    expect(filterProjectFolderLevel(folders, 'parent', 'plan').items.map((item) => item.id)).toEqual(['doc'])
    expect(filterProjectFolderLevel(folders, 'parent', 'skjult').items).toEqual([])
  })
})
