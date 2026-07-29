import { describe, expect, it } from 'vitest'
import type { ProjectFolder } from '@/types'
import {
  filterProjectFolderLevel,
  filterProjectTreeForSearch,
  reorderSiblingFolder,
  resolveProjectItemDeleteRequest,
  searchProjectContent,
} from './project-folder-view'

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

describe('searchProjectContent', () => {
  const folders: ProjectFolder[] = [
    {
      ...folder('product'),
      name: 'Produktlansering',
      description: 'Plan for høsten',
      items: [
        {
          id: 'brief',
          type: 'docs',
          title: 'Kreativ brief',
          body: 'Design og budskap',
          url: 'https://docs.google.com/document/d/brief',
          createdAt: '2026-01-01',
        },
        {
          id: 'campaign',
          type: 'link',
          title: 'Kampanjeside',
          body: '',
          url: 'https://example.com/summer-campaign',
          createdAt: '2026-01-01',
        },
        {
          id: 'upload',
          type: 'document',
          title: 'Opplastet kvittering',
          body: '',
          fileName: 'kvittering.pdf',
          url: 'data:application/pdf;base64,hemmelig-innhold-skal-ikke-indekseres',
          createdAt: '2026-01-01',
        },
      ],
    },
    {
      ...folder('assets', 'product'),
      name: 'Grafisk materiell',
      description: '',
      items: [
        {
          id: 'logo',
          type: 'document',
          title: 'Primærlogo',
          body: '',
          fileName: 'sync-logo.svg',
          path: '/design/brand',
          createdAt: '2026-01-01',
        },
      ],
    },
  ]

  it('searches all folders and resources globally with their project path', () => {
    const [result] = searchProjectContent(folders, 'sync-logo.svg')

    expect(result).toMatchObject({
      kind: 'item',
      folder: { id: 'assets' },
      item: { id: 'logo' },
    })
    expect(result.path.map((part) => part.id)).toEqual(['product', 'assets'])
  })

  it('finds documents and links by type, URL, and multiple terms regardless of accents or case', () => {
    expect(searchProjectContent(folders, 'DOKUMENT kreativ').map((result) => result.kind === 'item' && result.item.id))
      .toEqual(['brief'])
    expect(searchProjectContent(folders, 'example summer').map((result) => result.kind === 'item' && result.item.id))
      .toEqual(['campaign'])
    expect(searchProjectContent(folders, 'hosten produkt').map((result) => result.kind === 'folder' && result.folder.id))
      .toEqual(['product'])
  })

  it('returns no results for an empty query', () => {
    expect(searchProjectContent(folders, '   ')).toEqual([])
  })

  it('does not index large data URLs, but still searches their file name', () => {
    expect(searchProjectContent(folders, 'hemmelig-innhold')).toEqual([])
    expect(searchProjectContent(folders, 'kvittering.pdf')).toMatchObject([
      { kind: 'item', item: { id: 'upload' } },
    ])
  })
})

describe('filterProjectTreeForSearch', () => {
  const matchingItem = {
    id: 'roadmap',
    type: 'docs' as const,
    title: 'Roadmap 2027',
    body: '',
    createdAt: '2026-01-01',
  }
  const unrelatedItem = {
    id: 'notes',
    type: 'note' as const,
    title: 'Møtenotater',
    body: '',
    createdAt: '2026-01-01',
  }
  const folders = [
    folder('root'),
    folder('child', 'root'),
    folder('target', 'child', [matchingItem, unrelatedItem]),
    folder('unrelated'),
  ]

  it('keeps matching nodes and their ancestor path while removing unrelated branches and resources', () => {
    const filtered = filterProjectTreeForSearch(folders, 'roadmap')

    expect(filtered.map((item) => item.id)).toEqual(['root', 'child', 'target'])
    expect(filtered.find((item) => item.id === 'target')?.items.map((item) => item.id)).toEqual(['roadmap'])
    expect(folders.find((item) => item.id === 'target')?.items.map((item) => item.id)).toEqual([
      'roadmap',
      'notes',
    ])
  })

  it('returns the original tree when the query is empty', () => {
    expect(filterProjectTreeForSearch(folders, '')).toBe(folders)
  })

  it('promotes an orphaned matching branch to the visible tree root', () => {
    const orphan = folder('orphan', 'missing-parent', [matchingItem])
    const [filteredOrphan] = filterProjectTreeForSearch([orphan], 'roadmap')

    expect(filteredOrphan.parentId).toBeUndefined()
  })
})

describe('reorderSiblingFolder', () => {
  it('moves a folder before or after a sibling', () => {
    const folders = [folder('a'), folder('b'), folder('c')]

    expect(reorderSiblingFolder(folders, 'c', 'a', 'before').map((item) => item.id)).toEqual(['c', 'a', 'b'])
    expect(reorderSiblingFolder(folders, 'a', 'c', 'after').map((item) => item.id)).toEqual(['b', 'c', 'a'])
  })

  it('does not reorder folders from different parents', () => {
    const folders = [folder('a'), folder('child', 'a'), folder('b')]

    expect(reorderSiblingFolder(folders, 'child', 'b', 'before')).toBe(folders)
  })

  it('keeps the same array when the requested order is already in place', () => {
    const folders = [folder('a'), folder('b')]

    expect(reorderSiblingFolder(folders, 'a', 'b', 'before')).toBe(folders)
  })
})

describe('resolveProjectItemDeleteRequest', () => {
  it('finds an item in its own folder even when another folder is open', () => {
    const image = { id: 'image', type: 'file' as const, title: 'Bilde', body: '', createdAt: '2026-01-01' }
    const folders = [folder('open-folder'), folder('tree-folder', undefined, [image])]

    expect(resolveProjectItemDeleteRequest(folders, { folderId: 'tree-folder', itemId: 'image' })).toEqual({
      folder: folders[1],
      item: image,
    })
  })

  it('returns null for stale or missing requests', () => {
    const folders = [folder('folder')]

    expect(resolveProjectItemDeleteRequest(folders, null)).toBeNull()
    expect(resolveProjectItemDeleteRequest(folders, { folderId: 'folder', itemId: 'missing' })).toBeNull()
  })
})
