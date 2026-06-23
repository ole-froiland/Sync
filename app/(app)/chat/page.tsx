'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useUser } from '@/context/UserContext'
import { mockMessages } from '@/lib/mock-data'
import { formatDate, cn } from '@/lib/utils'
import {
  Hash,
  Send,
  Book,
  Check,
  ChevronLeft,
  X as XIcon,
  ExternalLink,
  Inbox,
  BellOff,
  Bell,
  FolderOpen,
  Plus,
  Trash2,
} from 'lucide-react'
import type { Message, Profile, Project } from '@/types'
import {
  CHAT_META_EVENT,
  readChatReadMap,
  readMutedUserIds,
  writeChatReadMap,
  writeMutedUserIds,
} from '@/lib/chat-meta'
import {
  channelToProject,
  createChatChannel,
  deleteChatChannel,
  isChatChannelId,
  readChatChannels,
} from '@/lib/chat-channels'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')
const PROJECT_FOLDERS_STORAGE_KEY = 'sync-project-folders-v1'
const PROJECT_CHAT_TARGET_KEY = 'sync-open-project-chat'
const LOCAL_PROJECT_PREFIX = 'project-folder:'
const IMAGE_MESSAGE_PREFIX = '__sync_image__:'
const MAX_PASTED_IMAGE_BYTES = 5 * 1024 * 1024

type RepoSharePayload = {
  full_name?: string
  name?: string
  url?: string
  owner?: string
  description?: string | null
  language?: string | null
  kind?: 'sync_request' | 'project_folder_share'
}

type ProjectLogoPayload = {
  type: 'icon' | 'emoji' | 'image'
  value: string
}

type ProjectItemPayload = {
  id?: string
  type?: string
  title?: string
  body?: string
  url?: string
  path?: string
  fileName?: string
  fileSize?: number
  parentId?: string
  done?: boolean
  status?: string
  createdAt?: string
  updatedAt?: string
}

type ProjectFolderMemberPayload = {
  id: string
  name: string
  avatar_url: string | null
  role?: 'creator' | 'member'
}

type ProjectFolderSharePayload = {
  kind?: 'project_folder_share'
  name?: string
  description?: string
  color?: string
  logo?: ProjectLogoPayload | null
  members?: ProjectFolderMemberPayload[]
  shared_from?: ProjectFolderMemberPayload | null
  items?: ProjectItemPayload[]
  item_count?: number
}


type ImagePayload = {
  data_url: string
  name?: string
  mime_type?: string
  size?: number
}

type DirectMessage = {
  id: string
  sender_id: string
  receiver_id: string
  type: 'text' | 'repo_share' | 'project_folder_share'
  body: string | null
  payload: RepoSharePayload | ProjectFolderSharePayload | ImagePayload | null
  state: 'sent' | 'accepted' | 'rejected'
  created_at: string
  updated_at: string
  sender?: { id: string; name: string; avatar_url: string | null }
}

type ActiveTarget =
  | { kind: 'project'; project: Project }
  | { kind: 'dm'; user: Profile }

type Toast = { id: number; tone: 'success' | 'error'; message: string }


function isLocalProjectId(projectId: string) {
  return projectId.startsWith(LOCAL_PROJECT_PREFIX) || isChatChannelId(projectId)
}

function localProjectChatStorageKey(projectId: string) {
  return `sync-project-folder-chat:${projectId}`
}


function readLocalProjectMessages(projectId: string): Message[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(localProjectChatStorageKey(projectId))
    const messages = raw ? (JSON.parse(raw) as Message[]) : []
    return Array.isArray(messages) ? messages : []
  } catch {
    return []
  }
}

function writeLocalProjectMessages(projectId: string, messages: Message[]) {
  window.localStorage.setItem(localProjectChatStorageKey(projectId), JSON.stringify(messages))
}

function isProjectFolderShareMessage(message: DirectMessage) {
  const payload = (message.payload ?? {}) as ProjectFolderSharePayload
  return (
    message.type === 'project_folder_share' ||
    payload.kind === 'project_folder_share' ||
    Array.isArray(payload.items)
  )
}

function encodeProjectImageMessage(payload: ImagePayload) {
  return `${IMAGE_MESSAGE_PREFIX}${JSON.stringify(payload)}`
}

function parseProjectImageMessage(body: string | null): ImagePayload | null {
  if (!body?.startsWith(IMAGE_MESSAGE_PREFIX)) return null
  try {
    const payload = JSON.parse(body.slice(IMAGE_MESSAGE_PREFIX.length)) as ImagePayload
    if (!payload.data_url?.startsWith('data:image/')) return null
    return payload
  } catch {
    return null
  }
}

function imageFileToPayload(file: File): Promise<ImagePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read image.'))
        return
      }
      resolve({
        data_url: reader.result,
        name: file.name || 'pasted-image',
        mime_type: file.type,
        size: file.size,
      })
    }
    reader.onerror = () => reject(new Error('Could not read image.'))
    reader.readAsDataURL(file)
  })
}

function makeProjectFolderId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function importSharedProjectFolder(payload: ProjectFolderSharePayload, sender?: DirectMessage['sender']) {
  const now = new Date().toISOString()
  const sourceItems = Array.isArray(payload.items) ? payload.items : []
  const idMap = new Map<string, string>()

  for (const item of sourceItems) {
    if (item.id) idMap.set(item.id, makeProjectFolderId('item'))
  }

  const items = sourceItems.map((item) => {
    const previousId = item.id
    const nextId = previousId ? (idMap.get(previousId) ?? makeProjectFolderId('item')) : makeProjectFolderId('item')
    const nextParentId = item.parentId ? idMap.get(item.parentId) : undefined

    return {
      ...item,
      id: nextId,
      type: item.type ?? 'note',
      title: item.title ?? 'Untitled',
      body: item.body ?? '',
      parentId: nextParentId,
      createdAt: now,
      updatedAt: now,
    }
  })

  const sharedFrom =
    payload.shared_from ??
    (sender
      ? {
          id: sender.id,
          name: sender.name,
          avatar_url: sender.avatar_url,
          role: 'creator' as const,
        }
      : null)
  const memberMap = new Map<string, ProjectFolderMemberPayload>()
  for (const member of payload.members ?? []) memberMap.set(member.id, member)
  if (sharedFrom) memberMap.set(sharedFrom.id, sharedFrom)

  const folder = {
    id: makeProjectFolderId('folder'),
    name: payload.name ? `${payload.name} copy` : 'Shared project folder',
    description: payload.description ?? '',
    color: payload.color ?? 'bg-fuchsia-600',
    logo: payload.logo ?? { type: 'icon', value: 'folder' },
    createdAt: now,
    members: [...memberMap.values()],
    sharedFrom,
    items,
  }

  const existing = window.localStorage.getItem(PROJECT_FOLDERS_STORAGE_KEY)
  let folders: unknown = []
  try {
    folders = existing ? JSON.parse(existing) : []
  } catch {
    folders = []
  }
  const nextFolders = Array.isArray(folders) ? [folder, ...folders] : [folder]
  window.localStorage.setItem(PROJECT_FOLDERS_STORAGE_KEY, JSON.stringify(nextFolders))

  return folder
}

export default function ChatPage() {
  const profile = useUser()
  const profileId = profile?.id ?? null

  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [directPeople, setDirectPeople] = useState<Profile[]>([])
  const [directPeopleLoading, setDirectPeopleLoading] = useState(true)
  const [directStates, setDirectStates] = useState<Record<string, 'synced' | 'pending' | 'request_received'>>({})
  const [mutedIds, setMutedIds] = useState<string[]>([])
  const [active, setActive] = useState<ActiveTarget | null>(null)

  const [projectMessages, setProjectMessages] = useState<Message[]>([])
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)

  const [input, setInput] = useState('')
  const [pendingImage, setPendingImage] = useState<ImagePayload | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const optimisticIdRef = useRef(0)
  const toastIdRef = useRef(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [lightboxImage, setLightboxImage] = useState<ImagePayload | null>(null)
  const [newChannelOpen, setNewChannelOpen] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')

  useEffect(() => {
    if (!profileId) return

    const syncMutedIds = () => {
      setMutedIds(readMutedUserIds(profileId))
    }

    queueMicrotask(syncMutedIds)
    window.addEventListener(CHAT_META_EVENT, syncMutedIds)
    return () => {
      window.removeEventListener(CHAT_META_EVENT, syncMutedIds)
    }
  }, [profileId])

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    toastIdRef.current += 1
    const id = toastIdRef.current
    setToasts((prev) => [...prev, { id, tone, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2400)
  }, [])

  function nextOptimisticId(prefix: string) {
    optimisticIdRef.current += 1
    return `${prefix}-${optimisticIdRef.current}`
  }

  const fetchProjectMessages = useCallback((projectId: string) => {
    if (isLocalProjectId(projectId)) {
      queueMicrotask(() => {
        setProjectMessages(readLocalProjectMessages(projectId))
      })
      return
    }
    if (!SUPABASE_CONFIGURED) {
      queueMicrotask(() => {
        setProjectMessages(mockMessages.filter((m) => m.project_id === projectId))
      })
      return
    }
    setMessagesLoading(true)
    fetch(`/api/messages?project_id=${projectId}`)
      .then((r) => r.json())
      .then((data) => setProjectMessages(Array.isArray(data) ? data : []))
      .catch(() => setProjectMessages([]))
      .finally(() => setMessagesLoading(false))
  }, [])

  const fetchDirectMessages = useCallback((userId: string) => {
    setMessagesLoading(true)
    fetch(`/api/direct-messages?with=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => setDirectMessages(Array.isArray(data) ? data : []))
      .catch(() => setDirectMessages([]))
      .finally(() => setMessagesLoading(false))
  }, [])

  const markConversationRead = useCallback(
    (userId: string) => {
      if (!profileId) return
      const next = {
        ...readChatReadMap(profileId),
        [userId]: new Date().toISOString(),
      }
      writeChatReadMap(profileId, next)
    },
    [profileId]
  )

  const toggleMute = useCallback(
    (userId: string) => {
      if (!profileId) return
      const next = mutedIds.includes(userId)
        ? mutedIds.filter((id) => id !== userId)
        : [...mutedIds, userId]
      writeMutedUserIds(profileId, next)
      setMutedIds(next)
      showToast(next.includes(userId) ? 'Conversation muted' : 'Conversation unmuted')
    },
    [mutedIds, profileId, showToast]
  )

  // Initial load: projects + synced people
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        if (!SUPABASE_CONFIGURED) {
          if (cancelled) return
          const projectList = readChatChannels().map(channelToProject)
          const target = window.localStorage.getItem(PROJECT_CHAT_TARGET_KEY)
          if (target) window.localStorage.removeItem(PROJECT_CHAT_TARGET_KEY)
          const firstProject =
            projectList.find((project) => project.id === target) ?? projectList[0] ?? null
          setProjects(projectList)
          setDirectPeople([])
          if (firstProject) {
            setActive({ kind: 'project', project: firstProject })
            if (isLocalProjectId(firstProject.id)) {
              setProjectMessages(readLocalProjectMessages(firstProject.id))
            } else {
              setProjectMessages(mockMessages.filter((m) => m.project_id === firstProject.id))
            }
          }
          setProjectsLoading(false)
          setDirectPeopleLoading(false)
          return
        }

        const [peopleRes, connRes] = await Promise.all([
          fetch('/api/people'),
          fetch('/api/connections'),
        ])

        const peopleList = peopleRes.ok ? ((await peopleRes.json()) as Profile[]) : []
        const connData = connRes.ok
          ? ((await connRes.json()) as {
              userId: string
              connections: Record<string, string>
              sync?: Record<string, 'pending' | 'request_received' | 'synced'>
            })
          : { userId: null, connections: {} as Record<string, string>, sync: {} }

        if (cancelled) return

        const target = window.localStorage.getItem(PROJECT_CHAT_TARGET_KEY)
        if (target) window.localStorage.removeItem(PROJECT_CHAT_TARGET_KEY)
        const list = readChatChannels().map(channelToProject)
        setProjects(list)

        const syncMap = connData.sync ?? {}
        const directIds = new Set(
          Object.entries(syncMap)
            .filter(([, state]) => state === 'synced' || state === 'pending' || state === 'request_received')
            .map(([id]) => id)
        )
        const directList = peopleList.filter((p) => directIds.has(p.id))
        setDirectPeople(directList)
        setDirectStates(
          Object.fromEntries(
            Object.entries(syncMap).filter(([, state]) => state === 'synced' || state === 'pending' || state === 'request_received')
          ) as Record<string, 'synced' | 'pending' | 'request_received'>
        )

        const targetProject = list.find((project) => project.id === target) ?? list[0]
        if (targetProject) {
          setActive({ kind: 'project', project: targetProject })
          fetchProjectMessages(targetProject.id)
        } else if (directList[0]) {
          setActive({ kind: 'dm', user: directList[0] })
          fetchDirectMessages(directList[0].id)
        }
      } finally {
        if (!cancelled) {
          setProjectsLoading(false)
          setDirectPeopleLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [fetchProjectMessages, fetchDirectMessages])

  // Realtime subscription for the active conversation
  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !active || !profile) return
    let cleanup: (() => void) | undefined

    async function subscribe() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      if (active && active.kind === 'project') {
        const projectId = active.project.id
        if (isLocalProjectId(projectId)) return
        const channel = supabase
          .channel(`messages:${projectId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `project_id=eq.${projectId}`,
            },
            () => fetchProjectMessages(projectId)
          )
          .subscribe()
        cleanup = () => {
          supabase.removeChannel(channel)
        }
      } else if (active && active.kind === 'dm') {
        const otherId = active.user.id
        const channel = supabase
          .channel(`dm:${profile?.id}:${otherId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'direct_messages' },
            (payload) => {
              const row = (payload.new ?? payload.old) as DirectMessage | undefined
              if (!row) return
              const matches =
                (row.sender_id === profile?.id && row.receiver_id === otherId) ||
                (row.sender_id === otherId && row.receiver_id === profile?.id)
              if (matches) fetchDirectMessages(otherId)
            }
          )
          .subscribe()
        cleanup = () => {
          supabase.removeChannel(channel)
        }
      }
    }

    subscribe()
    return () => {
      cleanup?.()
    }
  }, [active, profile, fetchProjectMessages, fetchDirectMessages])

  // Scroll to bottom on message change
  const messageCount = active?.kind === 'dm' ? directMessages.length : projectMessages.length
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messageCount])

  useEffect(() => {
    if (!active || active.kind !== 'dm') return
    const state = directStates[active.user.id]
    if (state === 'request_received') return
    markConversationRead(active.user.id)
    window.dispatchEvent(new CustomEvent(CHAT_META_EVENT))
  }, [active, directMessages, directStates, markConversationRead])

  function selectProject(project: Project) {
    setActive({ kind: 'project', project })
    setPendingImage(null)
    setProjectMessages([])
    fetchProjectMessages(project.id)
  }

  function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault()
    const name = newChannelName.trim()
    if (!name) return
    const project = channelToProject(createChatChannel(name))
    setProjects((prev) => [project, ...prev])
    setNewChannelName('')
    setNewChannelOpen(false)
    selectProject(project)
  }

  function selectUser(user: Profile) {
    setActive({ kind: 'dm', user })
    setPendingImage(null)
    setDirectMessages([])
    fetchDirectMessages(user.id)
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if ((!input.trim() && !pendingImage) || !active || !profile) return
    if (pendingImage) {
      const image = pendingImage
      setPendingImage(null)
      await sendImageMessage(image)
      return
    }
    const text = input.trim()
    setInput('')

    if (active.kind === 'project') {
      const optimistic: Message = {
        id: nextOptimisticId('opt'),
        project_id: active.project.id,
        sender_id: profile.id,
        body: text,
        created_at: new Date().toISOString(),
        sender: profile,
      }
      if (isLocalProjectId(active.project.id)) {
        const next = [...projectMessages, optimistic]
        setProjectMessages(next)
        writeLocalProjectMessages(active.project.id, next)
        return
      }
      setProjectMessages((prev) => [...prev, optimistic])

      try {
        if (SUPABASE_CONFIGURED) {
          const res = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: active.project.id, body: text }),
          })
          if (res.ok) {
            const saved = await res.json()
            setProjectMessages((prev) =>
              prev.map((m) => (m.id === optimistic.id ? { ...saved, sender: profile } : m))
            )
          }
        }
      } catch {
        // optimistic stays
      }
    } else {
      const optimistic: DirectMessage = {
        id: nextOptimisticId('opt'),
        sender_id: profile.id,
        receiver_id: active.user.id,
        type: 'text',
        body: text,
        payload: null,
        state: 'sent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender: { id: profile.id, name: profile.name, avatar_url: profile.avatar_url },
      }
      setDirectMessages((prev) => [...prev, optimistic])

      try {
        const res = await fetch('/api/direct-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receiver_id: active.user.id,
            type: 'text',
            body: text,
          }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? 'Failed to send')
        }
        const saved = (await res.json()) as DirectMessage
        setDirectMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)))
      } catch (e) {
        setDirectMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        setInput(text)
        showToast(e instanceof Error ? e.message : 'Failed to send', 'error')
      }
    }
  }

  async function sendImageMessage(payload: ImagePayload) {
    if (!active || !profile) return

    if (active.kind === 'project') {
      const optimistic: Message = {
        id: nextOptimisticId('opt-img'),
        project_id: active.project.id,
        sender_id: profile.id,
        body: encodeProjectImageMessage(payload),
        created_at: new Date().toISOString(),
        sender: profile,
      }
      if (isLocalProjectId(active.project.id)) {
        const next = [...projectMessages, optimistic]
        setProjectMessages(next)
        writeLocalProjectMessages(active.project.id, next)
        return
      }
      setProjectMessages((prev) => [...prev, optimistic])

      try {
        if (SUPABASE_CONFIGURED) {
          const res = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: active.project.id, body: optimistic.body }),
          })
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string }
            throw new Error(body.error ?? 'Failed to send image')
          }
          const saved = await res.json()
          setProjectMessages((prev) =>
            prev.map((m) => (m.id === optimistic.id ? { ...saved, sender: profile } : m))
          )
        }
      } catch (e) {
        setProjectMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        showToast(e instanceof Error ? e.message : 'Failed to send image', 'error')
      }
      return
    }

    if (directStates[active.user.id] !== 'synced') return

    const optimistic: DirectMessage = {
      id: nextOptimisticId('opt-img'),
      sender_id: profile.id,
      receiver_id: active.user.id,
      type: 'text',
      body: encodeProjectImageMessage(payload),
      payload: null,
      state: 'sent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sender: { id: profile.id, name: profile.name, avatar_url: profile.avatar_url },
    }
    setDirectMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch('/api/direct-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: active.user.id,
          type: 'text',
          body: encodeProjectImageMessage(payload),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Failed to send image')
      }
      const saved = (await res.json()) as DirectMessage
      setDirectMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)))
    } catch (e) {
      setDirectMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      showToast(e instanceof Error ? e.message : 'Failed to send image', 'error')
    }
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/'))
    if (!file) return
    event.preventDefault()

    if (!active || !profile) {
      showToast('Select a chat before pasting an image', 'error')
      return
    }
    if (active.kind === 'dm' && directStates[active.user.id] !== 'synced') {
      showToast('Accept sync before sending images', 'error')
      return
    }
    if (file.size > MAX_PASTED_IMAGE_BYTES) {
      showToast('Image is too large. Max 5 MB.', 'error')
      return
    }

    try {
      const payload = await imageFileToPayload(file)
      setPendingImage(payload)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not paste image', 'error')
    }
  }

  const respondToShare = useCallback(
    async (msg: DirectMessage, action: 'accept' | 'reject') => {
      setRespondingId(msg.id)
      // Optimistic update
      setDirectMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, state: action === 'accept' ? 'accepted' : 'rejected' } : m))
      )
      try {
        const res = await fetch(`/api/direct-messages/${msg.id}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? 'Failed to respond')
        }
        if (action === 'accept' && isProjectFolderShareMessage(msg)) {
          const imported = importSharedProjectFolder((msg.payload ?? {}) as ProjectFolderSharePayload, msg.sender)
          showToast(`${imported.name} added to Projects`)
        } else {
          const payload = msg.payload as RepoSharePayload | ProjectFolderSharePayload | null
          showToast(
            action === 'accept'
              ? `${payload?.name ?? (payload as RepoSharePayload | null)?.full_name ?? 'Repository'} added to your workspace`
              : 'Share rejected'
          )
        }
      } catch (e) {
        setDirectMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, state: 'sent' } : m))
        )
        showToast(e instanceof Error ? e.message : 'Failed to respond', 'error')
      } finally {
        setRespondingId(null)
      }
    },
    [showToast]
  )

  const respondToSync = useCallback(
    async (user: Profile, action: 'accept' | 'reject') => {
      setRespondingId(`sync:${user.id}`)

      const previousState = directStates[user.id]
      if (action === 'accept') {
        setDirectStates((prev) => ({ ...prev, [user.id]: 'synced' }))
      } else {
        setDirectStates((prev) => {
          const next = { ...prev }
          delete next[user.id]
          return next
        })
        setDirectPeople((prev) => prev.filter((person) => person.id !== user.id))
      }

      try {
        const res = await fetch(`/api/people/${user.id}/sync/${action}`, {
          method: 'POST',
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `Failed to ${action} sync request`)
        }

        if (action === 'accept') {
          showToast('Sync accepted')
          fetchDirectMessages(user.id)
        } else {
          showToast('Sync rejected')
          setDirectMessages([])
          setActive(null)
        }
      } catch (e) {
        if (previousState) {
          setDirectStates((prev) => ({ ...prev, [user.id]: previousState }))
        }
        if (action === 'reject') {
          setDirectPeople((prev) => {
            if (prev.some((person) => person.id === user.id)) return prev
            return [...prev, user]
          })
        }
        showToast(e instanceof Error ? e.message : `Failed to ${action} sync request`, 'error')
      } finally {
        setRespondingId(null)
      }
    },
    [directStates, fetchDirectMessages, showToast]
  )

  const headerTitle = useMemo(() => {
    if (!active) return ''
    return active.kind === 'project' ? `#${active.project.name}` : active.user.name
  }, [active])

  return (
    <div className="flex h-full overflow-hidden">
      <div
        className={cn(
          'w-full sm:w-60 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-col',
          active ? 'hidden sm:flex' : 'flex'
        )}
      >
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Channels
          </p>
          <button
            type="button"
            onClick={() => setNewChannelOpen(true)}
            aria-label="New channel"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {projectsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                <Skeleton className="w-3 h-3 rounded" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))
          ) : projects.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No channels yet — create one with +.</p>
          ) : (
            projects.map((project) => {
              const isActive = active?.kind === 'project' && active.project.id === project.id
              return (
                <button
                  key={project.id}
                  onClick={() => selectProject(project)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                    isActive
                      ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                  )}
                >
                  <Hash size={14} className="flex-shrink-0" />
                  <span className="truncate flex-1">{project.name}</span>
                </button>
              )
            })
          )}

          <div className="my-3 border-t border-gray-100 dark:border-gray-800" />

          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Direct
          </p>
          {directPeopleLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))
          ) : directPeople.length === 0 ? (
            <Link
              href="/people"
              className="mx-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <Inbox size={12} />
              Sync with people to start a chat
            </Link>
          ) : (
            directPeople.map((user) => {
              const isActive = active?.kind === 'dm' && active.user.id === user.id
              const state = directStates[user.id] ?? 'synced'
              const isMuted = mutedIds.includes(user.id)
              return (
                <button
                  key={user.id}
                  onClick={() => selectUser(user)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                    isActive
                      ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                  )}
                >
                  <Avatar name={user.name} src={user.avatar_url} size="xs" />
                  <span className="truncate flex-1">{user.name}</span>
                  {isMuted && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      Muted
                    </span>
                  )}
                  {state !== 'synced' && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {state === 'request_received' ? 'Request' : 'Pending'}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      <div className={cn('flex-1 flex-col overflow-hidden', active ? 'flex' : 'hidden sm:flex')}>
        {active && (
          <div className="h-14 border-b border-gray-100 dark:border-gray-800 px-5 flex items-center gap-2 flex-shrink-0 bg-white dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label="Back to conversations"
              className="sm:hidden -ml-2 mr-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <ChevronLeft size={18} />
            </button>
            {active.kind === 'project' ? (
              <Hash size={16} className="text-gray-400 dark:text-gray-500" />
            ) : (
              <Avatar name={active.user.name} src={active.user.avatar_url} size="xs" />
            )}
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {headerTitle}
            </span>
            {active.kind === 'project' && active.project.description && (
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                — {active.project.description.slice(0, 60)}
              </span>
            )}
            {active.kind === 'dm' && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                · {directStates[active.user.id] === 'request_received' ? 'incoming request' : directStates[active.user.id] === 'pending' ? 'pending sync' : 'synced'}
              </span>
            )}
            {active.kind === 'dm' && (
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={() => toggleMute(active.user.id)}
              >
                {mutedIds.includes(active.user.id) ? <Bell size={12} /> : <BellOff size={12} />}
                {mutedIds.includes(active.user.id) ? 'Unmute' : 'Mute'}
              </button>
            )}
            {active.kind === 'dm' && directStates[active.user.id] === 'request_received' && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={respondingId === `sync:${active.user.id}`}
                  onClick={() => respondToSync(active.user, 'reject')}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  disabled={respondingId === `sync:${active.user.id}`}
                  onClick={() => respondToSync(active.user, 'accept')}
                >
                  Accept
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {messagesLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))
          ) : !active ? (
            <div className="flex flex-col items-center justify-center flex-1 py-16 gap-2">
              <Hash size={32} className="text-gray-200 dark:text-gray-700" />
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Pick a channel or synced contact to start chatting.
              </p>
            </div>
          ) : active.kind === 'project' ? (
            projectMessages.length === 0 ? (
              <EmptyChannel name={active.project.name} />
            ) : (
              projectMessages.map((msg, i) => {
                const prev = projectMessages[i - 1]
                const image = parseProjectImageMessage(msg.body)
                const isMine = msg.sender_id === profile?.id
                const sameAuthor =
                  prev?.sender_id === msg.sender_id &&
                  new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 300000
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex items-end gap-3',
                      isMine ? 'justify-end' : 'justify-start',
                      sameAuthor && 'mt-0.5'
                    )}
                  >
                    {!isMine && sameAuthor ? (
                      <div className="w-8 flex-shrink-0" />
                    ) : !isMine ? (
                      <Avatar name={msg.sender?.name ?? 'User'} src={msg.sender?.avatar_url} size="sm" />
                    ) : null}
                    <div className={cn('flex max-w-[72%] flex-col', isMine ? 'items-end' : 'items-start')}>
                      {!sameAuthor && (
                        <div className={cn('mb-1 flex items-baseline gap-2', isMine && 'flex-row-reverse')}>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {isMine ? 'You' : msg.sender?.name ?? 'User'}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                      )}
                      {image ? (
                        <ImageMessage payload={image} onOpen={setLightboxImage} />
                      ) : (
                        <p
                          className={cn(
                            'rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm',
                            isMine
                              ? 'rounded-br-md bg-fuchsia-600 text-white'
                              : 'rounded-bl-md border border-gray-200 bg-white text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          )}
                        >
                          {msg.body}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })
            )
          ) : directMessages.length === 0 ? (
            <EmptyDM
              name={active.user.name}
              state={directStates[active.user.id] ?? 'synced'}
              busy={respondingId === `sync:${active.user.id}`}
              onAccept={
                directStates[active.user.id] === 'request_received'
                  ? () => respondToSync(active.user, 'accept')
                  : undefined
              }
              onReject={
                directStates[active.user.id] === 'request_received'
                  ? () => respondToSync(active.user, 'reject')
                  : undefined
              }
            />
          ) : (
            directMessages.map((msg, i) => {
              const prev = directMessages[i - 1]
              const sameAuthor =
                prev?.sender_id === msg.sender_id &&
                new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 300000
              const senderName =
                msg.sender?.name ?? (msg.sender_id === profile?.id ? profile.name : active.user.name)
              const senderAvatar =
                msg.sender?.avatar_url ??
                (msg.sender_id === profile?.id ? profile?.avatar_url : active.user.avatar_url)
              const isReceiver = profile?.id === msg.receiver_id
              const isMine = msg.sender_id === profile?.id
              const isResponding = respondingId === msg.id
              const image = parseProjectImageMessage(msg.body)

              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex items-end gap-3',
                    isMine ? 'justify-end' : 'justify-start',
                    sameAuthor && 'mt-0.5'
                  )}
                >
                  {!isMine && sameAuthor ? (
                    <div className="w-8 flex-shrink-0" />
                  ) : !isMine ? (
                    <Avatar name={senderName} src={senderAvatar} size="sm" />
                  ) : null}
                  <div className={cn('flex max-w-[72%] flex-col', isMine ? 'items-end' : 'items-start')}>
                    {!sameAuthor && (
                      <div className={cn('mb-1 flex items-baseline gap-2', isMine && 'flex-row-reverse')}>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {isMine ? 'You' : senderName}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                    )}

                    {msg.type === 'text' ? (
                      image ? (
                        <ImageMessage payload={image} onOpen={setLightboxImage} />
                      ) : (
                        <p
                          className={cn(
                            'rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm',
                            isMine
                              ? 'rounded-br-md bg-fuchsia-600 text-white'
                              : 'rounded-bl-md border border-gray-200 bg-white text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          )}
                        >
                          {msg.body}
                        </p>
                      )
                    ) : isProjectFolderShareMessage(msg) ? (
                      <ProjectFolderShareCard
                        message={msg}
                        viewerIsReceiver={isReceiver}
                        responding={isResponding}
                        onAccept={() => respondToShare(msg, 'accept')}
                        onReject={() => respondToShare(msg, 'reject')}
                      />
                    ) : (
                      <RepoShareCard
                        message={msg}
                        viewerIsReceiver={isReceiver}
                        responding={isResponding}
                        onAccept={() => respondToShare(msg, 'accept')}
                        onReject={() => respondToShare(msg, 'reject')}
                      />
                    )}
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={sendMessage}
          className="border-t border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          {pendingImage && (
            <div className="mb-3 ml-11 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-950/60">
              <button
                type="button"
                onClick={() => setLightboxImage(pendingImage)}
                className="h-16 w-24 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                title="Preview image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingImage.data_url} alt={pendingImage.name ?? 'Pasted image'} className="h-full w-full object-cover" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                  {pendingImage.name ?? 'Pasted image'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Trykk Send for å sende bildet.</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Fjern bilde"
              >
                <XIcon size={16} />
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <Avatar name={profile?.name ?? 'You'} src={profile?.avatar_url} size="sm" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder={
                !active
                  ? 'Select a conversation'
                  : pendingImage
                    ? 'Image ready to send...'
                    : active.kind === 'project'
                      ? `Message #${active.project.name}...`
                      : directStates[active.user.id] === 'synced'
                        ? `Message ${active.user.name}...`
                        : `Accept sync with ${active.user.name} to start chatting...`
              }
              disabled={!active || Boolean(pendingImage) || (active.kind === 'dm' && directStates[active.user.id] !== 'synced')}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-70 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900"
            />
            <Button
              type="submit"
              size="md"
              disabled={(!input.trim() && !pendingImage) || !active || (active.kind === 'dm' && directStates[active.user.id] !== 'synced')}
            >
              <Send size={15} />
            </Button>
          </div>
        </form>
      </div>

      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm transition-all',
              t.tone === 'success'
                ? 'bg-gray-900/95 text-white border-gray-800 dark:bg-gray-100/95 dark:text-gray-900 dark:border-gray-200'
                : 'bg-red-600/95 text-white border-red-700'
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />

      <Modal
        open={newChannelOpen}
        onClose={() => {
          setNewChannelOpen(false)
          setNewChannelName('')
        }}
        title="New channel"
        className="max-w-sm"
      >
        <form onSubmit={handleCreateChannel} className="space-y-4">
          <Input
            id="new-channel-name"
            label="Channel name"
            autoFocus
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            placeholder="e.g. Marketing"
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setNewChannelOpen(false)
                setNewChannelName('')
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!newChannelName.trim()}>
              <Plus size={16} />
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function EmptyChannel({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-16 gap-2">
      <Hash size={32} className="text-gray-200 dark:text-gray-700" />
      <p className="text-sm text-gray-400 dark:text-gray-500">No messages yet in #{name}</p>
      <p className="text-xs text-gray-300 dark:text-gray-600">Be the first to send one.</p>
    </div>
  )
}

function EmptyDM({
  name,
  state,
  busy,
  onAccept,
  onReject,
}: {
  name: string
  state: 'synced' | 'pending' | 'request_received'
  busy: boolean
  onAccept?: () => void
  onReject?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-16 gap-2">
      <Avatar name={name} size="lg" />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{name}</p>
      {state === 'request_received' ? (
        <>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-xs">
            This sync request is waiting for your answer.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={onReject}>
              Reject
            </Button>
            <Button size="sm" disabled={busy} onClick={onAccept}>
              Accept
            </Button>
          </div>
        </>
      ) : state === 'pending' ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-xs">
          Sync request sent. Chat opens when they accept it.
        </p>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-xs">
          Say hi or share a repository — they&apos;ll see it here.
        </p>
      )}
    </div>
  )
}

function ImageMessage({
  payload,
  onOpen,
}: {
  payload: ImagePayload
  onOpen: (payload: ImagePayload) => void
}) {
  if (!payload.data_url?.startsWith('data:image/')) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Image could not be displayed.
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(payload)}
      className="mt-1 inline-block max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 text-left shadow-sm transition hover:border-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-purple-800"
      title={payload.name ?? 'Open image'}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={payload.data_url}
        alt={payload.name ?? 'Pasted image'}
        className="max-h-80 w-full object-contain"
      />
    </button>
  )
}

function ImageLightbox({
  image,
  onClose,
}: {
  image: ImagePayload | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!image) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [image, onClose])

  if (!image) return null

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-zoom-out"
        aria-label="Lukk bilde"
        onClick={onClose}
      />
      <div className="relative max-h-[92vh] max-w-[92vw]">
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-gray-950/90 text-white shadow-lg transition hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          aria-label="Lukk bilde"
        >
          <XIcon size={18} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.data_url}
          alt={image.name ?? 'Pasted image'}
          className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
        />
      </div>
    </div>
  )
}

function RepoShareCard({
  message,
  viewerIsReceiver,
  responding,
  onAccept,
  onReject,
}: {
  message: DirectMessage
  viewerIsReceiver: boolean
  responding: boolean
  onAccept: () => void
  onReject: () => void
}) {
  const payload = (message.payload ?? {}) as RepoSharePayload
  const isSyncRequest = message.type === 'text' && payload.kind === 'sync_request'
  const fullName = payload.full_name ?? payload.name ?? 'Repository'
  const owner = payload.owner ?? fullName.split('/')[0] ?? ''
  const detailHref = `/repositories/${fullName}`

  const stateLabel =
    message.state === 'accepted'
      ? 'Accepted'
      : message.state === 'rejected'
        ? 'Rejected'
        : null

  if (isSyncRequest) {
    return (
      <div
        className={cn(
          'mt-1 inline-flex max-w-md flex-col gap-3 rounded-2xl border bg-white p-4 transition-all',
          'border-purple-200 dark:border-purple-800 dark:bg-gray-900',
          message.state === 'rejected' && 'opacity-60'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-500 ring-1 ring-inset ring-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-900/60">
            <Inbox size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sync request</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              You need to accept this request before the chat opens for normal messages.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {viewerIsReceiver && message.state === 'sent' ? (
            <div className="flex gap-1.5">
              <button
                disabled={responding}
                onClick={onReject}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <XIcon size={11} />
                Reject
              </button>
              <button
                disabled={responding}
                onClick={onAccept}
                className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition-all hover:bg-fuchsia-700 disabled:opacity-60"
              >
                <Check size={11} />
                Accept
              </button>
            </div>
          ) : stateLabel ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                message.state === 'accepted'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              )}
            >
              {stateLabel}
            </span>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'mt-1 inline-flex max-w-md flex-col gap-3 rounded-2xl border bg-white p-4 transition-all',
        'border-gray-200 dark:border-gray-800 dark:bg-gray-900',
        message.state === 'rejected' && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-500 ring-1 ring-inset ring-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-900/60">
          <Book size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">{owner}</p>
          <Link
            href={detailHref}
            className="block truncate text-sm font-semibold text-gray-900 hover:text-purple-600 dark:text-gray-100 dark:hover:text-purple-400"
          >
            {payload.name ?? fullName.split('/')[1] ?? fullName}
          </Link>
          {payload.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {payload.description}
            </p>
          )}
          {payload.language && (
            <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">{payload.language}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {payload.url && (
          <a
            href={payload.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400"
          >
            <ExternalLink size={11} />
            Open on GitHub
          </a>
        )}

        {viewerIsReceiver && message.state === 'sent' ? (
          <div className="flex gap-1.5">
            <button
              disabled={responding}
              onClick={onReject}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <XIcon size={11} />
              Reject
            </button>
            <button
              disabled={responding}
              onClick={onAccept}
              className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition-all hover:bg-fuchsia-700 disabled:opacity-60"
            >
              <Check size={11} />
              Accept
            </button>
          </div>
        ) : stateLabel ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium',
              message.state === 'accepted'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            )}
          >
            {stateLabel}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function ProjectFolderShareCard({
  message,
  viewerIsReceiver,
  responding,
  onAccept,
  onReject,
}: {
  message: DirectMessage
  viewerIsReceiver: boolean
  responding: boolean
  onAccept: () => void
  onReject: () => void
}) {
  const payload = (message.payload ?? {}) as ProjectFolderSharePayload
  const stateLabel =
    message.state === 'accepted'
      ? 'Accepted'
      : message.state === 'rejected'
        ? 'Rejected'
        : null
  const itemCount = payload.item_count ?? payload.items?.length ?? 0

  return (
    <div
      className={cn(
        'mt-1 inline-flex max-w-md flex-col gap-3 rounded-2xl border bg-white p-4 transition-all',
        'border-gray-200 dark:border-gray-800 dark:bg-gray-900',
        message.state === 'rejected' && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-500 ring-1 ring-inset ring-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-900/60">
          <FolderOpen size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">Project folder</p>
          <Link
            href="/projects"
            className="block truncate text-sm font-semibold text-gray-900 hover:text-purple-600 dark:text-gray-100 dark:hover:text-purple-400"
          >
            {payload.name ?? 'Shared project folder'}
          </Link>
          {payload.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {payload.description}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
            {itemCount} resources
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400"
        >
          <ExternalLink size={11} />
          Open Projects
        </Link>

        {viewerIsReceiver && message.state === 'sent' ? (
          <div className="flex gap-1.5">
            <button
              disabled={responding}
              onClick={onReject}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <XIcon size={11} />
              Reject
            </button>
            <button
              disabled={responding}
              onClick={onAccept}
              className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition-all hover:bg-fuchsia-700 disabled:opacity-60"
            >
              <Check size={11} />
              Accept
            </button>
          </div>
        ) : stateLabel ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium',
              message.state === 'accepted'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            )}
          >
            {stateLabel}
          </span>
        ) : null}
      </div>
    </div>
  )
}
