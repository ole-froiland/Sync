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
  done?: boolean
  status?: string
  createdAt: string
  updatedAt?: string
}

type ItemType = ProjectItem['type']
type ResourceType = 'github' | 'local_folder' | 'notion' | 'url' | 'document'

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

const resourceTypes: Array<{
  type: ResourceType
  label: string
  description: string
}> = [
  { type: 'github', label: 'GitHub repository', description: 'Koble repo, README eller issues.' },
  { type: 'local_folder', label: 'Lokal mappe', description: 'Legg inn sti til en arbeidsmappe.' },
  { type: 'notion', label: 'Notion-side', description: 'Samle research, specs eller docs.' },
  { type: 'url', label: 'Lenke / URL', description: 'Nettside, demo, design eller referanse.' },
  { type: 'document', label: 'Dokument / fil', description: 'Last opp eller registrer en fil.' },
]

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatFileSize(size?: number) {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatUpdatedAt(value?: string) {
  if (!value) return 'Akkurat nå'
  return new Intl.DateTimeFormat('no', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function projectLogo(folder: ProjectFolder): ProjectLogo {
  return folder.logo ?? { type: 'icon', value: 'folder' }
}

export default function ProjectsPage() {
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [folderOpen, setFolderOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setFolders((current) =>
      current.map((folder) =>
        folder.id === selectedFolder.id ? { ...folder, items: [nextItem, ...folder.items] } : folder
      )
    )
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
          ? { ...folder, items: folder.items.filter((item) => item.id !== itemId) }
          : folder
      )
    )
  }

  if (selectedFolder) {
    return (
      <>
        <TopBar
          title={selectedFolder.name}
          actions={
            <Button size="sm" onClick={() => setItemOpen(true)}>
              <Plus size={16} />
              Add Resource
            </Button>
          }
        />

        <div className="flex-1 overflow-y-auto px-6 py-8">
          <button
            onClick={() => {
              setSelectedFolderId(null)
              setItemOpen(false)
            }}
            className="mb-6 inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <ArrowLeft size={16} />
            Tilbake til prosjektmapper
          </button>

          <main className="min-h-[64vh] rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <ProjectDetailContent
              folder={selectedFolder}
              onAddResource={() => setItemOpen(true)}
              onUpdate={updateFolder}
              onToggleTask={toggleTask}
              onRemoveItem={removeItem}
            />
          </main>
        </div>

        <CreateItemModal open={itemOpen} onClose={() => setItemOpen(false)} onCreate={createItem} />
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
            <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-950 dark:text-gray-100">Prosjektmapper</h1>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                  Lag mapper for prosjektene dine og samle notater, lenker, filer og oppgaver på ett sted.
                </p>
              </div>
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
                        className={`group flex w-full items-start gap-3 rounded-lg border p-4 text-left transition ${
                          active
                            ? 'border-purple-400 bg-purple-50 shadow-sm dark:border-purple-700 dark:bg-purple-950/30'
                            : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700'
                        }`}
                      >
                        <ProjectLogoThumbnail folder={folder} className="h-11 w-11" iconSize={22} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-gray-950 dark:text-gray-100">{folder.name}</span>
                          <span className="mt-1 line-clamp-2 block text-sm text-gray-500 dark:text-gray-400">
                            {folder.description || 'Tom prosjektmappe'}
                          </span>
                          <span className="mt-3 block text-xs text-gray-400 dark:text-gray-500">
                            {folder.items.length} {folder.items.length === 1 ? 'ting lagret' : 'ting lagret'}
                          </span>
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
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    onDoubleClick={() => setSelectedFolderId(folder.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') setSelectedFolderId(folder.id)
                    }}
                    className="group flex min-h-36 w-full items-start gap-4 rounded-lg border border-gray-200 bg-white p-5 text-left transition hover:border-purple-400 hover:bg-purple-50/60 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-purple-700 dark:hover:bg-purple-950/20"
                  >
                    <ProjectLogoThumbnail folder={folder} className="h-12 w-12" iconSize={24} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-medium text-gray-950 dark:text-gray-100">{folder.name}</span>
                      <span className="mt-2 line-clamp-2 block text-sm text-gray-500 dark:text-gray-400">
                        {folder.description || 'Tom prosjektmappe'}
                      </span>
                      <span className="mt-5 block text-xs text-gray-400 dark:text-gray-500">
                        {folder.items.length} {folder.items.length === 1 ? 'ting lagret' : 'ting lagret'}
                      </span>
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

function ProjectItemCard({
  item,
  onToggle,
  onRemove,
}: {
  item: ProjectItem
  onToggle: (itemId: string) => void
  onRemove: (itemId: string) => void
}) {
  const meta = itemTypeMeta[item.type]
  const Icon = meta.icon

  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-purple-600 shadow-sm dark:bg-gray-900 dark:text-purple-300">
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`font-medium text-gray-950 dark:text-gray-100 ${item.done ? 'line-through opacity-60' : ''}`}>{item.title}</h3>
              <span className="rounded-md bg-white px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                {meta.label}
              </span>
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {item.status ?? (item.done ? 'Done' : 'Active')}
              </span>
            </div>
            {item.body && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{item.body}</p>}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex max-w-full items-center gap-1 truncate text-sm text-purple-600 hover:underline dark:text-purple-300"
              >
                <Link2 size={14} />
                <span className="truncate">{item.url}</span>
              </a>
            )}
            {item.path && (
              <p className="mt-3 inline-flex max-w-full items-center gap-1 truncate text-sm text-gray-500 dark:text-gray-400">
                <FolderOpen size={14} />
                <span className="truncate">{item.path}</span>
              </p>
            )}
            {item.fileName && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                {item.fileName} {formatFileSize(item.fileSize)}
              </p>
            )}
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              Sist oppdatert {formatUpdatedAt(item.updatedAt ?? item.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {item.type === 'task' && (
            <button
              onClick={() => onToggle(item.id)}
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
            onClick={() => onRemove(item.id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white hover:text-red-500 dark:hover:bg-gray-900"
            aria-label="Fjern innhold"
          >
            <X size={16} />
          </button>
        </div>
      </div>
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
  onAddResource,
  onUpdate,
  onToggleTask,
  onRemoveItem,
}: {
  folder: ProjectFolder
  onAddResource: () => void
  onUpdate: (folderId: string, updates: Partial<Pick<ProjectFolder, 'name' | 'description' | 'logo' | 'color'>>) => void
  onToggleTask: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
}) {
  const [name, setName] = useState(folder.name)
  const [description, setDescription] = useState(folder.description)
  const [logo, setLogo] = useState<ProjectLogo>(projectLogo(folder))

  function saveProject() {
    if (!folder || !name.trim()) return
    onUpdate(folder.id, {
      name: name.trim(),
      description: description.trim(),
      logo,
    })
  }

  function handleLogoUpload(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogo({ type: 'image', value: reader.result })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <section className="space-y-5">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-950/40">
            <div className="mb-4 flex items-center gap-3">
              <ProjectLogoThumbnail
                folder={{ ...folder, logo }}
                className="h-14 w-14"
                iconSize={28}
                open
              />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Project details
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Navn og logo vises i oversikten.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Input label="Prosjektnavn" value={name} onChange={(event) => setName(event.target.value)} />
              <Textarea
                label="Beskrivelse"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Logo</p>
              <div className="flex flex-wrap gap-2">
                {logoPresets.map((preset, index) => (
                  <button
                    key={`${preset.type}-${preset.value}-${index}`}
                    type="button"
                    onClick={() => setLogo(preset)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border text-lg transition ${
                      logo.type === preset.type && logo.value === preset.value
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40'
                        : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800'
                    }`}
                    aria-label="Velg logo"
                  >
                    {preset.type === 'emoji' ? preset.value : <Folder size={18} />}
                  </button>
                ))}
                <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
                  <ImageIcon size={16} />
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handleLogoUpload(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            <Button className="mt-5 w-full" onClick={saveProject}>
              Lagre endringer
            </Button>
          </div>
        </section>

        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resources</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                GitHub, mapper, Notion, lenker og dokumenter samlet ett sted.
              </p>
            </div>
            <Button size="sm" onClick={onAddResource}>
              <Plus size={16} />
              Add Resource
            </Button>
          </div>

          {folder.items.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-6 text-center dark:border-gray-800 dark:bg-gray-950/40">
              <FileText size={34} className="mb-3 text-gray-300 dark:text-gray-700" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ingen ressurser enda</h4>
              <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
                Legg til repoer, Notion-sider, mapper, dokumenter eller nyttige lenker.
              </p>
              <Button className="mt-4" size="sm" onClick={onAddResource}>
                <Plus size={16} />
                Add Resource
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {folder.items.map((item) => (
                <ProjectItemCard
                  key={item.id}
                  item={item}
                  onToggle={onToggleTask}
                  onRemove={onRemoveItem}
                />
              ))}
            </div>
          )}
        </section>
    </div>
  )
}

function ProjectItemPreviewCard({ item }: { item: ProjectItem }) {
  const meta = itemTypeMeta[item.type]
  const Icon = meta.icon

  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-purple-600 shadow-sm dark:bg-gray-900 dark:text-purple-300">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-medium text-gray-950 dark:text-gray-100 ${item.done ? 'line-through opacity-60' : ''}`}>{item.title}</h3>
            <span className="rounded-md bg-white px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              {meta.label}
            </span>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {item.status ?? (item.done ? 'Done' : 'Active')}
            </span>
          </div>
          {item.body && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{item.body}</p>}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex max-w-full items-center gap-1 truncate text-sm text-purple-600 hover:underline dark:text-purple-300"
            >
              <Link2 size={14} />
              <span className="truncate">{item.url}</span>
            </a>
          )}
          {item.path && (
            <p className="mt-3 inline-flex max-w-full items-center gap-1 truncate text-sm text-gray-500 dark:text-gray-400">
              <FolderOpen size={14} />
              <span className="truncate">{item.path}</span>
            </p>
          )}
          {item.fileName && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {item.fileName} {formatFileSize(item.fileSize)}
            </p>
          )}
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            Sist oppdatert {formatUpdatedAt(item.updatedAt ?? item.createdAt)}
          </p>
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
  const [type, setType] = useState<ResourceType>('github')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const usesUrl = type === 'github' || type === 'notion' || type === 'url'
  const usesPath = type === 'local_folder'
  const usesFile = type === 'document'

  function reset() {
    setType('github')
    setTitle('')
    setBody('')
    setUrl('')
    setFile(null)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const fallbackTitle = file?.name ?? url.trim().split('/').filter(Boolean).at(-1) ?? ''
    const itemTitle = title.trim() || fallbackTitle
    if (!itemTitle) return

    onCreate({
      type,
      title: itemTitle,
      body: body.trim(),
      url: usesUrl ? url.trim() : undefined,
      path: usesPath ? url.trim() : undefined,
      fileName: usesFile ? file?.name : undefined,
      fileSize: usesFile ? file?.size : undefined,
      status: usesFile ? 'Uploaded' : 'Connected',
    })
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Resource" className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {resourceTypes.map((resource) => {
              const meta = itemTypeMeta[resource.type]
              const Icon = meta.icon
              const active = type === resource.type

              return (
                <button
                  key={resource.type}
                  type="button"
                  onClick={() => setType(resource.type)}
                  className={`flex min-h-24 items-start gap-3 rounded-lg border p-3 text-left transition ${
                    active
                      ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-200'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-purple-600 dark:bg-gray-900 dark:text-purple-300">
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{resource.label}</span>
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      {resource.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <Input label="Navn" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="F.eks. Frontend repo, Brand docs, Figma brief" required={!usesFile} />
        {usesUrl && (
          <Input
            label="URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://..."
            type="url"
            required
          />
        )}
        {usesPath && (
          <Input
            label="Mappe-sti"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="/Users/navn/Prosjekter/app"
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
        <Textarea
          label="Notat"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Valgfri status, eier, miljø, eller hvorfor ressursen hører til prosjektet."
          rows={4}
        />
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
    </Modal>
  )
}
