'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CheckSquare,
  Eye,
  FilePenLine,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderGit2,
  FolderPlus,
  FolderOpen,
  Globe2,
  Image as ImageIcon,
  Link2,
  PanelsTopLeft,
  Plus,
  Search,
  StickyNote,
  Upload,
  X,
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'
import type { GitHubUserRepo } from '@/types'

type ProjectFolder = {
  id: string
  name: string
  description: string
  color: string
  logo?: ProjectLogo
  createdAt: string
  items: ProjectItem[]
}

type ProjectLogo = {
  type: 'icon' | 'emoji' | 'image'
  value: string
}

type ProjectItem = {
  id: string
  type:
    | 'note'
    | 'link'
    | 'file'
    | 'task'
    | 'docs'
    | 'sheets'
    | 'word'
    | 'excel'
    | 'folder'
    | 'github'
    | 'local_folder'
    | 'notion'
    | 'url'
    | 'document'
  title: string
  body: string
  url?: string
  path?: string
  fileName?: string
  fileSize?: number
  parentId?: string
  done?: boolean
  status?: string
  createdAt: string
  updatedAt?: string
}

type ItemType = ProjectItem['type']
type ResourceMode = 'github' | 'url' | 'document' | 'app'
type AppResourceType = 'notion' | 'docs' | 'sheets' | 'word' | 'excel'
type ProjectClipboard = { mode: 'copy' | 'cut'; itemIds: string[] } | null

const STORAGE_KEY = 'sync-project-folders-v1'

const folderColors = [
  { label: 'Purple', value: 'from-purple-500 to-fuchsia-500' },
  { label: 'Blue', value: 'from-blue-500 to-cyan-400' },
  { label: 'Green', value: 'from-emerald-500 to-lime-400' },
  { label: 'Orange', value: 'from-orange-500 to-amber-300' },
  { label: 'Red', value: 'from-rose-500 to-red-400' },
]

const logoPresets: ProjectLogo[] = [
  { type: 'icon', value: 'folder' },
  { type: 'emoji', value: '🚀' },
  { type: 'emoji', value: '✨' },
  { type: 'emoji', value: '🧠' },
  { type: 'emoji', value: '🛠️' },
  { type: 'emoji', value: '📦' },
]

const itemTypeMeta: Record<ItemType, { label: string; icon: React.ElementType }> = {
  note: { label: 'Notat', icon: StickyNote },
  link: { label: 'Lenke', icon: Link2 },
  file: { label: 'Fil', icon: Upload },
  task: { label: 'Oppgave', icon: CheckSquare },
  github: { label: 'GitHub repo', icon: FolderGit2 },
  local_folder: { label: 'Lokal mappe', icon: FolderOpen },
  notion: { label: 'Notion', icon: PanelsTopLeft },
  url: { label: 'URL', icon: Globe2 },
  document: { label: 'Dokument', icon: FileIcon },
  docs: { label: 'Google Docs', icon: FilePenLine },
  sheets: { label: 'Google Sheets', icon: FileSpreadsheet },
  word: { label: 'Word', icon: FilePenLine },
  excel: { label: 'Excel', icon: FileSpreadsheet },
  folder: { label: 'Mappe', icon: FolderPlus },
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function projectLogo(folder: ProjectFolder): ProjectLogo {
  return folder.logo ?? { type: 'icon', value: 'folder' }
}

export default function ProjectsPage() {
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [folderOpen, setFolderOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [localFolderOpen, setLocalFolderOpen] = useState(false)
  const [activeItemFolderId, setActiveItemFolderId] = useState<string | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [clipboard, setClipboard] = useState<ProjectClipboard>(null)
  const [search, setSearch] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const [previewFolderId, setPreviewFolderId] = useState<string | null>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    window.setTimeout(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as ProjectFolder[]
          setFolders(parsed)
          setSelectedFolderId(null)
        } catch {
          window.localStorage.removeItem(STORAGE_KEY)
        }
      }
      loadedRef.current = true
    }, 0)
  }, [])

  useEffect(() => {
    if (loadedRef.current) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(folders))
  }, [folders])

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null
  const activeItemFolder =
    selectedFolder?.items.find((item) => item.id === activeItemFolderId && item.type === 'local_folder') ?? null

  const visibleFolders = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return folders
    return folders.filter((folder) => {
      const folderText = `${folder.name} ${folder.description}`.toLowerCase()
      const itemText = folder.items
        .map((item) => `${item.title} ${item.body} ${item.url ?? ''} ${item.path ?? ''}`)
        .join(' ')
        .toLowerCase()
      return folderText.includes(query) || itemText.includes(query)
    })
  }, [folders, search])

  const previewFolder =
    visibleFolders.find((folder) => folder.id === previewFolderId) ?? visibleFolders[0] ?? null

  function createFolder(folder: Pick<ProjectFolder, 'name' | 'description' | 'color' | 'logo'>) {
    const nextFolder: ProjectFolder = {
      ...folder,
      id: makeId('folder'),
      createdAt: new Date().toISOString(),
      items: [],
    }
    setFolders((current) => [nextFolder, ...current])
    setSelectedFolderId(nextFolder.id)
  }

  function updateFolder(folderId: string, updates: Partial<Pick<ProjectFolder, 'name' | 'description' | 'logo' | 'color'>>) {
    setFolders((current) =>
      current.map((folder) => (folder.id === folderId ? { ...folder, ...updates } : folder))
    )
  }

  function createItem(item: Omit<ProjectItem, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!selectedFolder) return
    const nextItem: ProjectItem = {
      ...item,
      id: makeId('item'),
      parentId: activeItemFolderId ?? undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setFolders((current) =>
      current.map((folder) =>
        folder.id === selectedFolder.id ? { ...folder, items: [nextItem, ...folder.items] } : folder
      )
    )
    setSelectedItemIds([nextItem.id])
  }

  function toggleTask(itemId: string) {
    if (!selectedFolder) return
    setFolders((current) =>
      current.map((folder) =>
        folder.id === selectedFolder.id
          ? {
              ...folder,
              items: folder.items.map((item) =>
                item.id === itemId ? { ...item, done: !item.done } : item
              ),
            }
          : folder
      )
    )
  }

  function removeItem(itemId: string) {
    if (!selectedFolder) return
    setFolders((current) =>
      current.map((folder) =>
        folder.id === selectedFolder.id
          ? { ...folder, items: folder.items.filter((item) => item.id !== itemId && item.parentId !== itemId) }
          : folder
      )
    )
    if (activeItemFolderId === itemId) setActiveItemFolderId(null)
    setSelectedItemIds((current) => current.filter((id) => id !== itemId))
  }

  function moveItemsToFolder(itemIds: string[], targetFolderId: string) {
    if (!selectedFolder) return
    const target = selectedFolder.items.find((item) => item.id === targetFolderId)
    if (target?.type !== 'local_folder') return
    const movableIds = itemIds.filter((itemId) => itemId !== targetFolderId)
    if (movableIds.length === 0) return

    setFolders((current) =>
      current.map((folder) =>
        folder.id === selectedFolder.id
          ? {
              ...folder,
              items: folder.items.map((item) =>
                movableIds.includes(item.id)
                  ? { ...item, parentId: targetFolderId, updatedAt: new Date().toISOString() }
                  : item
              ),
            }
          : folder
      )
    )
    setSelectedItemIds(movableIds)
  }

  function copyItemsToFolder(itemIds: string[], targetFolderId: string | null) {
    if (!selectedFolder || itemIds.length === 0) return
    const sourceItems = selectedFolder.items
    const selected = new Set(itemIds)
    const itemsToCopy = sourceItems.filter((item) => {
      if (selected.has(item.id)) return true
      let parentId = item.parentId
      while (parentId) {
        if (selected.has(parentId)) return true
        parentId = sourceItems.find((candidate) => candidate.id === parentId)?.parentId
      }
      return false
    })
    if (itemsToCopy.length === 0) return

    const idMap = new Map(itemsToCopy.map((item) => [item.id, makeId('item')]))
    const now = new Date().toISOString()
    const copies = itemsToCopy.map((item) => {
      const copiedParentId = item.parentId ? idMap.get(item.parentId) : undefined
      const copiedId = idMap.get(item.id) ?? makeId('item')
      return {
        ...item,
        id: copiedId,
        parentId: copiedParentId ?? targetFolderId ?? undefined,
        title: selected.has(item.id) ? `${item.title} copy` : item.title,
        createdAt: now,
        updatedAt: now,
      }
    })

    setFolders((current) =>
      current.map((folder) =>
        folder.id === selectedFolder.id ? { ...folder, items: [...copies, ...folder.items] } : folder
      )
    )
    setSelectedItemIds(itemIds.map((itemId) => idMap.get(itemId)).filter(Boolean) as string[])
  }

  function pasteItems(targetFolderId: string | null) {
    if (!clipboard) return
    if (clipboard.mode === 'cut') {
      if (targetFolderId) moveItemsToFolder(clipboard.itemIds, targetFolderId)
      else {
        setFolders((current) =>
          current.map((folder) =>
            folder.id === selectedFolder?.id
              ? {
                  ...folder,
                  items: folder.items.map((item) =>
                    clipboard.itemIds.includes(item.id)
                      ? { ...item, parentId: undefined, updatedAt: new Date().toISOString() }
                      : item
                  ),
                }
              : folder
          )
        )
        setSelectedItemIds(clipboard.itemIds)
      }
      setClipboard(null)
      return
    }
    copyItemsToFolder(clipboard.itemIds, targetFolderId)
  }

  if (selectedFolder) {
    return (
      <>
        <TopBar
          title={selectedFolder.name}
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setLocalFolderOpen(true)}>
                <FolderOpen size={16} />
                Add mappe
              </Button>
              <Button size="sm" onClick={() => setItemOpen(true)}>
                <Plus size={16} />
                Add Resource
              </Button>
            </div>
          }
        />

        <div className="flex-1 overflow-y-auto px-6 py-8">
          <button
            onClick={() => {
              setSelectedFolderId(null)
              setActiveItemFolderId(null)
              setSelectedItemIds([])
              setClipboard(null)
              setItemOpen(false)
              setLocalFolderOpen(false)
            }}
            className="mb-6 inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <ArrowLeft size={16} />
            Tilbake til prosjektmapper
          </button>

          <main className="min-h-[64vh] rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <ProjectDetailContent
              folder={selectedFolder}
              activeItemFolder={activeItemFolder}
              selectedItemIds={selectedItemIds}
              cutItemIds={clipboard?.mode === 'cut' ? clipboard.itemIds : []}
              onAddResource={() => setItemOpen(true)}
              onAddLocalFolder={() => setLocalFolderOpen(true)}
              onUpdate={updateFolder}
              onToggleTask={toggleTask}
              onRemoveItem={removeItem}
              onOpenItemFolder={(itemId) => {
                setActiveItemFolderId(itemId)
                setSelectedItemIds([])
              }}
              onMoveItemsToFolder={moveItemsToFolder}
              onSelectItems={setSelectedItemIds}
              onCopyItems={(itemIds) => setClipboard({ mode: 'copy', itemIds })}
              onCutItems={(itemIds) => setClipboard({ mode: 'cut', itemIds })}
              onPasteItems={pasteItems}
            />
          </main>
        </div>

        <CreateItemModal open={itemOpen} onClose={() => setItemOpen(false)} onCreate={createItem} />
        <CreateLocalFolderModal
          open={localFolderOpen}
          onClose={() => setLocalFolderOpen(false)}
          onCreate={createItem}
        />
      </>
    )
  }

  return (
    <>
      <TopBar
        title="Projects"
        actions={
          <Button size="sm" onClick={() => setFolderOpen(true)} className="h-10 w-10 px-0" aria-label="Lag prosjektmappe">
            <Plus size={20} />
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="mb-7 flex flex-col gap-4">
              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                <div className="relative w-full lg:w-80">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Søk i prosjektmapper"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-purple-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPreviewMode((current) => !current)}
                  className={`h-10 whitespace-nowrap ${
                    previewMode
                      ? 'border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950/30 dark:text-purple-200'
                      : ''
                  }`}
                >
                  <Eye size={16} />
                  Preview
                </Button>
                <Button onClick={() => setFolderOpen(true)} className="h-10 whitespace-nowrap">
                  <Plus size={16} />
                  Ny mappe
                </Button>
              </div>
            </div>

            {folders.length === 0 ? (
              <div className="flex min-h-[52vh] flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 text-center dark:border-gray-800 dark:bg-gray-900/30">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300">
                  <Plus size={34} />
                </div>
                <h2 className="text-lg font-semibold text-gray-950 dark:text-gray-100">Ingen prosjekter enda</h2>
                <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
                  Start med en prosjektmappe. Etterpå kan du legge inn hva du vil samle for prosjektet.
                </p>
                <Button className="mt-5" onClick={() => setFolderOpen(true)}>
                  <Plus size={18} />
                  Lag prosjektmappe
                </Button>
              </div>
            ) : previewMode ? (
              <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
                <aside className="space-y-3">
                  {visibleFolders.map((folder) => {
                    const active = folder.id === previewFolder?.id

                    return (
                      <button
                        key={folder.id}
                        onClick={() => setPreviewFolderId(folder.id)}
                        onDoubleClick={() => setSelectedFolderId(folder.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') setPreviewFolderId(folder.id)
                        }}
                        className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                          active
                            ? 'border-purple-400 bg-purple-50 shadow-sm dark:border-purple-700 dark:bg-purple-950/30'
                            : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700'
                        }`}
                      >
                        <ProjectLogoThumbnail folder={folder} className="h-9 w-9" iconSize={18} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-950 dark:text-gray-100">{folder.name}</span>
                        </span>
                      </button>
                    )
                  })}
                </aside>

                <main className="min-h-[56vh] rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                  {previewFolder ? (
                    <>
                      <div className="flex flex-col gap-4 border-b border-gray-200 p-5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <ProjectLogoThumbnail folder={previewFolder} className="h-10 w-10" iconSize={21} open />
                          <div className="min-w-0">
                            <h2 className="truncate text-xl font-semibold text-gray-950 dark:text-gray-100">{previewFolder.name}</h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{previewFolder.description || 'Ingen beskrivelse'}</p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => setSelectedFolderId(previewFolder.id)}>
                          <FolderOpen size={16} />
                          Åpne mappe
                        </Button>
                      </div>

                      {previewFolder.items.length === 0 ? (
                        <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
                          <FileText size={38} className="mb-4 text-gray-300 dark:text-gray-700" />
                          <h2 className="font-medium text-gray-950 dark:text-gray-100">Mappen er tom</h2>
                          <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                            Legg inn notater, lenker, filer eller oppgaver når du vil samle noe for prosjektet.
                          </p>
                        </div>
                      ) : (
                        <div className="grid gap-3 p-5 lg:grid-cols-2">
                          {previewFolder.items.map((item) => (
                            <ProjectItemPreviewCard key={item.id} item={item} />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex min-h-[56vh] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                      Ingen prosjekter å forhåndsvise.
                    </div>
                  )}
                </main>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    onDoubleClick={() => setSelectedFolderId(folder.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') setSelectedFolderId(folder.id)
                    }}
                    className="group flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left transition hover:border-purple-400 hover:bg-purple-50/60 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-purple-700 dark:hover:bg-purple-950/20"
                  >
                    <ProjectLogoThumbnail folder={folder} className="h-9 w-9" iconSize={18} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-950 dark:text-gray-100">{folder.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
      </div>

      <CreateFolderModal open={folderOpen} onClose={() => setFolderOpen(false)} onCreate={createFolder} />
      <CreateItemModal open={itemOpen} onClose={() => setItemOpen(false)} onCreate={createItem} />
    </>
  )
}

function projectItemTypeLabel(item: ProjectItem) {
  const meta = itemTypeMeta[item.type]
  if (item.type === 'github') return 'Repo'
  if (item.type === 'docs') return 'Docs'
  if (item.type === 'sheets') return 'Sheets'
  if (item.type === 'notion') return 'Notion'
  if (item.type === 'word') return 'Word'
  if (item.type === 'excel') return 'Excel'
  if (item.type === 'url') return 'URL'
  if (item.type === 'document') return 'Document'
  if (item.type === 'local_folder') return 'Folder'
  return meta.label
}

function ProjectItemCard({
  item,
  selected,
  cut,
  onToggle,
  onRemove,
  onSelect,
  onOpenFolder,
  onDragItems,
  onMoveToFolder,
}: {
  item: ProjectItem
  selected: boolean
  cut: boolean
  onToggle: (itemId: string) => void
  onRemove: (itemId: string) => void
  onSelect: (itemId: string, event: React.MouseEvent<HTMLElement>) => void
  onOpenFolder: (itemId: string) => void
  onDragItems: (itemId: string) => string[]
  onMoveToFolder: (itemIds: string[], targetFolderId: string) => void
}) {
  const meta = itemTypeMeta[item.type]
  const Icon = meta.icon
  const isFolder = item.type === 'local_folder'

  function handleDragStart(event: React.DragEvent<HTMLElement>) {
    const draggedIds = onDragItems(item.id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-sync-project-items', JSON.stringify(draggedIds))
    event.dataTransfer.setData('text/plain', item.id)
  }

  function handleDrop(event: React.DragEvent<HTMLElement>) {
    if (!isFolder) return
    event.preventDefault()
    event.stopPropagation()
    const fallback = event.dataTransfer.getData('text/plain')
    let draggedItemIds = fallback ? [fallback] : []
    try {
      const encoded = event.dataTransfer.getData('application/x-sync-project-items')
      if (encoded) draggedItemIds = JSON.parse(encoded) as string[]
    } catch {
      draggedItemIds = fallback ? [fallback] : []
    }
    if (draggedItemIds.length > 0) onMoveToFolder(draggedItemIds, item.id)
  }

  const content = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-purple-600 shadow-sm dark:bg-gray-900 dark:text-purple-300">
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`truncate text-sm font-medium text-gray-950 dark:text-gray-100 ${item.done ? 'line-through opacity-60' : ''}`}>{item.title}</h3>
            <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              {projectItemTypeLabel(item)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {item.type === 'task' && (
          <button
            onClick={(event) => {
              event.stopPropagation()
              onToggle(item.id)
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              item.done
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-gray-300 text-gray-500 hover:bg-white dark:border-gray-700 dark:hover:bg-gray-900'
            }`}
            aria-label="Bytt oppgavestatus"
          >
            <CheckSquare size={16} />
          </button>
        )}
        <button
          onClick={(event) => {
            event.stopPropagation()
            onRemove(item.id)
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white hover:text-red-500 dark:hover:bg-gray-900"
          aria-label="Fjern innhold"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )

  if (isFolder) {
    return (
      <article
        role="button"
        tabIndex={0}
        onClick={(event) => onSelect(item.id, event)}
        onDoubleClick={() => onOpenFolder(item.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onOpenFolder(item.id)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className={`cursor-pointer rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
          selected
            ? 'border-purple-400 bg-purple-50/80 dark:border-purple-700 dark:bg-purple-950/30'
            : 'border-gray-200 bg-gray-50 hover:border-purple-400 hover:bg-purple-50/70 dark:border-gray-800 dark:bg-gray-950/40 dark:hover:border-purple-700 dark:hover:bg-purple-950/20'
        } ${cut ? 'opacity-45' : ''}`}
      >
        {content}
      </article>
    )
  }

  return (
    <article
      draggable
      role="button"
      tabIndex={0}
      onClick={(event) => onSelect(item.id, event)}
      onDragStart={handleDragStart}
      className={`cursor-grab rounded-lg border px-3 py-2.5 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
        selected
          ? 'border-purple-400 bg-purple-50/80 dark:border-purple-700 dark:bg-purple-950/30'
          : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/40'
      } ${cut ? 'opacity-45' : ''}`}
    >
      {content}
    </article>
  )
}

function ProjectLogoThumbnail({
  folder,
  className,
  iconSize = 20,
  open = false,
}: {
  folder: ProjectFolder
  className: string
  iconSize?: number
  open?: boolean
}) {
  const logo = projectLogo(folder)
  const Icon = open ? FolderOpen : Folder

  if (logo.type === 'image') {
    return (
      <span className={`shrink-0 overflow-hidden rounded-lg bg-gray-100 shadow-sm dark:bg-gray-800 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo.value} alt="" className="h-full w-full object-cover" />
      </span>
    )
  }

  if (logo.type === 'emoji') {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${folder.color} text-xl shadow-sm ${className}`}>
        {logo.value}
      </span>
    )
  }

  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${folder.color} text-white shadow-sm ${className}`}>
      <Icon size={iconSize} />
    </span>
  )
}

function ProjectDetailContent({
  folder,
  activeItemFolder,
  selectedItemIds,
  cutItemIds,
  onAddResource,
  onAddLocalFolder,
  onUpdate,
  onToggleTask,
  onRemoveItem,
  onOpenItemFolder,
  onMoveItemsToFolder,
  onSelectItems,
  onCopyItems,
  onCutItems,
  onPasteItems,
}: {
  folder: ProjectFolder
  activeItemFolder: ProjectItem | null
  selectedItemIds: string[]
  cutItemIds: string[]
  onAddResource: () => void
  onAddLocalFolder: () => void
  onUpdate: (folderId: string, updates: Partial<Pick<ProjectFolder, 'name' | 'description' | 'logo' | 'color'>>) => void
  onToggleTask: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
  onOpenItemFolder: (itemId: string | null) => void
  onMoveItemsToFolder: (itemIds: string[], targetFolderId: string) => void
  onSelectItems: (itemIds: string[]) => void
  onCopyItems: (itemIds: string[]) => void
  onCutItems: (itemIds: string[]) => void
  onPasteItems: (targetFolderId: string | null) => void
}) {
  const [logoOpen, setLogoOpen] = useState(false)
  const visibleItems = folder.items.filter((item) => (item.parentId ?? null) === (activeItemFolder?.id ?? null))
  const selectedVisibleIndex = visibleItems.findIndex((item) => selectedItemIds.includes(item.id))

  function selectItem(itemId: string, event?: React.MouseEvent<HTMLElement>) {
    const currentIndex = visibleItems.findIndex((item) => item.id === itemId)
    if (currentIndex < 0) return

    if (event?.shiftKey && selectedVisibleIndex >= 0) {
      const start = Math.min(selectedVisibleIndex, currentIndex)
      const end = Math.max(selectedVisibleIndex, currentIndex)
      onSelectItems(visibleItems.slice(start, end + 1).map((item) => item.id))
      return
    }

    if (event?.metaKey || event?.ctrlKey) {
      onSelectItems(
        selectedItemIds.includes(itemId)
          ? selectedItemIds.filter((id) => id !== itemId)
          : [...selectedItemIds, itemId]
      )
      return
    }

    onSelectItems([itemId])
  }

  function moveSelection(offset: number, extend: boolean) {
    if (visibleItems.length === 0) return
    const currentIndex = selectedVisibleIndex >= 0 ? selectedVisibleIndex : 0
    const nextIndex = Math.max(0, Math.min(visibleItems.length - 1, currentIndex + offset))
    if (!extend) {
      onSelectItems([visibleItems[nextIndex].id])
      return
    }
    const start = Math.min(currentIndex, nextIndex)
    const end = Math.max(currentIndex, nextIndex)
    onSelectItems(visibleItems.slice(start, end + 1).map((item) => item.id))
  }

  function handleExplorerKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    const command = event.metaKey || event.ctrlKey
    const selectedIds = selectedItemIds.filter((id) => visibleItems.some((item) => item.id === id))
    if (command && event.key.toLowerCase() === 'c' && selectedIds.length > 0) {
      event.preventDefault()
      onCopyItems(selectedIds)
      return
    }
    if (command && event.key.toLowerCase() === 'x' && selectedIds.length > 0) {
      event.preventDefault()
      onCutItems(selectedIds)
      return
    }
    if (command && event.key.toLowerCase() === 'v') {
      event.preventDefault()
      onPasteItems(activeItemFolder?.id ?? null)
      return
    }
    if (event.key === 'Enter' && selectedIds.length === 1) {
      const selected = visibleItems.find((item) => item.id === selectedIds[0])
      if (selected?.type === 'local_folder') {
        event.preventDefault()
        onOpenItemFolder(selected.id)
      }
      return
    }
    if (event.key === 'Backspace' && activeItemFolder) {
      event.preventDefault()
      const parentFolder = folder.items.find(
        (item) => item.id === activeItemFolder.parentId && item.type === 'local_folder'
      )
      onOpenItemFolder(parentFolder?.id ?? null)
      return
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      moveSelection(1, event.shiftKey)
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveSelection(-1, event.shiftKey)
    }
  }

  function dragItems(itemId: string) {
    if (!selectedItemIds.includes(itemId)) onSelectItems([itemId])
    return selectedItemIds.includes(itemId) ? selectedItemIds : [itemId]
  }

  return (
    <>
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-gray-800 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setLogoOpen(true)}
            className="rounded-lg outline-none ring-offset-2 transition hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-purple-500 dark:ring-offset-gray-900"
            aria-label="Endre prosjektlogo"
          >
            <ProjectLogoThumbnail folder={folder} className="h-11 w-11" iconSize={22} open />
          </button>
          <div className="min-w-0">
            <EditableProjectName
              name={folder.name}
              onSave={(name) => onUpdate(folder.id, { name })}
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {folder.description || 'Ingen beskrivelse'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onAddLocalFolder}>
            <FolderOpen size={16} />
            Add mappe
          </Button>
          <Button size="sm" onClick={onAddResource}>
            <Plus size={16} />
            Add Resource
          </Button>
        </div>
      </div>

      <section
        className="pt-5 focus-visible:outline-none"
        tabIndex={0}
        onKeyDown={handleExplorerKeyDown}
        onClick={(event) => {
          if (event.currentTarget === event.target) onSelectItems([])
        }}
      >
        {activeItemFolder && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => onOpenItemFolder(null)}
              className="font-medium text-gray-500 transition hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-300"
            >
              {folder.name}
            </button>
            <span className="text-gray-400 dark:text-gray-600">/</span>
            <span className="font-semibold text-gray-950 dark:text-gray-100">{activeItemFolder.title}</span>
          </div>
        )}

        {visibleItems.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/70 px-6 text-center dark:border-gray-800 dark:bg-gray-950/40">
            {activeItemFolder ? (
              <FolderOpen size={38} className="mb-4 text-gray-300 dark:text-gray-700" />
            ) : (
              <FileText size={38} className="mb-4 text-gray-300 dark:text-gray-700" />
            )}
            <h2 className="font-medium text-gray-950 dark:text-gray-100">Mappen er tom</h2>
            <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
              {activeItemFolder
                ? 'Dra inn et repo hit, eller legg til en ressurs mens denne mappen er åpen.'
                : 'Legg til repoer, Notion-sider, mapper, dokumenter eller nyttige lenker.'}
            </p>
            <Button className="mt-5" onClick={onAddResource}>
              <Plus size={16} />
              Add Resource
            </Button>
            <Button className="mt-2" variant="secondary" onClick={onAddLocalFolder}>
              <FolderOpen size={16} />
              Add mappe
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => (
              <ProjectItemCard
                key={item.id}
                item={item}
                selected={selectedItemIds.includes(item.id)}
                cut={cutItemIds.includes(item.id)}
                onToggle={onToggleTask}
                onRemove={onRemoveItem}
                onSelect={selectItem}
                onOpenFolder={onOpenItemFolder}
                onDragItems={dragItems}
                onMoveToFolder={onMoveItemsToFolder}
              />
            ))}
          </div>
        )}
      </section>

      <LogoEditorModal
        key={`${folder.id}-${logoOpen}`}
        open={logoOpen}
        onClose={() => setLogoOpen(false)}
        folder={folder}
        onSave={({ logo, color }) => {
          onUpdate(folder.id, { logo, color })
          setLogoOpen(false)
        }}
      />
    </>
  )
}

function EditableProjectName({
  name,
  onSave,
}: {
  name: string
  onSave: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  function save() {
    const nextName = draft.trim()
    if (nextName && nextName !== name) onSave(nextName)
    if (!nextName) setDraft(name)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === 'Enter') save()
          if (event.key === 'Escape') {
            setDraft(name)
            setEditing(false)
          }
        }}
        className="h-9 max-w-full rounded-lg border border-purple-400 bg-white px-2 text-xl font-semibold text-gray-950 outline-none ring-2 ring-purple-500/20 dark:bg-gray-950 dark:text-gray-100"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(name)
        setEditing(true)
      }}
      className="block max-w-full truncate rounded-md text-left text-xl font-semibold text-gray-950 outline-none transition hover:text-purple-600 focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-gray-100 dark:hover:text-purple-300"
    >
      {name}
    </button>
  )
}

function LogoEditorModal({
  open,
  onClose,
  folder,
  onSave,
}: {
  open: boolean
  onClose: () => void
  folder: ProjectFolder
  onSave: (updates: Pick<ProjectFolder, 'logo' | 'color'>) => void
}) {
  const [logo, setLogo] = useState<ProjectLogo>(projectLogo(folder))
  const [color, setColor] = useState(folder.color)

  function handleLogoUpload(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogo({ type: 'image', value: reader.result })
    }
    reader.readAsDataURL(file)
  }

  return (
    <Modal open={open} onClose={onClose} title="Endre prosjektlogo" className="max-w-md">
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
          <ProjectLogoThumbnail folder={{ ...folder, logo, color }} className="h-14 w-14" iconSize={28} open />
          <div>
            <p className="text-sm font-medium text-gray-950 dark:text-gray-100">Logo i prosjektoversikten</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Velg ikon, emoji, farge eller last opp bilde.</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Presets</p>
          <div className="flex flex-wrap gap-2">
            {logoPresets.map((preset, index) => (
              <button
                key={`${preset.type}-${preset.value}-${index}`}
                type="button"
                onClick={() => setLogo(preset)}
                className={`flex h-11 w-11 items-center justify-center rounded-lg border text-lg transition ${
                  logo.type === preset.type && logo.value === preset.value
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40'
                    : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800'
                }`}
                aria-label="Velg logo"
              >
                {preset.type === 'emoji' ? preset.value : <Folder size={18} />}
              </button>
            ))}
          </div>
        </div>

        <label className="flex h-11 w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
          <ImageIcon size={16} />
          Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleLogoUpload(event.target.files?.[0] ?? null)}
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Farge</p>
          <div className="flex flex-wrap gap-2">
            {folderColors.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setColor(option.value)}
                className={`h-9 w-9 rounded-lg bg-gradient-to-br ${option.value} ring-offset-2 transition ${
                  color === option.value ? 'ring-2 ring-purple-500 dark:ring-offset-gray-900' : ''
                }`}
                aria-label={option.label}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="button" onClick={() => onSave({ logo, color })}>
            Lagre logo
          </Button>
        </div>
      </div>
    </Modal>
  )
}
function ProjectItemPreviewCard({ item }: { item: ProjectItem }) {
  const meta = itemTypeMeta[item.type]
  const Icon = meta.icon

  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-950/40">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-purple-600 shadow-sm dark:bg-gray-900 dark:text-purple-300">
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`truncate text-sm font-medium text-gray-950 dark:text-gray-100 ${item.done ? 'line-through opacity-60' : ''}`}>{item.title}</h3>
            <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              {projectItemTypeLabel(item)}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

function CreateFolderModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (folder: Pick<ProjectFolder, 'name' | 'description' | 'color' | 'logo'>) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(folderColors[0].value)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    onCreate({ name: name.trim(), description: description.trim(), color, logo: logoPresets[0] })
    setName('')
    setDescription('')
    setColor(folderColors[0].value)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Ny prosjektmappe">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Navn" value={name} onChange={(event) => setName(event.target.value)} placeholder="F.eks. Nettside, app, kundeprosjekt" required />
        <Textarea label="Beskrivelse" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Hva skal samles i denne mappen?" rows={3} />
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Farge</label>
          <div className="flex flex-wrap gap-2">
            {folderColors.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setColor(option.value)}
                className={`h-9 w-9 rounded-lg bg-gradient-to-br ${option.value} ring-offset-2 transition ${
                  color === option.value ? 'ring-2 ring-purple-500 dark:ring-offset-gray-900' : ''
                }`}
                aria-label={option.label}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit">
            <Plus size={16} />
            Lag mappe
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function CreateItemModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (item: Omit<ProjectItem, 'id' | 'createdAt' | 'updatedAt'>) => void
}) {
  const [mode, setMode] = useState<ResourceMode>('github')
  const [appType, setAppType] = useState<AppResourceType>('docs')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [repos, setRepos] = useState<GitHubUserRepo[]>([])
  const [reposLoading, setReposLoading] = useState(true)
  const [repoError, setRepoError] = useState<string | null>(null)
  const [repoSearch, setRepoSearch] = useState('')
  const [repoMode, setRepoMode] = useState<'existing' | 'new'>('existing')
  const [newRepoName, setNewRepoName] = useState('')
  const [newRepoDescription, setNewRepoDescription] = useState('')
  const [newRepoPrivate, setNewRepoPrivate] = useState(false)
  const [creatingRepo, setCreatingRepo] = useState(false)
  const [createRepoError, setCreateRepoError] = useState<string | null>(null)
  const usesFile = mode === 'document'
  const appOptions: Array<{
    type: AppResourceType
    label: string
    icon: React.ElementType
    url: string
  }> = [
    { type: 'docs', label: 'Google Docs', icon: FilePenLine, url: 'https://docs.new' },
    { type: 'sheets', label: 'Google Sheets', icon: FileSpreadsheet, url: 'https://sheets.new' },
    { type: 'word', label: 'Word', icon: FilePenLine, url: 'https://www.office.com/launch/word' },
    { type: 'excel', label: 'Excel', icon: FileSpreadsheet, url: 'https://www.office.com/launch/excel' },
    { type: 'notion', label: 'Notion', icon: PanelsTopLeft, url: 'https://www.notion.so/new' },
  ]
  const selectedApp = appOptions.find((option) => option.type === appType) ?? appOptions[0]
  const filteredRepos = repos.filter((repo) => {
    const query = repoSearch.trim().toLowerCase()
    if (!query) return true
    return `${repo.full_name} ${repo.description ?? ''} ${repo.language ?? ''}`.toLowerCase().includes(query)
  })

  useEffect(() => {
    if (!open) return
    fetch('/api/github/user-repos')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) {
          setRepoError(data.error ?? 'Kunne ikke hente repoer.')
          setRepos([])
          return
        }
        setRepos(Array.isArray(data) ? data : [])
        setRepoError(null)
      })
      .catch(() => {
        setRepoError('Kunne ikke hente repoer akkurat nå.')
        setRepos([])
      })
      .finally(() => setReposLoading(false))
  }, [open])

  function reset() {
    setMode('github')
    setAppType('docs')
    setTitle('')
    setUrl('')
    setFile(null)
    setRepoSearch('')
    setRepoMode('existing')
    setNewRepoName('')
    setNewRepoDescription('')
    setNewRepoPrivate(false)
    setCreatingRepo(false)
    setCreateRepoError(null)
    setReposLoading(true)
    setRepoError(null)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const fallbackTitle = mode === 'app' ? selectedApp.label : file?.name ?? url.trim().split('/').filter(Boolean).at(-1) ?? ''
    const itemTitle = title.trim() || fallbackTitle
    if (!itemTitle) return

    onCreate({
      type: mode === 'app' ? appType : mode,
      title: itemTitle,
      body: '',
      url: mode === 'url' ? url.trim() : mode === 'app' ? selectedApp.url : undefined,
      fileName: usesFile ? file?.name : undefined,
      fileSize: usesFile ? file?.size : undefined,
      status: mode === 'app' ? 'Created' : usesFile ? 'Uploaded' : 'Connected',
    })
    reset()
    onClose()
  }

  function addRepo(repo: GitHubUserRepo) {
    onCreate({
      type: 'github',
      title: repo.full_name,
      body: repo.description ?? '',
      url: repo.html_url,
      status: repo.private ? 'Private repo' : 'Connected',
    })
    reset()
    onClose()
  }

  async function createRepo(event: React.FormEvent) {
    event.preventDefault()
    if (!newRepoName.trim()) return
    setCreatingRepo(true)
    setCreateRepoError(null)

    try {
      const response = await fetch('/api/github/create-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRepoName.trim(),
          description: newRepoDescription.trim() || undefined,
          private: newRepoPrivate,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setCreateRepoError(data.error ?? 'Kunne ikke lage repo.')
        setCreatingRepo(false)
        return
      }

      onCreate({
        type: 'github',
        title: data.repo.full_name,
        body: newRepoDescription.trim(),
        url: data.repo.html_url,
        status: newRepoPrivate ? 'Private repo' : 'Created',
      })
      reset()
      onClose()
    } catch {
      setCreateRepoError('Kunne ikke lage repo akkurat nå.')
      setCreatingRepo(false)
    }
  }

  function selectMode(nextMode: ResourceMode) {
    setMode(nextMode)
    setTitle('')
    setUrl('')
    setFile(null)
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Add Resource" className="max-w-4xl">
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-4">
          {[
            { type: 'github' as const, label: 'Repos', icon: FolderGit2 },
            { type: 'url' as const, label: 'Link', icon: Globe2 },
            { type: 'document' as const, label: 'Upload', icon: Upload },
            { type: 'app' as const, label: 'App', icon: PanelsTopLeft },
          ].map((option) => {
            const Icon = option.icon
            const active = mode === option.type

            return (
              <button
                key={option.type}
                type="button"
                onClick={() => selectMode(option.type)}
                className={`flex h-20 flex-col items-center justify-center gap-2 rounded-lg border text-sm font-medium transition ${
                  active
                    ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-200'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <Icon size={20} />
                {option.label}
              </button>
            )
          })}
        </div>

        {mode === 'github' ? (
          <div className="space-y-4">
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-950/40">
              {(['existing', 'new'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRepoMode(mode)}
                  className={`h-9 flex-1 rounded-md text-sm font-medium transition ${
                    repoMode === mode
                      ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  {mode === 'existing' ? 'Velg repo' : 'Lag nytt repo'}
                </button>
              ))}
            </div>

            {repoMode === 'existing' ? (
              <div className="space-y-3">
                <Input
                  value={repoSearch}
                  onChange={(event) => setRepoSearch(event.target.value)}
                  placeholder="Søk i repoene dine"
                />
                <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
                  {reposLoading ? (
                    <div className="flex min-h-36 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                      Henter repoer...
                    </div>
                  ) : repoError ? (
                    <div className="flex min-h-36 flex-col items-center justify-center gap-3 px-6 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">{repoError}</p>
                      <a href="/api/github/connect">
                        <Button size="sm">Koble til GitHub</Button>
                      </a>
                    </div>
                  ) : filteredRepos.length === 0 ? (
                    <div className="flex min-h-36 flex-col items-center justify-center gap-3 px-6 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Fant ingen repoer her.</p>
                      <Button size="sm" onClick={() => setRepoMode('new')}>
                        <Plus size={16} />
                        Lag nytt repo
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-800">
                      {filteredRepos.map((repo) => (
                        <button
                          key={repo.id}
                          type="button"
                          onClick={() => addRepo(repo)}
                          className="flex w-full items-start justify-between gap-4 p-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/70"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-gray-950 dark:text-gray-100">
                              {repo.full_name}
                            </span>
                            <span className="mt-1 line-clamp-2 block text-xs text-gray-500 dark:text-gray-400">
                              {repo.description || 'Ingen beskrivelse'}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            {repo.language ?? (repo.private ? 'Private' : 'Repo')}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={createRepo} className="space-y-4">
                <Input
                  label="Repository name"
                  value={newRepoName}
                  onChange={(event) => setNewRepoName(event.target.value.replace(/\s+/g, '-'))}
                  placeholder="mitt-nye-prosjekt"
                  required
                />
                <Textarea
                  label="Beskrivelse"
                  value={newRepoDescription}
                  onChange={(event) => setNewRepoDescription(event.target.value)}
                  rows={3}
                />
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={newRepoPrivate}
                    onChange={(event) => setNewRepoPrivate(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  Privat repo
                </label>
                {createRepoError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">
                    {createRepoError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setRepoMode('existing')}>
                    Tilbake
                  </Button>
                  <Button type="submit" loading={creatingRepo}>
                    Lag repo og legg til
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'app' && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Velg app</label>
                <div className="grid gap-2 sm:grid-cols-5">
                  {appOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => setAppType(option.type)}
                        className={`flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-sm transition ${
                          appType === option.type
                            ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-200'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800'
                        }`}
                      >
                        <Icon size={18} />
                        {option.label.replace('Google ', '')}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <Input
              label="Navn"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={mode === 'app' ? `Navn på ${selectedApp.label}` : mode === 'url' ? 'Navn på lenken' : 'Navn på filen'}
              required={!usesFile}
            />
            {mode === 'url' && (
              <Input
                label="Link"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://..."
                type="url"
                required
              />
            )}
            {usesFile && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fil</label>
                <input
                  type="file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded-md file:border-0 file:bg-purple-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-purple-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:file:bg-purple-950 dark:file:text-purple-200"
                  required
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => { reset(); onClose() }}>
                Avbryt
              </Button>
              <Button type="submit">
                <Plus size={16} />
                Legg til
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}

function CreateLocalFolderModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (item: Omit<ProjectItem, 'id' | 'createdAt' | 'updatedAt'>) => void
}) {
  const [title, setTitle] = useState('')
  const [path, setPath] = useState('')

  function reset() {
    setTitle('')
    setPath('')
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const fallbackTitle = path.trim().split('/').filter(Boolean).at(-1) ?? ''
    const itemTitle = title.trim() || fallbackTitle
    if (!itemTitle) return

    onCreate({
      type: 'local_folder',
      title: itemTitle,
      body: '',
      path: path.trim() || itemTitle,
      status: 'Folder',
    })
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Add mappe">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Navn"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="F.eks. Frontend, Design, Assets"
        />
        <Input
          label="Mappe-sti"
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder="/Users/navn/Prosjekter/app"
        />
        <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">
          Valgfritt. Skriv inn sti hvis du vil lagre hvor mappen ligger på maskinen.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => { reset(); onClose() }}>
            Avbryt
          </Button>
          <Button type="submit">
            <Plus size={16} />
            Legg til mappe
          </Button>
        </div>
      </form>
    </Modal>
  )
}
