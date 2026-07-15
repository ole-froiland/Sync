import type { ProjectFolder, ProjectItem } from '@/types'

export type FolderReorderPlacement = 'before' | 'after'

export type ProjectItemDeleteRequest = {
  folderId: string
  itemId: string
}

function matchesItem(item: ProjectItem, query: string) {
  return `${item.title} ${item.body} ${item.url ?? ''} ${item.path ?? ''}`.toLowerCase().includes(query)
}

/** Returns everything shown at one folder level without hiding direct resources. */
export function filterProjectFolderLevel(
  folders: ProjectFolder[],
  parentId: string | null,
  search: string
) {
  const query = search.trim().toLowerCase()
  const parent = parentId ? folders.find((folder) => folder.id === parentId) ?? null : null
  const directItems = parent?.items.filter((item) => !item.parentId) ?? []

  const visibleFolders = folders.filter((folder) => {
    if ((folder.parentId ?? null) !== parentId) return false
    if (!query) return true
    if (`${folder.name} ${folder.description}`.toLowerCase().includes(query)) return true
    const itemText = folder.items
      .map((item) => `${item.title} ${item.body} ${item.url ?? ''} ${item.path ?? ''}`)
      .join(' ')
      .toLowerCase()
    return itemText.includes(query)
  })

  return {
    folders: visibleFolders,
    items: query ? directItems.filter((item) => matchesItem(item, query)) : directItems,
  }
}

export function resolveProjectItemDeleteRequest(
  folders: ProjectFolder[],
  request: ProjectItemDeleteRequest | null
) {
  if (!request) return null
  const folder = folders.find((candidate) => candidate.id === request.folderId)
  const item = folder?.items.find((candidate) => candidate.id === request.itemId)
  return folder && item ? { folder, item } : null
}

/** Reorders two folders that share a parent without changing their hierarchy. */
export function reorderSiblingFolder(
  folders: ProjectFolder[],
  folderId: string,
  targetFolderId: string,
  placement: FolderReorderPlacement
) {
  if (folderId === targetFolderId) return folders

  const folder = folders.find((candidate) => candidate.id === folderId)
  const target = folders.find((candidate) => candidate.id === targetFolderId)
  if (!folder || !target || (folder.parentId ?? null) !== (target.parentId ?? null)) return folders

  const withoutFolder = folders.filter((candidate) => candidate.id !== folderId)
  const targetIndex = withoutFolder.findIndex((candidate) => candidate.id === targetFolderId)
  if (targetIndex < 0) return folders

  const insertionIndex = targetIndex + (placement === 'after' ? 1 : 0)
  const reordered = [...withoutFolder]
  reordered.splice(insertionIndex, 0, folder)

  return reordered.every((candidate, index) => candidate === folders[index]) ? folders : reordered
}
