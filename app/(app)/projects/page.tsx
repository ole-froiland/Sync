'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckSquare,
  FileText,
  Folder,
  FolderOpen,
  Link2,
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
  createdAt: string
  items: ProjectItem[]
}

type ProjectItem = {
  id: string
  type: 'note' | 'link' | 'file' | 'task'
  title: string
  body: string
  url?: string
  fileName?: string
  fileSize?: number
  done?: boolean
  createdAt: string
}

type ItemType = ProjectItem['type']

const STORAGE_KEY = 'sync-project-folders-v1'

const folderColors = [
  { label: 'Purple', value: 'from-purple-500 to-fuchsia-500' },
  { label: 'Blue', value: 'from-blue-500 to-cyan-400' },
  { label: 'Green', value: 'from-emerald-500 to-lime-400' },
  { label: 'Orange', value: 'from-orange-500 to-amber-300' },
  { label: 'Red', value: 'from-rose-500 to-red-400' },
]

const itemTypeMeta: Record<ItemType, { label: string; icon: React.ElementType }> = {
  note: { label: 'Notat', icon: StickyNote },
  link: { label: 'Lenke', icon: Link2 },
  file: { label: 'Fil', icon: Upload },
  task: { label: 'Oppgave', icon: CheckSquare },
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatFileSize(size?: number) {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export default function ProjectsPage() {
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [folderOpen, setFolderOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [search, setSearch] = useState('')
  const loadedRef = useRef(false)

  useEffect(() => {
    window.setTimeout(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as ProjectFolder[]
          setFolders(parsed)
          setSelectedFolderId(parsed[0]?.id ?? null)
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
      const itemText = folder.items.map((item) => `${item.title} ${item.body} ${item.url ?? ''}`).join(' ').toLowerCase()
      return folderText.includes(query) || itemText.includes(query)
    })
  }, [folders, search])

  function createFolder(folder: Pick<ProjectFolder, 'name' | 'description' | 'color'>) {
    const nextFolder: ProjectFolder = {
      ...folder,
      id: makeId('folder'),
      createdAt: new Date().toISOString(),
      items: [],
    }
    setFolders((current) => [nextFolder, ...current])
    setSelectedFolderId(nextFolder.id)
  }

  function createItem(item: Omit<ProjectItem, 'id' | 'createdAt'>) {
    if (!selectedFolder) return
    const nextItem: ProjectItem = {
      ...item,
      id: makeId('item'),
      createdAt: new Date().toISOString(),
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
          <div className="relative w-full lg:w-80">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Søk i prosjektmapper"
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-purple-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
            />
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
        ) : (
          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <aside className="space-y-3">
              {visibleFolders.map((folder) => {
                const active = folder.id === selectedFolderId
                const FolderIcon = active ? FolderOpen : Folder

                return (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`group flex w-full items-start gap-3 rounded-lg border p-4 text-left transition ${
                      active
                        ? 'border-purple-400 bg-purple-50 shadow-sm dark:border-purple-700 dark:bg-purple-950/30'
                        : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700'
                    }`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${folder.color} text-white shadow-sm`}>
                      <FolderIcon size={22} />
                    </span>
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
              {selectedFolder ? (
                <>
                  <div className="flex flex-col gap-4 border-b border-gray-200 p-5 dark:border-gray-800 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${selectedFolder.color} text-white`}>
                          <FolderOpen size={21} />
                        </span>
                        <div className="min-w-0">
                          <h2 className="truncate text-xl font-semibold text-gray-950 dark:text-gray-100">{selectedFolder.name}</h2>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedFolder.description || 'Ingen beskrivelse'}</p>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setItemOpen(true)}>
                      <Plus size={16} />
                      Legg til
                    </Button>
                  </div>

                  {selectedFolder.items.length === 0 ? (
                    <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
                      <FileText size={38} className="mb-4 text-gray-300 dark:text-gray-700" />
                      <h3 className="font-medium text-gray-950 dark:text-gray-100">Mappen er tom</h3>
                      <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                        Legg inn notater, lenker, filer eller oppgaver når du vil samle noe for prosjektet.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 p-5 lg:grid-cols-2">
                      {selectedFolder.items.map((item) => (
                        <ProjectItemCard key={item.id} item={item} onToggle={toggleTask} onRemove={removeItem} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex min-h-[56vh] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Velg en prosjektmappe.
                </div>
              )}
            </main>
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
            {item.fileName && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                {item.fileName} {formatFileSize(item.fileSize)}
              </p>
            )}
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

function CreateFolderModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (folder: Pick<ProjectFolder, 'name' | 'description' | 'color'>) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(folderColors[0].value)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    onCreate({ name: name.trim(), description: description.trim(), color })
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
  onCreate: (item: Omit<ProjectItem, 'id' | 'createdAt'>) => void
}) {
  const [type, setType] = useState<ItemType>('note')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)

  function reset() {
    setType('note')
    setTitle('')
    setBody('')
    setUrl('')
    setFile(null)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const fallbackTitle = file?.name ?? url.trim() ?? ''
    const itemTitle = title.trim() || fallbackTitle
    if (!itemTitle) return

    onCreate({
      type,
      title: itemTitle,
      body: body.trim(),
      url: type === 'link' ? url.trim() : undefined,
      fileName: type === 'file' ? file?.name : undefined,
      fileSize: type === 'file' ? file?.size : undefined,
      done: type === 'task' ? false : undefined,
    })
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Legg til i mappe">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(itemTypeMeta) as ItemType[]).map((key) => {
            const meta = itemTypeMeta[key]
            const Icon = meta.icon
            return (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                className={`flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-sm transition ${
                  type === key
                    ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-200'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                <Icon size={18} />
                {meta.label}
              </button>
            )
          })}
        </div>

        <Input label="Tittel" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Hva vil du lagre?" required={type !== 'file'} />
        {type === 'link' && <Input label="Lenke" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." type="url" required />}
        {type === 'file' && (
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
          label={type === 'task' ? 'Detaljer' : 'Tekst'}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={type === 'note' ? 'Skriv notatet her...' : 'Valgfri informasjon'}
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
