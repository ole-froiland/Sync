import type { ProjectFolder, ProjectItem } from '@/types'

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
