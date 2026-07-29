import type { ProjectFolder, ProjectItem } from '@/types'

export type FolderReorderPlacement = 'before' | 'after'

export type ProjectItemDeleteRequest = {
  folderId: string
  itemId: string
}

export type ProjectSearchResult =
  | {
      kind: 'folder'
      folder: ProjectFolder
      path: ProjectFolder[]
    }
  | {
      kind: 'item'
      folder: ProjectFolder
      item: ProjectItem
      path: ProjectFolder[]
    }

const PROJECT_ITEM_SEARCH_TERMS: Record<ProjectItem['type'], string> = {
  note: 'note notes notat notater',
  link: 'link links lenke lenker url',
  file: 'file files fil filer',
  task: 'task tasks oppgave oppgaver',
  docs: 'google docs document documents dokument dokumenter',
  sheets: 'google sheets spreadsheet spreadsheets regneark',
  word: 'microsoft word document documents dokument dokumenter',
  excel: 'microsoft excel spreadsheet spreadsheets regneark',
  folder: 'folder folders mappe mapper',
  github: 'github repository repositories repo repoer',
  local_folder: 'local folder folders lokal mappe mapper',
  notion: 'notion page pages side sider document dokument',
  url: 'url link links lenke lenker website nettside',
  document: 'document documents dokument dokumenter file fil',
}

function normalizeProjectSearchText(value: string) {
  return value
    .toLocaleLowerCase('nb-NO')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
}

function projectSearchTerms(search: string) {
  return normalizeProjectSearchText(search).trim().split(/\s+/).filter(Boolean)
}

function matchesProjectSearch(value: string, terms: string[]) {
  if (terms.length === 0) return true
  const normalized = normalizeProjectSearchText(value)
  return terms.every((term) => normalized.includes(term))
}

function projectItemSearchText(item: ProjectItem) {
  return [
    item.title,
    item.body,
    item.url?.startsWith('data:') ? undefined : item.url,
    item.path,
    item.fileName,
    item.status,
    PROJECT_ITEM_SEARCH_TERMS[item.type],
  ]
    .filter(Boolean)
    .join(' ')
}

function projectFolderPath(
  folder: ProjectFolder,
  foldersById: ReadonlyMap<string, ProjectFolder>
) {
  const path: ProjectFolder[] = []
  const seen = new Set<string>()
  let current: ProjectFolder | undefined = folder

  while (current && !seen.has(current.id)) {
    path.unshift(current)
    seen.add(current.id)
    current = current.parentId ? foldersById.get(current.parentId) : undefined
  }

  return path
}

function matchesItem(item: ProjectItem, terms: string[]) {
  return matchesProjectSearch(projectItemSearchText(item), terms)
}

/** Searches every project folder and resource, independent of the currently open level. */
export function searchProjectContent(folders: ProjectFolder[], search: string): ProjectSearchResult[] {
  const terms = projectSearchTerms(search)
  if (terms.length === 0) return []

  const foldersById = new Map(folders.map((folder) => [folder.id, folder]))
  const results: ProjectSearchResult[] = []

  for (const folder of folders) {
    const path = projectFolderPath(folder, foldersById)
    const pathText = path.map((part) => part.name).join(' ')
    const folderKind = folder.parentId
      ? 'folder folders mappe mapper subfolder undermappe'
      : 'project projects prosjekt prosjekter folder mappe'

    if (matchesProjectSearch(`${pathText} ${folder.description} ${folderKind}`, terms)) {
      results.push({ kind: 'folder', folder, path })
    }

    for (const item of folder.items) {
      if (matchesProjectSearch(`${pathText} ${projectItemSearchText(item)}`, terms)) {
        results.push({ kind: 'item', folder, item, path })
      }
    }
  }

  return results
}

/**
 * Keeps only matching tree nodes/resources plus the ancestor folders needed to
 * preserve their visible path from the root.
 */
export function filterProjectTreeForSearch(folders: ProjectFolder[], search: string) {
  if (projectSearchTerms(search).length === 0) return folders

  const results = searchProjectContent(folders, search)
  const visibleFolderIds = new Set<string>()
  const visibleItemIdsByFolder = new Map<string, Set<string>>()
  const visibleParentIds = new Map<string, string | undefined>()

  for (const result of results) {
    result.path.forEach((pathFolder, index) => {
      visibleFolderIds.add(pathFolder.id)
      if (!visibleParentIds.has(pathFolder.id)) {
        visibleParentIds.set(pathFolder.id, result.path[index - 1]?.id)
      }
    })
    if (result.kind === 'item') {
      const itemIds = visibleItemIdsByFolder.get(result.folder.id) ?? new Set<string>()
      itemIds.add(result.item.id)
      visibleItemIdsByFolder.set(result.folder.id, itemIds)
    }
  }

  return folders
    .filter((folder) => visibleFolderIds.has(folder.id))
    .map((folder) => ({
      ...folder,
      items: folder.items.filter((item) => visibleItemIdsByFolder.get(folder.id)?.has(item.id)),
      parentId: visibleParentIds.get(folder.id),
    }))
}

/** Returns everything shown at one folder level without hiding direct resources. */
export function filterProjectFolderLevel(
  folders: ProjectFolder[],
  parentId: string | null,
  search: string
) {
  const terms = projectSearchTerms(search)
  const parent = parentId ? folders.find((folder) => folder.id === parentId) ?? null : null
  const directItems = parent?.items.filter((item) => !item.parentId) ?? []

  const visibleFolders = folders.filter((folder) => {
    if ((folder.parentId ?? null) !== parentId) return false
    if (terms.length === 0) return true
    if (matchesProjectSearch(`${folder.name} ${folder.description}`, terms)) return true
    return folder.items.some((item) => matchesItem(item, terms))
  })

  return {
    folders: visibleFolders,
    items: terms.length > 0 ? directItems.filter((item) => matchesItem(item, terms)) : directItems,
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
