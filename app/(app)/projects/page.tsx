'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  CheckSquare,
  ExternalLink,
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
  MessageSquare,
  MoreVertical,
  PanelsTopLeft,
  Pencil,
  Plus,
  Search,
  Send,
  Share2,
  StickyNote,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import TopBar from '@/components/layout/TopBar'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'
import { useUser } from '@/context/UserContext'
import type { GitHubUserRepo, Profile } from '@/types'

type ProjectFolder = {
  id: string
  name: string
  description: string
  color: string
  logo?: ProjectLogo
  parentId?: string
  createdAt: string
  members?: ProjectFolderMember[]
  sharedFrom?: ProjectFolderMember
  items: ProjectItem[]
}

type ProjectFolderMember = {
  id: string
  name: string
  avatar_url: string | null
  role?: 'creator' | 'member'
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
type ProjectItemOpenTarget = { href: string; external: boolean; label: string }
type SendStatus = 'idle' | 'sending' | 'sent' | 'error'
type ProjectPathSegment = { id: string; label: string }
type LegacyProjectCollection = {
  id?: string
  name?: string
  label?: string
  color?: string
  createdAt?: string
}

type AcceptedSharePayload = {
  kind?: string
  full_name?: string
  name?: string
  url?: string
  description?: string | null
  language?: string | null
  color?: string
  logo?: ProjectLogo | null
  members?: ProjectFolderMember[]
  shared_from?: ProjectFolderMember | null
  items?: ProjectItem[]
}

const STORAGE_KEY = 'sync-project-folders-v1'
const LEGACY_COLLECTION_KEYS = ['sync-project-folder-collections-v1', 'project-folder-collections-v1']
const PROJECT_CHAT_TARGET_KEY = 'sync-open-project-chat'
const LOCAL_PROJECT_PREFIX = 'project-folder:'

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

function parseStoredFolders(raw: string | null): ProjectFolder[] {
  if (!raw) return []
  const parsed = JSON.parse(raw) as unknown
  return Array.isArray(parsed) ? (parsed as ProjectFolder[]) : []
}

function folderFromLegacyCollection(collection: LegacyProjectCollection): ProjectFolder | null {
  const name = collection.name ?? collection.label
  if (!name?.trim()) return null

  return {
    id: collection.id ? `legacy-${collection.id}` : makeId('legacy-folder'),
    name: name.trim(),
    description: '',
    color: collection.color ?? folderColors[0].value,
    logo: { type: 'icon', value: 'folder' },
    createdAt: collection.createdAt ?? new Date().toISOString(),
    items: [],
  }
}

function readLegacyCollections(): ProjectFolder[] {
  const folders: ProjectFolder[] = []
  for (const key of LEGACY_COLLECTION_KEYS) {
    const raw = window.localStorage.getItem(key)
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) continue
      for (const collection of parsed) {
        const folder = folderFromLegacyCollection(collection as LegacyProjectCollection)
        if (folder) folders.push(folder)
      }
    } catch {
      // Ignore malformed legacy cache keys; current storage remains authoritative.
    }
  }
  return folders
}

function mergeProjectFolders(...sources: ProjectFolder[][]): ProjectFolder[] {
  const byId = new Map<string, ProjectFolder>()
  for (const folders of sources) {
    for (const folder of folders) byId.set(folder.id, folder)
  }
  return migrateLocalFolderItems([...byId.values()])
}

function localProjectChatId(folderId: string) {
  return `${LOCAL_PROJECT_PREFIX}${folderId}`
}

function projectLogo(folder: ProjectFolder): ProjectLogo {
  return folder.logo ?? { type: 'icon', value: 'folder' }
}

function folderMemberFromProfile(profile: Profile | null, role: ProjectFolderMember['role'] = 'creator'): ProjectFolderMember | null {
  if (!profile) return null
  return {
    id: profile.id,
    name: profile.name,
    avatar_url: profile.avatar_url,
    role,
  }
}

function projectFolderMembers(
  folder: ProjectFolder,
  currentProfile: Profile | null,
  acceptedMembers: ProjectFolderMember[] = []
): ProjectFolderMember[] {
  const sharedFolder = Boolean(folder.sharedFrom) || acceptedMembers.length > 0
  if (!sharedFolder) return []

  const map = new Map<string, ProjectFolderMember>()
  for (const member of folder.members ?? []) map.set(member.id, member)
  if (folder.sharedFrom) map.set(folder.sharedFrom.id, folder.sharedFrom)
  for (const member of acceptedMembers) map.set(member.id, member)
  const current = folderMemberFromProfile(currentProfile)
  if (current) map.set(current.id, map.get(current.id) ?? current)
  return [...map.values()]
}

function projectFolderShareLabel(folder: ProjectFolder) {
  if (folder.sharedFrom) return `Delt av ${folder.sharedFrom.name}`
  return 'Din mappe'
}

function projectFolderPath(folders: ProjectFolder[], folderId: string | null): ProjectFolder[] {
  const path: ProjectFolder[] = []
  const seen = new Set<string>()
  let current = folderId ? folders.find((folder) => folder.id === folderId) ?? null : null

  while (current && !seen.has(current.id)) {
    path.unshift(current)
    seen.add(current.id)
    current = current.parentId ? folders.find((folder) => folder.id === current?.parentId) ?? null : null
  }

  return path
}

function projectItemFolderPath(items: ProjectItem[], itemFolderId: string | null): ProjectItem[] {
  const path: ProjectItem[] = []
  const seen = new Set<string>()
  let current = itemFolderId
    ? items.find((item) => item.id === itemFolderId && item.type === 'local_folder') ?? null
    : null

  while (current && !seen.has(current.id)) {
    path.unshift(current)
    seen.add(current.id)
    current = current.parentId
      ? items.find((item) => item.id === current?.parentId && item.type === 'local_folder') ?? null
      : null
  }

  return path
}

function projectReturnQuery(projectPath: string[]) {
  if (projectPath.length === 0) return ''
  const params = new URLSearchParams({
    from: 'projects',
    path: projectPath.join(' / '),
  })
  return `?${params.toString()}`
}

function sharedFolderId(messageId: string) {
  return `shared-${messageId}`
}

function folderChildCount(folders: ProjectFolder[], folderId: string) {
  return folders.filter((folder) => folder.parentId === folderId).length
}

function folderDescendantIds(folders: ProjectFolder[], folderId: string) {
  const descendants = new Set<string>()
  const stack = [folderId]

  while (stack.length > 0) {
    const parentId = stack.pop()
    const children = folders.filter((folder) => folder.parentId === parentId)
    for (const child of children) {
      if (descendants.has(child.id)) continue
      descendants.add(child.id)
      stack.push(child.id)
    }
  }

  return descendants
}

function projectItemDescendantIds(items: ProjectItem[], itemId: string) {
  const descendants = new Set<string>()
  const stack = [itemId]

  while (stack.length > 0) {
    const parentId = stack.pop()
    const children = items.filter((item) => item.parentId === parentId)
    for (const child of children) {
      if (descendants.has(child.id)) continue
      descendants.add(child.id)
      stack.push(child.id)
    }
  }

  return descendants
}

function isProjectFolderSharePayload(payload: AcceptedSharePayload | null | undefined) {
  return payload?.kind === 'project_folder_share' || Array.isArray(payload?.items)
}

function sharedFolderFromAcceptedMessage({
  id,
  other,
  payload,
  senderIsOther,
}: {
  id: string
  other: Profile
  payload: AcceptedSharePayload
  senderIsOther: boolean
}): ProjectFolder | null {
  const name = payload.name ?? payload.full_name?.split('/').at(-1) ?? 'Delt prosjekt'
  if (!name) return null

  const member: ProjectFolderMember = {
    id: other.id,
    name: other.name,
    avatar_url: other.avatar_url,
    role: senderIsOther ? 'creator' : 'member',
  }
  const now = new Date().toISOString()
  const items = Array.isArray(payload.items)
    ? payload.items.map((item) => ({
        ...item,
        id: item.id ? `shared-${id}-${item.id}` : makeId('shared-item'),
        createdAt: item.createdAt ?? now,
        updatedAt: item.updatedAt ?? now,
      }))
    : payload.url
    ? [
        {
          id: `shared-item-${id}`,
          type: 'github' as const,
          title: payload.full_name ?? name,
          body: payload.description ?? '',
          url: payload.url,
          status: payload.language ?? 'Shared repo',
          createdAt: now,
          updatedAt: now,
        },
      ]
    : []

  return {
    id: sharedFolderId(id),
    name,
    description: payload.description ?? '',
    color: 'from-purple-500 to-fuchsia-500',
    logo: { type: 'icon', value: 'folder' },
    createdAt: now,
    members: [member],
    sharedFrom: senderIsOther ? member : undefined,
    items,
  }
}

function migratedLocalFolderId(containerFolderId: string, itemId: string) {
  return `migrated-${containerFolderId}-${itemId}`
}

function migrateLocalFolderItems(projectFolders: ProjectFolder[]): ProjectFolder[] {
  const existingFolderIds = new Set(projectFolders.map((folder) => folder.id))
  const migratedFolders: ProjectFolder[] = []

  const updatedFolders = projectFolders.map((folder) => {
    const localFolderItems = folder.items.filter((item) => item.type === 'local_folder')
    if (localFolderItems.length === 0) return folder

    const localItemsById = new Map(localFolderItems.map((item) => [item.id, item]))
    const movedItemsByFolderId = new Map<string, ProjectItem[]>()

    function nearestLocalFolderId(item: ProjectItem) {
      const seen = new Set<string>()
      let parentId = item.parentId

      while (parentId && !seen.has(parentId)) {
        if (localItemsById.has(parentId)) return parentId
        seen.add(parentId)
        parentId = folder.items.find((candidate) => candidate.id === parentId)?.parentId
      }

      return null
    }

    const remainingItems: ProjectItem[] = []
    for (const item of folder.items) {
      if (item.type === 'local_folder') continue

      const localParentId = nearestLocalFolderId(item)
      if (!localParentId) {
        remainingItems.push(item)
        continue
      }

      const targetFolderId = migratedLocalFolderId(folder.id, localParentId)
      const targetItems = movedItemsByFolderId.get(targetFolderId) ?? []
      targetItems.push({
        ...item,
        parentId: item.parentId === localParentId ? undefined : item.parentId,
      })
      movedItemsByFolderId.set(targetFolderId, targetItems)
    }

    for (const item of localFolderItems) {
      const migratedId = migratedLocalFolderId(folder.id, item.id)
      if (existingFolderIds.has(migratedId)) continue

      migratedFolders.push({
        id: migratedId,
        name: item.title,
        description: item.body,
        color: folder.color,
        logo: { type: 'icon', value: 'folder' },
        parentId:
          item.parentId && localItemsById.has(item.parentId)
            ? migratedLocalFolderId(folder.id, item.parentId)
            : folder.id,
        createdAt: item.createdAt,
        members: folder.members,
        sharedFrom: folder.sharedFrom,
        items: movedItemsByFolderId.get(migratedId) ?? [],
      })
      existingFolderIds.add(migratedId)
    }

    return { ...folder, items: remainingItems }
  })

  return migratedFolders.length > 0 ? [...updatedFolders, ...migratedFolders] : updatedFolders
}

export default function ProjectsPage() {
  const currentProfile = useUser()
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [folderOpen, setFolderOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [localFolderOpen, setLocalFolderOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [activeItemFolderId, setActiveItemFolderId] = useState<string | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [clipboard, setClipboard] = useState<ProjectClipboard>(null)
  const [search, setSearch] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const [previewFolderId, setPreviewFolderId] = useState<string | null>(null)
  const [activeParentFolderId, setActiveParentFolderId] = useState<string | null>(null)
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [folderMenu, setFolderMenu] = useState<{ folderId: string; x: number; y: number } | null>(null)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [logoFolderId, setLogoFolderId] = useState<string | null>(null)
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [storageReady, setStorageReady] = useState(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadFolders() {
      let localFolders: ProjectFolder[] = []
      try {
        localFolders = parseStoredFolders(window.localStorage.getItem(STORAGE_KEY))
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      }

      const legacyFolders = readLegacyCollections()
      let serverFolders: ProjectFolder[] = []
      if (currentProfile) {
        try {
          const response = await fetch('/api/project-folders')
          if (response.ok) {
            const body = (await response.json()) as { folders?: ProjectFolder[] }
            serverFolders = Array.isArray(body.folders) ? body.folders : []
          }
        } catch {
          // Local cache keeps the page usable while server sync is unavailable.
        }
      }

      if (cancelled) return

      setFolders(mergeProjectFolders(serverFolders, localFolders, legacyFolders))
      setSelectedFolderId(null)
      loadedRef.current = true
      setStorageReady(true)
    }

    const id = window.setTimeout(() => {
      void loadFolders()
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [currentProfile])

  useEffect(() => {
    if (!loadedRef.current || !storageReady) return

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(folders))
    if (!currentProfile) return

    const controller = new AbortController()
    const id = window.setTimeout(() => {
      void fetch('/api/project-folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folders }),
        signal: controller.signal,
      }).catch(() => {
        // Keep the local cache; the next change or reload can retry.
      })
    }, 500)

    return () => {
      controller.abort()
      window.clearTimeout(id)
    }
  }, [folders, storageReady, currentProfile])

  useEffect(() => {
    if (!currentProfile || !storageReady) return
    const currentProfileId = currentProfile.id
    let cancelled = false

    async function loadAcceptedShares() {
      try {
        const [inboxRes, peopleRes] = await Promise.all([
          fetch('/api/direct-messages/inbox'),
          fetch('/api/people'),
        ])
        if (!inboxRes.ok || !peopleRes.ok) return

        const inbox = (await inboxRes.json()) as {
          items?: Array<{
            id: string
            sender_id: string
            receiver_id: string
            type: 'text' | 'repo_share' | 'project_folder_share'
            state: 'sent' | 'accepted' | 'rejected'
            payload?: AcceptedSharePayload | null
          }>
        }
        const people = (await peopleRes.json()) as Profile[]
        const peopleById = new Map(people.map((person) => [person.id, person]))

        const sharedFolders = (inbox.items ?? [])
          .filter(
            (item) =>
              item.state === 'accepted' &&
              (item.type === 'project_folder_share' || isProjectFolderSharePayload(item.payload))
          )
          .map((item): ProjectFolder | null => {
            const otherId = item.sender_id === currentProfileId ? item.receiver_id : item.sender_id
            const other = peopleById.get(otherId)
            const payload = item.payload ?? {}
            if (!other) return null
            return sharedFolderFromAcceptedMessage({
              id: item.id,
              other,
              payload,
              senderIsOther: item.sender_id === other.id,
            })
          })
          .filter((folder): folder is ProjectFolder => Boolean(folder))

        if (!cancelled && sharedFolders.length > 0) {
          setFolders((current) => {
            const currentIds = new Set(current.map((folder) => folder.id))
            const missing = sharedFolders.filter((folder) => !currentIds.has(folder.id))
            return missing.length > 0 ? [...current, ...missing] : current
          })
        }
      } catch {
        // Shared folder hydration should not block local project folders.
      }
    }

    void loadAcceptedShares()
    return () => {
      cancelled = true
    }
  }, [currentProfile, storageReady])

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null
  const activeParentFolder = activeParentFolderId
    ? folders.find((folder) => folder.id === activeParentFolderId) ?? null
    : null
  const activeItemFolder =
    selectedFolder?.items.find((item) => item.id === activeItemFolderId && item.type === 'local_folder') ?? null

  const visibleFolders = useMemo(() => {
    const query = search.trim().toLowerCase()
    return folders.filter((folder) => {
      if ((folder.parentId ?? null) !== activeParentFolderId) return false
      if (!query) return true
      const folderText = `${folder.name} ${folder.description}`.toLowerCase()
      const itemText = folder.items
        .map((item) => `${item.title} ${item.body} ${item.url ?? ''} ${item.path ?? ''}`)
        .join(' ')
        .toLowerCase()
      return folderText.includes(query) || itemText.includes(query)
    })
  }, [folders, search, activeParentFolderId])

  const folderPath = useMemo(
    () => projectFolderPath(folders, activeParentFolder?.id ?? null),
    [activeParentFolder, folders]
  )
  const selectedFolderPath = useMemo(
    () => projectFolderPath(folders, selectedFolder?.id ?? null),
    [folders, selectedFolder?.id]
  )

  const previewFolder =
    visibleFolders.find((folder) => folder.id === previewFolderId) ?? visibleFolders[0] ?? null
  const menuFolder = folderMenu ? folders.find((folder) => folder.id === folderMenu.folderId) ?? null : null
  const renamingFolder = renamingFolderId ? folders.find((folder) => folder.id === renamingFolderId) ?? null : null
  const logoFolder = logoFolderId ? folders.find((folder) => folder.id === logoFolderId) ?? null : null
  const deleteFolderTarget = deleteFolderId ? folders.find((folder) => folder.id === deleteFolderId) ?? null : null
  const activeOverviewFolder =
    previewFolderId ? visibleFolders.find((folder) => folder.id === previewFolderId) ?? null : null
  const previewFolderChildren = previewFolder
    ? folders.filter((folder) => folder.parentId === previewFolder.id)
    : []
  const deleteItemTarget = selectedFolder && deleteItemId
    ? selectedFolder.items.find((item) => item.id === deleteItemId) ?? null
    : null

  function createFolder(folder: Pick<ProjectFolder, 'name' | 'description' | 'color' | 'logo'>) {
    const creator = folderMemberFromProfile(currentProfile)
    const nextFolder: ProjectFolder = {
      ...folder,
      id: makeId('folder'),
      parentId: activeParentFolderId ?? undefined,
      createdAt: new Date().toISOString(),
      members: creator ? [creator] : [],
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

  function canMoveFolderIntoFolder(folderId: string, targetParentId: string | null) {
    if (folderId === targetParentId) return false
    if (!targetParentId) return true
    return !folderDescendantIds(folders, folderId).has(targetParentId)
  }

  function moveFolderIntoFolder(folderId: string, targetParentId: string | null) {
    if (!canMoveFolderIntoFolder(folderId, targetParentId)) return
    setFolders((current) =>
      current.map((folder) =>
        folder.id === folderId ? { ...folder, parentId: targetParentId ?? undefined } : folder
      )
    )
    if (previewFolderId === folderId) setPreviewFolderId(null)
    setDraggedFolderId(null)
    setDragOverFolderId(null)
  }

  function enterFolder(folderId: string) {
    setSelectedFolderId(null)
    setActiveParentFolderId(folderId)
    setPreviewFolderId(null)
    setSearch('')
  }

  function showFolderLevel(folderId: string | null) {
    setSelectedFolderId(null)
    setActiveParentFolderId(folderId)
    setPreviewFolderId(null)
    setSearch('')
  }

  function openFolderFromOverview(folder: ProjectFolder) {
    setSelectedFolderId(folder.id)
    setActiveItemFolderId(null)
    setSelectedItemIds([])
    setClipboard(null)
  }

  function openFolderContextMenu(event: React.MouseEvent<HTMLElement>, folderId: string) {
    event.preventDefault()
    event.stopPropagation()
    const menuWidth = 192
    const menuHeight = 132
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 12)
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 12)
    setFolderMenu({ folderId, x: Math.max(12, x), y: Math.max(12, y) })
  }

  function requestDeleteFolder(folderId: string) {
    setDeleteFolderId(folderId)
    setFolderMenu(null)
  }

  function confirmDeleteFolder(folderId: string) {
    const deletedIds = new Set([folderId, ...folderDescendantIds(folders, folderId)])
    setFolders((current) => current.filter((candidate) => !deletedIds.has(candidate.id)))
    if (selectedFolderId && deletedIds.has(selectedFolderId)) setSelectedFolderId(null)
    if (previewFolderId && deletedIds.has(previewFolderId)) setPreviewFolderId(null)
    if (activeParentFolderId && deletedIds.has(activeParentFolderId)) setActiveParentFolderId(null)
    if (renamingFolderId === folderId) setRenamingFolderId(null)
    if (logoFolderId === folderId) setLogoFolderId(null)
    if (deleteFolderId === folderId) setDeleteFolderId(null)
    setFolderMenu(null)
  }

  function openProjectChat(folder: ProjectFolder) {
    window.localStorage.setItem(PROJECT_CHAT_TARGET_KEY, localProjectChatId(folder.id))
    window.location.href = '/chat'
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

  function requestRemoveItem(itemId: string) {
    setDeleteItemId(itemId)
  }

  function removeItem(itemId: string) {
    if (!selectedFolder) return
    const deletedIds = new Set([itemId, ...projectItemDescendantIds(selectedFolder.items, itemId)])
    setFolders((current) =>
      current.map((folder) =>
        folder.id === selectedFolder.id
          ? { ...folder, items: folder.items.filter((item) => !deletedIds.has(item.id)) }
          : folder
      )
    )
    if (activeItemFolderId && deletedIds.has(activeItemFolderId)) setActiveItemFolderId(null)
    setSelectedItemIds((current) => current.filter((id) => !deletedIds.has(id)))
    if (deleteItemId === itemId) setDeleteItemId(null)
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

  function moveItemsToProjectFolder(itemIds: string[], targetProjectFolderId: string) {
    if (!selectedFolder || selectedFolder.id === targetProjectFolderId || itemIds.length === 0) return

    const selected = new Set(itemIds)
    const sourceItems = selectedFolder.items
    const movingItems = sourceItems.filter((item) => {
      if (selected.has(item.id)) return true

      let parentId = item.parentId
      while (parentId) {
        if (selected.has(parentId)) return true
        parentId = sourceItems.find((candidate) => candidate.id === parentId)?.parentId
      }

      return false
    })
    if (movingItems.length === 0) return

    const movingIds = new Set(movingItems.map((item) => item.id))
    const now = new Date().toISOString()
    const movedItems = movingItems.map((item) => ({
      ...item,
      parentId: item.parentId && movingIds.has(item.parentId) ? item.parentId : undefined,
      updatedAt: now,
    }))

    setFolders((current) =>
      current.map((folder) => {
        if (folder.id === selectedFolder.id) {
          return { ...folder, items: folder.items.filter((item) => !movingIds.has(item.id)) }
        }
        if (folder.id === targetProjectFolderId) {
          return { ...folder, items: [...movedItems, ...folder.items] }
        }
        return folder
      })
    )
    setSelectedItemIds([])
    setClipboard(null)
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
    const selectedFolderChildren = folders.filter((folder) => folder.parentId === selectedFolder.id)
    const openFolderId = selectedFolder.id
    const openFolderParentId = selectedFolder.parentId ?? null
    const selectedFolderParent = selectedFolder.parentId
      ? folders.find((folder) => folder.id === selectedFolder.parentId) ?? null
      : null

    function returnToSelectedFolderParent() {
      setSelectedFolderId(null)
      setActiveParentFolderId(openFolderParentId)
      setPreviewFolderId(openFolderId)
      setActiveItemFolderId(null)
      setSelectedItemIds([])
      setClipboard(null)
      setItemOpen(false)
      setLocalFolderOpen(false)
    }

    function createChildFolder(folder: Pick<ProjectFolder, 'name' | 'description' | 'color' | 'logo'>) {
      const creator = folderMemberFromProfile(currentProfile)
      const nextFolder: ProjectFolder = {
        ...folder,
        id: makeId('folder'),
        parentId: openFolderId,
        createdAt: new Date().toISOString(),
        members: creator ? [creator] : [],
        items: [],
      }
      setFolders((current) => [nextFolder, ...current])
      setSelectedFolderId(nextFolder.id)
      setActiveItemFolderId(null)
      setSelectedItemIds([])
      setClipboard(null)
    }

    return (
      <>
        <TopBar
          title="Prosjekter"
          noTranslateTitle
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => openProjectChat(selectedFolder)}>
                <MessageSquare size={16} />
                Chat
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setFolderOpen(true)}>
                <FolderOpen size={16} />
                <span data-no-translate>Ny mappe</span>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShareOpen(true)}>
                <Share2 size={16} />
                Del
              </Button>
              <Button size="sm" onClick={() => setItemOpen(true)}>
                <Plus size={16} />
                Legg til
              </Button>
            </div>
          }
        />

        <div className="flex-1 overflow-y-auto px-6 py-8">
          <button
            onClick={returnToSelectedFolderParent}
            className="mb-3 inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <ArrowLeft size={16} />
            {selectedFolderParent ? `Tilbake til ${selectedFolderParent.name}` : 'Tilbake til mapper'}
          </button>

          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm" aria-label="Prosjektsti">
            <button
              type="button"
              onClick={() => {
                setSelectedFolderId(null)
                setActiveParentFolderId(null)
                setPreviewFolderId(selectedFolder.id)
                setActiveItemFolderId(null)
              }}
              data-no-translate
              className="font-medium text-gray-500 transition hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-300"
            >
              Prosjekter
            </button>
            {selectedFolderPath.map((folder, index) => {
              const current = index === selectedFolderPath.length - 1
              return (
                <span key={folder.id} className="flex min-w-0 items-center gap-2">
                  <span className="text-gray-400 dark:text-gray-600">/</span>
                  {current ? (
                    <span className="max-w-56 truncate font-semibold text-gray-950 dark:text-gray-100">
                      {folder.name}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFolderId(folder.id)
                        setActiveItemFolderId(null)
                        setSelectedItemIds([])
                        setClipboard(null)
                      }}
                      className="max-w-56 truncate font-medium text-gray-500 transition hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-300"
                    >
                      {folder.name}
                    </button>
                  )}
                </span>
              )
            })}
          </nav>

          <main className="min-h-[64vh] rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <ProjectDetailContent
              folder={selectedFolder}
              projectFolderPath={selectedFolderPath.map((folder) => ({
                id: folder.id,
                label: folder.name,
              }))}
              childFolders={selectedFolderChildren}
              activeItemFolder={activeItemFolder}
              selectedItemIds={selectedItemIds}
              cutItemIds={clipboard?.mode === 'cut' ? clipboard.itemIds : []}
              onAddResource={() => setItemOpen(true)}
              onAddLocalFolder={() => setFolderOpen(true)}
              onOpenChat={() => openProjectChat(selectedFolder)}
              onShare={() => setShareOpen(true)}
              onUpdate={updateFolder}
              onOpenProjectFolder={(folderId) => {
                setSelectedFolderId(folderId)
                setActiveItemFolderId(null)
                setSelectedItemIds([])
                setClipboard(null)
              }}
              onToggleTask={toggleTask}
              onRemoveItem={requestRemoveItem}
              onOpenItemFolder={(itemId) => {
                setActiveItemFolderId(itemId)
                setSelectedItemIds([])
              }}
              onMoveItemsToFolder={moveItemsToFolder}
              onSelectItems={setSelectedItemIds}
              onCopyItems={(itemIds) => setClipboard({ mode: 'copy', itemIds })}
              onCutItems={(itemIds) => setClipboard({ mode: 'cut', itemIds })}
              onPasteItems={pasteItems}
              draggedProjectFolderId={draggedFolderId}
              dragOverProjectFolderId={dragOverFolderId}
              canMoveProjectFolder={canMoveFolderIntoFolder}
              onProjectFolderDragStart={(folderId) => setDraggedFolderId(folderId)}
              onProjectFolderDragEnd={() => {
                setDraggedFolderId(null)
                setDragOverFolderId(null)
              }}
              onProjectFolderDragOver={setDragOverFolderId}
              onProjectFolderDragLeave={(folderId) => {
                if (dragOverFolderId === folderId) setDragOverFolderId(null)
              }}
              onMoveProjectFolder={moveFolderIntoFolder}
              onMoveItemsToProjectFolder={moveItemsToProjectFolder}
            />
          </main>
        </div>

      <CreateItemModal open={itemOpen} onClose={() => setItemOpen(false)} onCreate={createItem} />
      <CreateFolderModal open={folderOpen} onClose={() => setFolderOpen(false)} onCreate={createChildFolder} />
      <DeleteItemModal
        open={Boolean(deleteItemTarget)}
        item={deleteItemTarget}
        items={selectedFolder.items}
        onClose={() => setDeleteItemId(null)}
        onConfirm={(itemId) => removeItem(itemId)}
      />
      <ShareProjectFolderModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          folder={selectedFolder}
        />
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
        title="Prosjekter"
        noTranslateTitle
        actions={
          <Button size="sm" onClick={() => setFolderOpen(true)} className="h-10 w-10 px-0" aria-label="Lag mappe">
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
                    placeholder="Søk i mapper"
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
                  <span data-no-translate>Ny mappe</span>
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => activeOverviewFolder && requestDeleteFolder(activeOverviewFolder.id)}
                  disabled={!activeOverviewFolder}
                  className="h-10 whitespace-nowrap"
                  title={activeOverviewFolder ? `Slett ${activeOverviewFolder.name}` : 'Velg en mappe først'}
                >
                  <Trash2 size={16} />
                  Slett mappe
                </Button>
              </div>
              {folderPath.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => showFolderLevel(null)}
                    onDragOver={(event) => {
                      if (!draggedFolderId || !canMoveFolderIntoFolder(draggedFolderId, null)) return
                      event.preventDefault()
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      const folderId = draggedFolderId ?? event.dataTransfer.getData('text/plain')
                      if (folderId) moveFolderIntoFolder(folderId, null)
                    }}
                    data-no-translate
                    className="font-medium text-gray-500 transition hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-300"
                  >
                    Prosjekter
                  </button>
                  {folderPath.map((folder) => (
                    <span key={folder.id} className="flex min-w-0 items-center gap-2">
                      <span className="text-gray-400 dark:text-gray-600">/</span>
                      <button
                        type="button"
                        onClick={() => showFolderLevel(folder.id)}
                        onDragOver={(event) => {
                          if (!draggedFolderId || !canMoveFolderIntoFolder(draggedFolderId, folder.id)) return
                          event.preventDefault()
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          const folderId = draggedFolderId ?? event.dataTransfer.getData('text/plain')
                          if (folderId) moveFolderIntoFolder(folderId, folder.id)
                        }}
                        className="max-w-48 truncate font-semibold text-gray-950 transition hover:text-purple-600 dark:text-gray-100 dark:hover:text-purple-300"
                      >
                        {folder.name}
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {folders.length === 0 ? (
              <div className="flex min-h-[52vh] flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 text-center dark:border-gray-800 dark:bg-gray-900/30">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300">
                  <Plus size={34} />
                </div>
                <h2 className="text-lg font-semibold text-gray-950 dark:text-gray-100">Ingen prosjekter enda</h2>
                <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
                  Start med en mappe. Etterpå kan du legge inn repoer, dokumenter, lenker og andre ressurser.
                </p>
                <Button className="mt-5" onClick={() => setFolderOpen(true)}>
                  <Plus size={18} />
                  Lag mappe
                </Button>
              </div>
            ) : visibleFolders.length === 0 ? (
              <div className="flex min-h-[42vh] flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 text-center dark:border-gray-800 dark:bg-gray-900/30">
                <FolderOpen size={38} className="mb-4 text-gray-300 dark:text-gray-700" />
                <h2 className="font-medium text-gray-950 dark:text-gray-100">
                  {search.trim() ? 'Ingen mapper funnet' : 'Ingen undermapper her'}
                </h2>
                <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                  {search.trim()
                    ? 'Prøv et annet søk, eller gå tilbake til en annen mappe.'
                    : 'Dra en mappe hit, eller lag en ny mappe på dette nivået.'}
                </p>
              </div>
            ) : previewMode ? (
              <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
                <aside className="space-y-3">
                  {visibleFolders.map((folder) => {
                    const active = folder.id === previewFolder?.id
                    const members = projectFolderMembers(folder, currentProfile)
                    const childCount = folderChildCount(folders, folder.id)
                    const isDropTarget = dragOverFolderId === folder.id

                    return (
                      <button
                        key={folder.id}
                        draggable
                        onDragStart={(event) => {
                          setDraggedFolderId(folder.id)
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', folder.id)
                        }}
                        onDragEnd={() => {
                          setDraggedFolderId(null)
                          setDragOverFolderId(null)
                        }}
                        onDragOver={(event) => {
                          if (!draggedFolderId || !canMoveFolderIntoFolder(draggedFolderId, folder.id)) return
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'move'
                          setDragOverFolderId(folder.id)
                        }}
                        onDragLeave={() => {
                          if (dragOverFolderId === folder.id) setDragOverFolderId(null)
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          const folderId = draggedFolderId ?? event.dataTransfer.getData('text/plain')
                          if (folderId) moveFolderIntoFolder(folderId, folder.id)
                        }}
                        onClick={() => setPreviewFolderId(folder.id)}
                        onDoubleClick={() => openFolderFromOverview(folder)}
                        onContextMenu={(event) => openFolderContextMenu(event, folder.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') openFolderFromOverview(folder)
                        }}
                        className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                          isDropTarget
                            ? 'border-cyan-400 bg-cyan-50 shadow-sm dark:border-cyan-500 dark:bg-cyan-950/30'
                            : active
                            ? 'border-purple-400 bg-purple-50 shadow-sm dark:border-purple-700 dark:bg-purple-950/30'
                            : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700'
                        }`}
                      >
                        <ProjectLogoThumbnail folder={folder} className="h-9 w-9" iconSize={18} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-950 dark:text-gray-100">{folder.name}</span>
                          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                            {childCount > 0 ? `${childCount} mapper` : projectFolderShareLabel(folder)}
                          </span>
                        </span>
                        <ProjectMemberBubbles members={members} max={3} />
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
                            <div className="mt-2 flex items-center gap-2">
                              <ProjectMemberBubbles members={projectFolderMembers(previewFolder, currentProfile)} max={5} />
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {projectFolderShareLabel(previewFolder)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => openFolderFromOverview(previewFolder)}>
                          <FolderOpen size={16} />
                          Åpne mappe
                        </Button>
                      </div>

                      {previewFolder.items.length === 0 && previewFolderChildren.length === 0 ? (
                        <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
                          <FileText size={38} className="mb-4 text-gray-300 dark:text-gray-700" />
                          <h2 className="font-medium text-gray-950 dark:text-gray-100">Mappen er tom</h2>
                          <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                            Legg inn notater, lenker, filer eller oppgaver når du vil samle noe for prosjektet.
                          </p>
                        </div>
                      ) : (
                        <div className="grid gap-3 p-5 lg:grid-cols-2">
                          {previewFolderChildren.map((childFolder) => (
                            <button
                              key={childFolder.id}
                              type="button"
                              onClick={() => enterFolder(childFolder.id)}
                              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-left transition hover:border-purple-400 hover:bg-purple-50/70 dark:border-gray-800 dark:bg-gray-950/40 dark:hover:border-purple-700 dark:hover:bg-purple-950/20"
                            >
                              <ProjectLogoThumbnail folder={childFolder} className="h-9 w-9" iconSize={18} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-gray-950 dark:text-gray-100">{childFolder.name}</span>
                                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">Undermappe</span>
                              </span>
                            </button>
                          ))}
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
                {visibleFolders.map((folder) => {
                  const members = projectFolderMembers(folder, currentProfile)
                  const active = folder.id === previewFolderId
                  const childCount = folderChildCount(folders, folder.id)
                  const isDropTarget = dragOverFolderId === folder.id

                  return (
                    <div
                      key={folder.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggedFolderId(folder.id)
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', folder.id)
                      }}
                      onDragEnd={() => {
                        setDraggedFolderId(null)
                        setDragOverFolderId(null)
                      }}
                      onDragOver={(event) => {
                        if (!draggedFolderId || !canMoveFolderIntoFolder(draggedFolderId, folder.id)) return
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                        setDragOverFolderId(folder.id)
                      }}
                      onDragLeave={() => {
                        if (dragOverFolderId === folder.id) setDragOverFolderId(null)
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        const folderId = draggedFolderId ?? event.dataTransfer.getData('text/plain')
                        if (folderId) moveFolderIntoFolder(folderId, folder.id)
                      }}
                      onContextMenu={(event) => openFolderContextMenu(event, folder.id)}
                      className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                        isDropTarget
                          ? 'border-cyan-400 bg-cyan-50 shadow-sm dark:border-cyan-500 dark:bg-cyan-950/30'
                          : active
                          ? 'border-purple-500 bg-purple-50/70 shadow-sm dark:border-purple-700 dark:bg-purple-950/30'
                          : 'border-gray-200 bg-white hover:border-purple-400 hover:bg-purple-50/60 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-purple-700 dark:hover:bg-purple-950/20'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewFolderId(folder.id)}
                        onDoubleClick={() => openFolderFromOverview(folder)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') openFolderFromOverview(folder)
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        aria-pressed={active}
                      >
                        <ProjectLogoThumbnail folder={folder} className="h-9 w-9" iconSize={18} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-950 dark:text-gray-100">{folder.name}</span>
                          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                            {childCount > 0 ? `${childCount} mapper` : projectFolderShareLabel(folder)}
                          </span>
                        </span>
                      </button>
                      <ProjectMemberBubbles members={members} max={3} />
                      <button
                        type="button"
                        onClick={() => enterFolder(folder.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-purple-600 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 group-hover:opacity-100 dark:hover:bg-gray-800 dark:hover:text-purple-300"
                        aria-label={`Vis mapper i ${folder.name}`}
                        title="Vis undermapper"
                      >
                        <FolderOpen size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => openFolderContextMenu(event, folder.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-purple-600 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 group-hover:opacity-100 dark:hover:bg-gray-800 dark:hover:text-purple-300"
                        aria-label={`Mappevalg for ${folder.name}`}
                        title="Mappevalg"
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
      </div>

      <CreateFolderModal open={folderOpen} onClose={() => setFolderOpen(false)} onCreate={createFolder} />
      <CreateItemModal open={itemOpen} onClose={() => setItemOpen(false)} onCreate={createItem} />
      {menuFolder && folderMenu && (
        <FolderContextMenu
          folder={menuFolder}
          x={folderMenu.x}
          y={folderMenu.y}
          onClose={() => setFolderMenu(null)}
          onRename={() => {
            setRenamingFolderId(menuFolder.id)
            setFolderMenu(null)
          }}
          onLogo={() => {
            setLogoFolderId(menuFolder.id)
            setFolderMenu(null)
          }}
          onDelete={() => requestDeleteFolder(menuFolder.id)}
        />
      )}
      <DeleteFolderModal
        open={Boolean(deleteFolderTarget)}
        folder={deleteFolderTarget}
        folders={folders}
        onClose={() => setDeleteFolderId(null)}
        onConfirm={(folderId) => confirmDeleteFolder(folderId)}
      />
      {renamingFolder && (
        <RenameFolderModal
          key={renamingFolder.id}
          open={Boolean(renamingFolder)}
          folder={renamingFolder}
          onClose={() => setRenamingFolderId(null)}
          onSave={(name) => {
            updateFolder(renamingFolder.id, { name })
            setRenamingFolderId(null)
          }}
        />
      )}
      {logoFolder && (
        <LogoEditorModal
          key={`${logoFolder.id}-overview-logo`}
          open={Boolean(logoFolder)}
          onClose={() => setLogoFolderId(null)}
          folder={logoFolder}
          onSave={({ logo, color }) => {
            updateFolder(logoFolder.id, { logo, color })
            setLogoFolderId(null)
          }}
        />
      )}
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
  if (item.type === 'local_folder') return 'Mappe'
  return meta.label
}

function githubRepoPath(item: ProjectItem) {
  const fromTitle = item.title.match(/^([^/\s]+)\/([^/\s]+)$/)
  if (fromTitle) {
    return `/repositories/${encodeURIComponent(fromTitle[1])}/${encodeURIComponent(fromTitle[2].replace(/\.git$/, ''))}`
  }

  if (!item.url) return null

  try {
    const url = new URL(item.url)
    if (url.hostname !== 'github.com') return null
    const [owner, repo] = url.pathname.split('/').filter(Boolean)
    if (!owner || !repo) return null
    return `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo.replace(/\.git$/, ''))}`
  } catch {
    return null
  }
}

function projectItemOpenTarget(item: ProjectItem, projectPath: string[] = []): ProjectItemOpenTarget | null {
  if (item.type === 'github') {
    const repoPath = githubRepoPath(item)
    return repoPath
      ? { href: `${repoPath}${projectReturnQuery(projectPath)}`, external: false, label: 'Åpne reposide' }
      : null
  }

  if (item.url && ['url', 'notion', 'docs', 'sheets', 'word', 'excel'].includes(item.type)) {
    return { href: item.url, external: true, label: 'Åpne lenke' }
  }

  if (item.type === 'document' && item.url) {
    return { href: item.url, external: true, label: 'Åpne dokument' }
  }

  return null
}

function openProjectItem(item: ProjectItem, projectPath: string[] = []) {
  const target = projectItemOpenTarget(item, projectPath)
  if (!target) return

  if (target.external) {
    if (target.href.startsWith('data:')) {
      const blobUrl = dataUrlToBlobUrl(target.href)
      if (blobUrl) {
        window.open(blobUrl, '_blank', 'noopener,noreferrer')
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
        return
      }
    }
    window.open(target.href, '_blank', 'noopener,noreferrer')
    return
  }

  window.location.assign(target.href)
}

function dataUrlToBlobUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/)
  if (!match) return null
  const [, mime = 'application/octet-stream', base64Flag, payload] = match
  try {
    if (base64Flag) {
      const binary = atob(payload)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return URL.createObjectURL(new Blob([bytes], { type: mime }))
    }
    const decoded = decodeURIComponent(payload)
    return URL.createObjectURL(new Blob([decoded], { type: mime }))
  } catch {
    return null
  }
}

function ProjectItemCard({
  item,
  projectPath,
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
  projectPath: string[]
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
  const openTarget = projectItemOpenTarget(item, projectPath)

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
        {openTarget && (
          openTarget.external ? (
            <a
              href={openTarget.href}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white hover:text-purple-600 dark:hover:bg-gray-900 dark:hover:text-purple-300"
              aria-label={openTarget.label}
              title={openTarget.label}
            >
              <ExternalLink size={16} />
            </a>
          ) : (
            <Link
              href={openTarget.href}
              onClick={(event) => event.stopPropagation()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white hover:text-purple-600 dark:hover:bg-gray-900 dark:hover:text-purple-300"
              aria-label={openTarget.label}
              title={openTarget.label}
            >
              <ExternalLink size={16} />
            </Link>
          )
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
        className={`group cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-left transition hover:border-purple-400 hover:bg-purple-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-gray-800 dark:bg-gray-950/40 dark:hover:border-purple-700 dark:hover:bg-purple-950/20 ${
          cut ? 'opacity-45' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white shadow-sm">
              <Folder size={19} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-medium text-gray-950 dark:text-gray-100">{item.title}</h3>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">Mappe</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <FolderOpen size={16} className="text-gray-400 transition group-hover:text-purple-600 dark:group-hover:text-purple-300" />
            <button
              onClick={(event) => {
                event.stopPropagation()
                onRemove(item.id)
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 opacity-0 transition hover:bg-white hover:text-red-500 focus:opacity-100 dark:hover:bg-gray-900 group-hover:opacity-100"
              aria-label="Fjern mappe"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      draggable
      role="button"
      tabIndex={0}
      onClick={(event) => onSelect(item.id, event)}
      onDoubleClick={() => {
        if (openTarget) openProjectItem(item, projectPath)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && openTarget) {
          event.preventDefault()
          openProjectItem(item, projectPath)
        }
      }}
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
      <span className={`inline-flex shrink-0 overflow-hidden rounded-lg bg-white shadow-sm ${className}`}>
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

function ProjectMemberBubbles({
  members,
  max = 4,
}: {
  members: ProjectFolderMember[]
  max?: number
}) {
  const visible = members.slice(0, max)
  const extra = Math.max(0, members.length - visible.length)

  if (visible.length === 0) return null

  return (
    <span className="flex shrink-0 items-center -space-x-2" aria-label={`${members.length} medlemmer`}>
      {visible.map((member) => (
        <span key={member.id} title={member.role === 'creator' ? `${member.name} creator` : member.name}>
          <Avatar
            name={member.name}
            src={member.avatar_url}
            size="xs"
            className="ring-2 ring-white dark:ring-gray-900"
          />
        </span>
      ))}
      {extra > 0 && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500 ring-2 ring-white dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-900">
          +{extra}
        </span>
      )}
    </span>
  )
}

function ProjectDetailContent({
  folder,
  projectFolderPath,
  childFolders,
  activeItemFolder,
  selectedItemIds,
  cutItemIds,
  onAddResource,
  onAddLocalFolder,
  onOpenChat,
  onShare,
  onUpdate,
  onOpenProjectFolder,
  onToggleTask,
  onRemoveItem,
  onOpenItemFolder,
  onMoveItemsToFolder,
  onSelectItems,
  onCopyItems,
  onCutItems,
  onPasteItems,
  draggedProjectFolderId,
  dragOverProjectFolderId,
  canMoveProjectFolder,
  onProjectFolderDragStart,
  onProjectFolderDragEnd,
  onProjectFolderDragOver,
  onProjectFolderDragLeave,
  onMoveProjectFolder,
  onMoveItemsToProjectFolder,
}: {
  folder: ProjectFolder
  projectFolderPath: ProjectPathSegment[]
  childFolders: ProjectFolder[]
  activeItemFolder: ProjectItem | null
  selectedItemIds: string[]
  cutItemIds: string[]
  onAddResource: () => void
  onAddLocalFolder: () => void
  onOpenChat: () => void
  onShare: () => void
  onUpdate: (folderId: string, updates: Partial<Pick<ProjectFolder, 'name' | 'description' | 'logo' | 'color'>>) => void
  onOpenProjectFolder: (folderId: string) => void
  onToggleTask: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
  onOpenItemFolder: (itemId: string | null) => void
  onMoveItemsToFolder: (itemIds: string[], targetFolderId: string) => void
  onSelectItems: (itemIds: string[]) => void
  onCopyItems: (itemIds: string[]) => void
  onCutItems: (itemIds: string[]) => void
  onPasteItems: (targetFolderId: string | null) => void
  draggedProjectFolderId: string | null
  dragOverProjectFolderId: string | null
  canMoveProjectFolder: (folderId: string, targetParentId: string | null) => boolean
  onProjectFolderDragStart: (folderId: string) => void
  onProjectFolderDragEnd: () => void
  onProjectFolderDragOver: (folderId: string | null) => void
  onProjectFolderDragLeave: (folderId: string) => void
  onMoveProjectFolder: (folderId: string, targetParentId: string | null) => void
  onMoveItemsToProjectFolder: (itemIds: string[], targetProjectFolderId: string) => void
}) {
  const [logoOpen, setLogoOpen] = useState(false)
  const currentProfile = useUser()
  const members = projectFolderMembers(folder, currentProfile)
  const visibleItems = folder.items.filter((item) => (item.parentId ?? null) === (activeItemFolder?.id ?? null))
  const visibleFolderItems = visibleItems.filter((item) => item.type === 'local_folder')
  const visibleResourceItems = visibleItems.filter((item) => item.type !== 'local_folder')
  const activeItemFolderPath = useMemo(
    () => projectItemFolderPath(folder.items, activeItemFolder?.id ?? null),
    [activeItemFolder?.id, folder.items]
  )
  const projectPathLabels = useMemo(
    () => [...projectFolderPath.map((segment) => segment.label), ...activeItemFolderPath.map((item) => item.title)],
    [activeItemFolderPath, projectFolderPath]
  )
  const selectedVisibleIndex = visibleItems.findIndex((item) => selectedItemIds.includes(item.id))
  const selectedVisibleIds = selectedItemIds.filter((id) => visibleItems.some((item) => item.id === id))

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

  function handleExplorerShortcut(event: Pick<KeyboardEvent | React.KeyboardEvent<HTMLElement>, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'preventDefault'>) {
    const command = event.metaKey || event.ctrlKey
    if (command && event.key.toLowerCase() === 'c' && selectedVisibleIds.length > 0) {
      event.preventDefault()
      onCopyItems(selectedVisibleIds)
      return
    }
    if (command && event.key.toLowerCase() === 'x' && selectedVisibleIds.length > 0) {
      event.preventDefault()
      onCutItems(selectedVisibleIds)
      return
    }
    if (command && event.key.toLowerCase() === 'v') {
      event.preventDefault()
      onPasteItems(activeItemFolder?.id ?? null)
      return
    }
    if (event.key === 'Enter' && selectedVisibleIds.length === 1) {
      const selected = visibleItems.find((item) => item.id === selectedVisibleIds[0])
      if (selected?.type === 'local_folder') {
        event.preventDefault()
        onOpenItemFolder(selected.id)
        return
      }
      if (selected && projectItemOpenTarget(selected)) {
        event.preventDefault()
        openProjectItem(selected, projectPathLabels)
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

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return
      handleExplorerShortcut(event)
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  })

  function dragItems(itemId: string) {
    if (!selectedItemIds.includes(itemId)) onSelectItems([itemId])
    return selectedItemIds.includes(itemId) ? selectedItemIds : [itemId]
  }

  function projectFolderFromDrag(event: React.DragEvent<HTMLElement>) {
    return (
      event.dataTransfer.getData('application/x-sync-project-folder') ||
      event.dataTransfer.getData('text/plain')
    )
  }

  function projectItemIdsFromDrag(event: React.DragEvent<HTMLElement>) {
    const fallback = event.dataTransfer.getData('text/plain')
    let draggedItemIds = fallback ? [fallback] : []

    try {
      const encoded = event.dataTransfer.getData('application/x-sync-project-items')
      if (encoded) draggedItemIds = JSON.parse(encoded) as string[]
    } catch {
      draggedItemIds = fallback ? [fallback] : []
    }

    return draggedItemIds
  }

  function isProjectItemDrag(event: React.DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes('application/x-sync-project-items')
  }

  function handleProjectFolderDragStart(event: React.DragEvent<HTMLElement>, folderId: string) {
    onProjectFolderDragStart(folderId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-sync-project-folder', folderId)
    event.dataTransfer.setData('text/plain', folderId)
  }

  function handleProjectFolderDrop(event: React.DragEvent<HTMLElement>, targetParentId: string | null) {
    const folderId = projectFolderFromDrag(event)
    if (!folderId || !canMoveProjectFolder(folderId, targetParentId)) return
    event.preventDefault()
    event.stopPropagation()
    onMoveProjectFolder(folderId, targetParentId)
  }

  function handleProjectItemDrop(event: React.DragEvent<HTMLElement>, targetProjectFolderId: string) {
    if (!isProjectItemDrag(event)) return false

    const draggedItemIds = projectItemIdsFromDrag(event)
    if (draggedItemIds.length === 0) return false

    event.preventDefault()
    event.stopPropagation()
    onMoveItemsToProjectFolder(draggedItemIds, targetProjectFolderId)
    onProjectFolderDragOver(null)
    return true
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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ProjectMemberBubbles members={members} max={5} />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {projectFolderShareLabel(folder)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onOpenChat}>
            <MessageSquare size={16} />
            Chat
          </Button>
          <Button size="sm" variant="secondary" onClick={onAddLocalFolder}>
            <FolderOpen size={16} />
            <span data-no-translate>Ny mappe</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={onShare}>
            <Share2 size={16} />
            Del
          </Button>
          <Button size="sm" onClick={onAddResource}>
            <Plus size={16} />
            Legg til
          </Button>
        </div>
      </div>

      <section
        className="pt-5 focus-visible:outline-none"
        tabIndex={0}
        onDragOver={(event) => {
          const folderId = draggedProjectFolderId
          if (!folderId || !canMoveProjectFolder(folderId, folder.id)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          onProjectFolderDragOver(folder.id)
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) onProjectFolderDragLeave(folder.id)
        }}
        onDrop={(event) => handleProjectFolderDrop(event, folder.id)}
        onClick={(event) => {
          if (event.currentTarget === event.target) onSelectItems([])
        }}
      >
        {visibleItems.length === 0 && (activeItemFolder || childFolders.length === 0) ? (
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
              Legg til
            </Button>
            <Button className="mt-2" variant="secondary" onClick={onAddLocalFolder}>
              <FolderOpen size={16} />
              <span data-no-translate>Ny mappe</span>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {!activeItemFolder &&
              childFolders.map((childFolder) => {
                const isDropTarget = dragOverProjectFolderId === childFolder.id
                const isDragging = draggedProjectFolderId === childFolder.id

                return (
                  <button
                    key={childFolder.id}
                    type="button"
                    draggable
                    onDragStart={(event) => handleProjectFolderDragStart(event, childFolder.id)}
                    onDragEnd={onProjectFolderDragEnd}
                    onDragOver={(event) => {
                      if (isProjectItemDrag(event)) {
                        event.preventDefault()
                        event.stopPropagation()
                        event.dataTransfer.dropEffect = 'move'
                        onProjectFolderDragOver(childFolder.id)
                        return
                      }
                      if (!draggedProjectFolderId || !canMoveProjectFolder(draggedProjectFolderId, childFolder.id)) return
                      event.preventDefault()
                      event.stopPropagation()
                      event.dataTransfer.dropEffect = 'move'
                      onProjectFolderDragOver(childFolder.id)
                    }}
                    onDragLeave={() => onProjectFolderDragLeave(childFolder.id)}
                    onDrop={(event) => {
                      if (handleProjectItemDrop(event, childFolder.id)) return
                      handleProjectFolderDrop(event, childFolder.id)
                    }}
                    onClick={() => onOpenProjectFolder(childFolder.id)}
                    className={`group flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                      isDropTarget
                        ? 'border-purple-500 bg-purple-950/30 ring-1 ring-purple-500/70 dark:border-purple-500'
                        : 'border-gray-200 bg-gray-50 hover:border-purple-400 hover:bg-purple-50/70 dark:border-gray-800 dark:bg-gray-950/40 dark:hover:border-purple-700 dark:hover:bg-purple-950/20'
                    } ${isDragging ? 'opacity-50' : ''}`}
                  >
                  <div className="flex min-w-0 items-center gap-3">
                    <ProjectLogoThumbnail folder={childFolder} className="h-10 w-10" iconSize={19} />
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-gray-950 dark:text-gray-100">{childFolder.name}</h3>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {folderChildCount(childFolders, childFolder.id) > 0
                          ? `${folderChildCount(childFolders, childFolder.id)} mapper`
                          : 'Mappe'}
                      </p>
                    </div>
                  </div>
                  <FolderOpen size={16} className="shrink-0 text-gray-400 transition group-hover:text-purple-600 dark:group-hover:text-purple-300" />
                  </button>
                )
              })}
            {[...visibleFolderItems, ...visibleResourceItems].map((item) => (
              <ProjectItemCard
                key={item.id}
                item={item}
                projectPath={projectPathLabels}
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
  const openTarget = projectItemOpenTarget(item)

  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-950/40">
      <div className="flex min-w-0 items-center justify-between gap-3">
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
        {openTarget && (
          openTarget.external ? (
            <a
              href={openTarget.href}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white hover:text-purple-600 dark:hover:bg-gray-900 dark:hover:text-purple-300"
              aria-label={openTarget.label}
              title={openTarget.label}
            >
              <ExternalLink size={16} />
            </a>
          ) : (
            <Link
              href={openTarget.href}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white hover:text-purple-600 dark:hover:bg-gray-900 dark:hover:text-purple-300"
              aria-label={openTarget.label}
              title={openTarget.label}
            >
              <ExternalLink size={16} />
            </Link>
          )
        )}
      </div>
    </article>
  )
}

function FolderContextMenu({
  folder,
  x,
  y,
  onClose,
  onRename,
  onLogo,
  onDelete,
}: {
  folder: ProjectFolder
  x: number
  y: number
  onClose: () => void
  onRename: () => void
  onLogo: () => void
  onDelete: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return
      onClose()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl shadow-gray-900/10 dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/30"
      style={{ left: x, top: y }}
      role="menu"
      aria-label={`Mappevalg for ${folder.name}`}
    >
      <button
        type="button"
        onClick={onRename}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
        role="menuitem"
      >
        <Pencil size={15} />
        Endre navn
      </button>
      <button
        type="button"
        onClick={onLogo}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
        role="menuitem"
      >
        <ImageIcon size={15} />
        Endre logo
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
        role="menuitem"
      >
        <Trash2 size={15} />
        Slett mappe
      </button>
    </div>
  )
}

function DeleteItemModal({
  open,
  item,
  items,
  onClose,
  onConfirm,
}: {
  open: boolean
  item: ProjectItem | null
  items: ProjectItem[]
  onClose: () => void
  onConfirm: (itemId: string) => void
}) {
  if (!item) return null

  const descendantItems = [...projectItemDescendantIds(items, item.id)]
    .map((itemId) => items.find((candidate) => candidate.id === itemId))
    .filter((candidate): candidate is ProjectItem => Boolean(candidate))
  const totalItems = 1 + descendantItems.length
  const meta = itemTypeMeta[item.type]
  const Icon = meta.icon

  return (
    <Modal open={open} onClose={onClose} title="Slett innhold" className="max-w-md">
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
          <Trash2 size={20} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Er du sikker på at du vil slette &quot;{item.title}&quot;?</p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-200">
              {descendantItems.length > 0
                ? `Dette sletter elementet og ${descendantItems.length} underliggende elementer.`
                : 'Dette fjerner elementet fra mappen.'}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-purple-600 shadow-sm dark:bg-gray-900 dark:text-purple-300">
              <Icon size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-950 dark:text-gray-100">{item.title}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {projectItemTypeLabel(item)} {totalItems > 1 ? `- ${totalItems} elementer totalt` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="button" variant="danger" onClick={() => onConfirm(item.id)}>
            <Trash2 size={16} />
            Slett
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DeleteFolderModal({
  open,
  folder,
  folders,
  onClose,
  onConfirm,
}: {
  open: boolean
  folder: ProjectFolder | null
  folders: ProjectFolder[]
  onClose: () => void
  onConfirm: (folderId: string) => void
}) {
  if (!folder) return null

  const descendantFolders = [...folderDescendantIds(folders, folder.id)]
    .map((folderId) => folders.find((candidate) => candidate.id === folderId))
    .filter((candidate): candidate is ProjectFolder => Boolean(candidate))
  const totalItems = folder.items.length + descendantFolders.length

  return (
    <Modal open={open} onClose={onClose} title="Slett mappe" className="max-w-xl">
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
          <Trash2 size={20} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Er du sikker på at du vil slette &quot;{folder.name}&quot;?</p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-200">
              Dette sletter mappen og alt innholdet i den permanent fra prosjektoversikten.
            </p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-gray-950 dark:text-gray-100">Innhold i mappen</h3>
            <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {totalItems} {totalItems === 1 ? 'element' : 'elementer'}
            </span>
          </div>

          {totalItems === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
              Mappen er tom.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
              {descendantFolders.map((childFolder) => (
                <div
                  key={childFolder.id}
                  className="flex items-center gap-3 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800"
                >
                  <ProjectLogoThumbnail folder={childFolder} className="h-8 w-8" iconSize={16} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-950 dark:text-gray-100">{childFolder.name}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">Undermappe</p>
                  </div>
                </div>
              ))}
              {folder.items.map((item) => {
                const meta = itemTypeMeta[item.type]
                const Icon = meta.icon

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 border-b border-gray-100 px-3 py-2.5 last:border-b-0 dark:border-gray-800"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-950 dark:text-gray-100">{item.title}</p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{projectItemTypeLabel(item)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="button" variant="danger" onClick={() => onConfirm(folder.id)}>
            <Trash2 size={16} />
            Slett mappe
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function RenameFolderModal({
  open,
  folder,
  onClose,
  onSave,
}: {
  open: boolean
  folder: ProjectFolder
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(folder.name)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) return
    onSave(nextName)
  }

  return (
    <Modal open={open} onClose={onClose} title="Endre mappenavn">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          autoFocus
          label="Navn"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Mappenavn"
          required
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit">
            <Check size={16} />
            Lagre
          </Button>
        </div>
      </form>
    </Modal>
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
    <Modal open={open} onClose={onClose} title="Ny mappe">
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

function ShareProjectFolderModal({
  open,
  onClose,
  folder,
}: {
  open: boolean
  onClose: () => void
  folder: ProjectFolder
}) {
  const currentProfile = useUser()
  const [synced, setSynced] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusByUser, setStatusByUser] = useState<Record<string, SendStatus>>({})

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function loadSyncedPeople() {
      setLoading(true)
      setError(null)
      setSearch('')
      setStatusByUser({})

      try {
        const [profilesRes, connectionsRes] = await Promise.all([
          fetch('/api/people'),
          fetch('/api/connections'),
        ])
        if (!profilesRes.ok) throw new Error('Kunne ikke hente folk.')
        const peopleData = (await profilesRes.json()) as Profile[]
        const connData = connectionsRes.ok
          ? ((await connectionsRes.json()) as {
              connections?: Record<string, string>
              sync?: Record<string, string>
            })
          : { connections: {}, sync: {} }

        if (cancelled) return
        const syncMap = connData.sync ?? connData.connections ?? {}
        const syncedIds = new Set(
          Object.entries(syncMap)
            .filter(([, state]) => state === 'synced')
            .map(([id]) => id)
        )
        setSynced(peopleData.filter((profile) => syncedIds.has(profile.id)))
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Kunne ikke hente venner.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadSyncedPeople()
    return () => {
      cancelled = true
    }
  }, [open])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return synced
    return synced.filter(
      (profile) =>
        profile.name.toLowerCase().includes(query) ||
        (profile.email ?? '').toLowerCase().includes(query)
    )
  }, [synced, search])

  async function sendFolder(targetProfile: Profile) {
    const members = projectFolderMembers(folder, currentProfile)
    setStatusByUser((current) => ({ ...current, [targetProfile.id]: 'sending' }))

    try {
      const response = await fetch('/api/direct-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: targetProfile.id,
          type: 'project_folder_share',
          payload: {
            name: folder.name,
            description: folder.description,
            color: folder.color,
            logo: folder.logo ?? null,
            kind: 'project_folder_share',
            members,
            shared_from: folder.sharedFrom ?? folderMemberFromProfile(currentProfile),
            items: folder.items,
            item_count: folder.items.length,
          },
        }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Kunne ikke dele mappen.')
      }

      setStatusByUser((current) => ({ ...current, [targetProfile.id]: 'sent' }))
    } catch {
      setStatusByUser((current) => ({ ...current, [targetProfile.id]: 'error' }))
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Del mappe">
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/50">
          <div className="flex items-center gap-3">
            <ProjectLogoThumbnail folder={folder} className="h-10 w-10" iconSize={20} open />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-950 dark:text-gray-100">{folder.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {folder.items.length} ressurser deles som en kopi
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Velg venner
            </p>
            <span className="text-xs text-gray-400 dark:text-gray-500">{synced.length}</span>
          </div>
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Søk etter venn..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/40"
              >
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-7 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        ) : synced.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center dark:border-gray-800">
            <Users size={20} className="text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Ingen synkede venner ennå</p>
            <p className="max-w-xs text-xs text-gray-400 dark:text-gray-500">
              Gå til People og sync med noen før du deler mapper.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
            Ingen treff.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {filtered.map((profile) => {
              const status = statusByUser[profile.id] ?? 'idle'
              const sent = status === 'sent'
              const sending = status === 'sending'
              const failed = status === 'error'

              return (
                <li
                  key={profile.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <Avatar name={profile.name} src={profile.avatar_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{profile.name}</p>
                    {failed && <p className="text-[11px] text-red-500">Prøv igjen</p>}
                  </div>
                  <button
                    type="button"
                    disabled={sending || sent}
                    onClick={() => sendFolder(profile)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
                      sent
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                        : sending
                          ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          : 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white hover:from-purple-600 hover:to-fuchsia-600'
                    }`}
                  >
                    {sent ? <Check size={12} /> : <Send size={12} />}
                    {sent ? 'Sendt' : sending ? 'Sender...' : 'Send'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
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

    if (usesFile && file) {
      if (file.size > 5 * 1024 * 1024) {
        window.alert('Filen er for stor. Maks 5 MB for nå.')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') return
        onCreate({
          type: 'document',
          title: itemTitle,
          body: '',
          url: reader.result,
          fileName: file.name,
          fileSize: file.size,
          status: 'Uploaded',
        })
        reset()
        onClose()
      }
      reader.readAsDataURL(file)
      return
    }

    onCreate({
      type: mode === 'app' ? appType : mode,
      title: itemTitle,
      body: '',
      url: mode === 'url' ? url.trim() : mode === 'app' ? selectedApp.url : undefined,
      status: mode === 'app' ? 'Created' : 'Connected',
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
    const repoName = newRepoName.trim()
    if (!repoName) return

    const existingRepo = repos.find((repo) => repo.name.toLowerCase() === repoName.toLowerCase())
    if (existingRepo) {
      setCreateRepoError(`Repoet ${existingRepo.full_name} finnes allerede. Velg det fra "Velg repo", eller bruk et nytt navn.`)
      return
    }

    setCreatingRepo(true)
    setCreateRepoError(null)

    try {
      const response = await fetch('/api/github/create-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: repoName,
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
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Legg til ressurs" className="max-w-4xl">
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
      status: 'Mappe',
    })
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Ny mappe">
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
