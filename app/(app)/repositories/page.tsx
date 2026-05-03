'use client'

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import TopBar from '@/components/layout/TopBar'
import Button from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import CreateGitHubRepoModal from '@/components/dashboard/CreateGitHubRepoModal'
import { useGitHub } from '@/context/GitHubContext'
import { cn, formatDate } from '@/lib/utils'
import type { GitHubUserRepo } from '@/types'
import {
  GitBranch,
  Lock,
  Globe,
  ExternalLink,
  AlertCircle,
  GitFork,
  Archive,
  Search,
  Star,
  Folder,
  Zap,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  MoreHorizontal,
  Check,
  Plus,
  FolderPlus,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'updated' | 'name'
// Keys are String(repo.id) — JSON always serialises numeric keys as strings
type FolderMap = Record<string, string>

interface FolderDef {
  id: string
  label: string
  icon: ReactNode
  isCustom?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000

const DEFAULT_FOLDERS: FolderDef[] = [
  { id: 'active', label: 'Active', icon: <Zap size={13} /> },
  { id: 'side-projects', label: 'Side projects', icon: <Folder size={13} /> },
  { id: 'archived', label: 'Archived', icon: <Archive size={13} /> },
]

const LS_FOLDER_MAP = 'sync_repo_folder_map'
const LS_CUSTOM_FOLDERS = 'sync_custom_folders'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function getAutoGroup(repo: GitHubUserRepo): string {
  if (repo.archived) return 'archived'
  if (Date.now() - new Date(repo.updated_at).getTime() <= ACTIVE_THRESHOLD_MS) return 'active'
  return 'side-projects'
}

function getEffectiveGroup(repo: GitHubUserRepo, folderMap: FolderMap): string {
  return folderMap[String(repo.id)] ?? getAutoGroup(repo)
}

function genId(): string {
  return Math.random().toString(36).slice(2, 9)
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RepoSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-2/3 mb-4" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

// ─── Sidebar item (drag-drop target) ─────────────────────────────────────────

function SidebarItem({
  icon,
  label,
  count,
  active,
  dragOver,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  icon: ReactNode
  label: string
  count: number
  active: boolean
  dragOver: boolean
  onClick: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-all duration-100',
        active
          ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-300',
        dragOver &&
          'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-800'
      )}
    >
      {/* pointer-events-none prevents dragleave firing on child elements */}
      <span className="flex items-center gap-2 pointer-events-none">
        {icon}
        {label}
      </span>
      <span className="text-xs tabular-nums pointer-events-none">{count}</span>
    </button>
  )
}

// ─── Move-to dropdown ─────────────────────────────────────────────────────────

function MoveMenu({
  folders,
  currentFolderId,
  onMove,
  onNewFolder,
}: {
  folders: FolderDef[]
  currentFolderId: string
  onMove: (folderId: string) => void
  onNewFolder: () => void
}) {
  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 min-w-[172px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg shadow-black/5 dark:shadow-black/30 py-1"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 pt-1.5 pb-1">
        Move to folder
      </p>
      {folders.map((f) => (
        <button
          key={f.id}
          onClick={() => onMove(f.id)}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-300"
        >
          <span className="flex items-center gap-2">
            <span className="text-gray-400 dark:text-gray-500">{f.icon}</span>
            {f.label}
          </span>
          {currentFolderId === f.id && (
            <Check size={12} className="text-indigo-500 flex-shrink-0 ml-2" />
          )}
        </button>
      ))}
      <div className="my-1 mx-2 h-px bg-gray-100 dark:bg-gray-800" />
      <button
        onClick={onNewFolder}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm text-gray-500 dark:text-gray-400"
      >
        <FolderPlus size={13} />
        New folder
      </button>
    </div>
  )
}

// ─── Repo card ────────────────────────────────────────────────────────────────

function RepoCard({
  repo,
  starred,
  folders,
  currentFolderId,
  menuOpen,
  isDragging,
  onToggleStar,
  onOpenMenu,
  onMove,
  onNewFolder,
  onDragStart,
  onDragEnd,
}: {
  repo: GitHubUserRepo
  starred: boolean
  folders: FolderDef[]
  currentFolderId: string
  menuOpen: boolean
  isDragging: boolean
  onToggleStar: () => void
  onOpenMenu: () => void
  onMove: (folderId: string) => void
  onNewFolder: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-3',
        'cursor-grab active:cursor-grabbing select-none',
        'hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-150',
        isDragging && 'opacity-40 scale-[0.97]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {repo.private ? (
            <Lock size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
          ) : (
            <Globe size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
          )}
          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate"
          >
            {repo.name}
          </a>
          {repo.fork && (
            <GitFork size={12} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
          )}
          {repo.archived && (
            <Archive size={12} className="text-amber-400 dark:text-amber-500 flex-shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onToggleStar}
            className={cn(
              'p-1 rounded transition-colors',
              starred
                ? 'text-amber-400 hover:text-amber-500'
                : 'text-gray-200 dark:text-gray-700 hover:text-amber-400 dark:hover:text-amber-500'
            )}
          >
            <Star size={13} fill={starred ? 'currentColor' : 'none'} />
          </button>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenMenu()
              }}
              className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
            >
              <MoreHorizontal size={13} />
            </button>
            {menuOpen && (
              <MoveMenu
                folders={folders}
                currentFolderId={currentFolderId}
                onMove={onMove}
                onNewFolder={onNewFolder}
              />
            )}
          </div>

          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            className="p-1 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {repo.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
          {repo.description}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap mt-auto">
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            repo.private
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
          )}
        >
          {repo.private ? 'Private' : 'Public'}
        </span>
        {repo.language && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{repo.language}</span>
        )}
        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
          <GitBranch size={11} />
          {repo.default_branch}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          Updated {formatDate(repo.updated_at)}
        </span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RepositoriesPage() {
  const github = useGitHub()

  // GitHub data
  const [repos, setRepos] = useState<GitHubUserRepo[]>([])
  const [loadingDone, setLoadingDone] = useState(false)
  const [error, setError] = useState<{ message: string; code?: string } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  // Folder system (localStorage-backed)
  const [folderMap, setFolderMap] = useState<FolderMap>(() =>
    typeof window !== 'undefined' ? lsGet<FolderMap>(LS_FOLDER_MAP, {}) : {}
  )
  const [customFolders, setCustomFolders] = useState<FolderDef[]>(() => {
    if (typeof window === 'undefined') return []
    return lsGet<{ id: string; label: string }[]>(LS_CUSTOM_FOLDERS, []).map((f) => ({
      id: f.id,
      label: f.label,
      icon: <Folder size={13} />,
      isCustom: true,
    }))
  })

  // UI state
  const [activeGroup, setActiveGroup] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('updated')
  const [search, setSearch] = useState('')
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [openMenuRepoId, setOpenMenuRepoId] = useState<number | null>(null)

  // New folder input
  const [newFolderVisible, setNewFolderVisible] = useState(false)
  const [newFolderForRepoId, setNewFolderForRepoId] = useState<number | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const newFolderRef = useRef<HTMLInputElement>(null)
  const newFolderSubmittedRef = useRef(false)

  // Drag state
  const [dragRepoId, setDragRepoId] = useState<number | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  // Persist to localStorage whenever folder state changes
  useEffect(() => {
    localStorage.setItem(LS_FOLDER_MAP, JSON.stringify(folderMap))
  }, [folderMap])

  useEffect(() => {
    localStorage.setItem(
      LS_CUSTOM_FOLDERS,
      JSON.stringify(customFolders.map(({ id, label }) => ({ id, label })))
    )
  }, [customFolders])

  // Close card context menu on any outside click
  useEffect(() => {
    if (openMenuRepoId === null) return
    const close = () => setOpenMenuRepoId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openMenuRepoId])

  // Auto-focus new folder input when it appears
  useEffect(() => {
    if (newFolderVisible) {
      newFolderSubmittedRef.current = false
      requestAnimationFrame(() => newFolderRef.current?.focus())
    }
  }, [newFolderVisible])

  // ── Derived ────────────────────────────────────────────────────────────────

  const notConnected =
    !loadingDone ? false : error?.code === 'not_connected' || error?.code === 'token_expired'
  const loading = !loadingDone && !error

  const allFolders = useMemo<FolderDef[]>(
    () => [...DEFAULT_FOLDERS, ...customFolders],
    [customFolders]
  )

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const f of allFolders) counts[f.id] = 0
    for (const repo of repos) {
      const g = getEffectiveGroup(repo, folderMap)
      counts[g] = (counts[g] ?? 0) + 1
    }
    return counts
  }, [repos, folderMap, allFolders])

  const filteredRepos = useMemo(() => {
    const q = search.toLowerCase()
    let result = repos.filter((repo) => {
      if (activeGroup !== 'all' && getEffectiveGroup(repo, folderMap) !== activeGroup) return false
      if (q && !repo.name.toLowerCase().includes(q) && !repo.description?.toLowerCase().includes(q))
        return false
      return true
    })
    return [...result].sort((a, b) =>
      sortKey === 'name'
        ? a.name.localeCompare(b.name)
        : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  }, [repos, activeGroup, search, sortKey, folderMap])

  const groupedRepos = useMemo(() => {
    if (activeGroup !== 'all') return null
    const groups: Record<string, GitHubUserRepo[]> = {}
    for (const repo of filteredRepos) {
      const g = getEffectiveGroup(repo, folderMap)
      ;(groups[g] ??= []).push(repo)
    }
    return groups
  }, [activeGroup, filteredRepos, folderMap])

  // Folders that have at least one repo in current filtered view
  const sectionFolders = useMemo(
    () => (groupedRepos ? allFolders.filter((f) => (groupedRepos[f.id]?.length ?? 0) > 0) : []),
    [allFolders, groupedRepos]
  )

  const showSidebar = loadingDone && !error
  const showNewRepoButton = loadingDone && !notConnected && !error

  // ── Handlers ───────────────────────────────────────────────────────────────

  const fetchRepos = useCallback(() => {
    fetch('/api/github/user-repos')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRepos(data)
          setError(null)
          if (!github.connected) github.refresh()
        } else {
          setError({ message: data.error ?? 'Failed to load repositories', code: data.code })
        }
      })
      .catch(() => setError({ message: 'Network error. Please try again.', code: 'network_error' }))
      .finally(() => setLoadingDone(true))
  }, [github])

  useEffect(() => {
    fetchRepos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRetry = () => {
    setError(null)
    setLoadingDone(false)
    fetchRepos()
  }

  const handleRepoCreated = () => {
    setLoadingDone(false)
    setError(null)
    fetchRepos()
  }

  const toggleStar = (id: number) =>
    setStarredIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleCollapse = (group: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(group) ? next.delete(group) : next.add(group)
      return next
    })

  const moveRepo = (repoId: number, folderId: string) => {
    setFolderMap((prev) => ({ ...prev, [String(repoId)]: folderId }))
    setOpenMenuRepoId(null)
  }

  const handleDrop = (folderId: string) => {
    if (dragRepoId === null) return
    if (folderId === 'all') {
      // Drop on "All repos" → remove manual assignment (revert to auto)
      setFolderMap((prev) => {
        const next = { ...prev }
        delete next[String(dragRepoId)]
        return next
      })
    } else {
      setFolderMap((prev) => ({ ...prev, [String(dragRepoId)]: folderId }))
    }
    setDragRepoId(null)
    setDragOverFolderId(null)
  }

  const openNewFolder = (forRepoId?: number) => {
    setNewFolderForRepoId(forRepoId ?? null)
    setOpenMenuRepoId(null)
    setNewFolderVisible(true)
  }

  const cancelNewFolder = () => {
    setNewFolderVisible(false)
    setNewFolderName('')
    setNewFolderForRepoId(null)
  }

  const confirmNewFolder = (name: string) => {
    if (newFolderSubmittedRef.current) return
    newFolderSubmittedRef.current = true

    const trimmed = name.trim()
    if (!trimmed) { cancelNewFolder(); return }

    const id = genId()
    setCustomFolders((prev) => [
      ...prev,
      { id, label: trimmed, icon: <Folder size={13} />, isCustom: true },
    ])
    if (newFolderForRepoId !== null) {
      setFolderMap((prev) => ({ ...prev, [String(newFolderForRepoId)]: id }))
    }
    setNewFolderVisible(false)
    setNewFolderName('')
    setNewFolderForRepoId(null)
    setActiveGroup(id)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <TopBar
        title="Repositories"
        actions={
          showNewRepoButton ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <GitBranch size={14} />
              New repository
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left sidebar ──────────────────────────────────────────────── */}
        {showSidebar && (
          <nav className="w-48 shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-3 px-2 overflow-y-auto flex flex-col gap-px">

            <SidebarItem
              icon={<LayoutGrid size={13} />}
              label="All repos"
              count={repos.length}
              active={activeGroup === 'all'}
              dragOver={dragOverFolderId === 'all'}
              onClick={() => setActiveGroup('all')}
              onDragOver={(e) => { e.preventDefault(); setDragOverFolderId('all') }}
              onDragLeave={() => setDragOverFolderId(null)}
              onDrop={(e) => { e.preventDefault(); handleDrop('all') }}
            />

            <div className="my-1.5 h-px bg-gray-100 dark:bg-gray-800" />

            {allFolders.map((f) => (
              <SidebarItem
                key={f.id}
                icon={f.icon}
                label={f.label}
                count={groupCounts[f.id] ?? 0}
                active={activeGroup === f.id}
                dragOver={dragOverFolderId === f.id}
                onClick={() => setActiveGroup(f.id)}
                onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(f.id) }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => { e.preventDefault(); handleDrop(f.id) }}
              />
            ))}

            {/* Inline new-folder input */}
            {newFolderVisible ? (
              <div className="mt-1 px-0.5">
                <input
                  ref={newFolderRef}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); confirmNewFolder(newFolderName) }
                    if (e.key === 'Escape') cancelNewFolder()
                  }}
                  onBlur={() => confirmNewFolder(newFolderName)}
                  placeholder="Folder name…"
                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-indigo-300 dark:border-indigo-700 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-1">
                  Enter to confirm · Esc to cancel
                </p>
              </div>
            ) : (
              <button
                onClick={() => openNewFolder()}
                className="mt-1 w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <Plus size={12} />
                New folder
              </button>
            )}
          </nav>
        )}

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Search + sort */}
          {showSidebar && repos.length > 0 && (
            <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
              <div className="relative flex-1 max-w-xs">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search repositories…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="updated">Last updated</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-6">

            {/* Not connected */}
            {notConnected && (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <GitBranch size={26} className="text-gray-400 dark:text-gray-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                    {error?.code === 'token_expired' ? 'GitHub token expired' : 'Connect your GitHub account'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
                    {error?.code === 'token_expired'
                      ? 'Your GitHub token has expired or been revoked. Please reconnect.'
                      : 'Link your GitHub to view and manage your repositories directly from Sync. Your token is stored securely server-side.'}
                  </p>
                </div>
                <a href="/api/github/connect">
                  <Button>
                    <GitBranch size={14} />
                    {error?.code === 'token_expired' ? 'Reconnect GitHub' : 'Connect GitHub'}
                  </Button>
                </a>
                <p className="text-xs text-gray-300 dark:text-gray-600">
                  You can also connect in{' '}
                  <a href="/settings" className="underline hover:text-gray-400 transition-colors">
                    Settings → Connected accounts
                  </a>
                </p>
              </div>
            )}

            {/* Generic error */}
            {loadingDone && error && !notConnected && (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
                  <AlertCircle size={24} className="text-red-400 dark:text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                    Failed to load repositories
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">{error.message}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleRetry}>
                  Try again
                </Button>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => <RepoSkeleton key={i} />)}
              </div>
            )}

            {/* Empty — no repos */}
            {loadingDone && !error && repos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <GitBranch size={26} className="text-gray-400 dark:text-gray-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                    No repositories yet
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Create your first repository to get started.
                  </p>
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <GitBranch size={14} />
                  New repository
                </Button>
              </div>
            )}

            {/* No results */}
            {loadingDone && !error && repos.length > 0 && filteredRepos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  No repositories match
                </p>
                <button
                  onClick={() => { setSearch(''); setActiveGroup('all') }}
                  className="text-xs text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Repos grid */}
            {loadingDone && !error && filteredRepos.length > 0 && (
              activeGroup === 'all' ? (
                // Grouped sections
                <div className="space-y-8">
                  {sectionFolders.map((f) => {
                    const sectionRepos = groupedRepos![f.id] ?? []
                    const isCollapsed = collapsed.has(f.id)
                    return (
                      <div key={f.id}>
                        <button
                          onClick={() => toggleCollapse(f.id)}
                          className="flex items-center gap-1.5 mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                          {f.label}
                          <span className="font-normal text-gray-300 dark:text-gray-600 ml-0.5">
                            {sectionRepos.length}
                          </span>
                        </button>
                        {!isCollapsed && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {sectionRepos.map((repo) => (
                              <RepoCard
                                key={repo.id}
                                repo={repo}
                                starred={starredIds.has(repo.id)}
                                folders={allFolders}
                                currentFolderId={getEffectiveGroup(repo, folderMap)}
                                menuOpen={openMenuRepoId === repo.id}
                                isDragging={dragRepoId === repo.id}
                                onToggleStar={() => toggleStar(repo.id)}
                                onOpenMenu={() =>
                                  setOpenMenuRepoId(openMenuRepoId === repo.id ? null : repo.id)
                                }
                                onMove={(folderId) => moveRepo(repo.id, folderId)}
                                onNewFolder={() => openNewFolder(repo.id)}
                                onDragStart={() => setDragRepoId(repo.id)}
                                onDragEnd={() => {
                                  setDragRepoId(null)
                                  setDragOverFolderId(null)
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                // Flat grid for a specific folder
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredRepos.map((repo) => (
                    <RepoCard
                      key={repo.id}
                      repo={repo}
                      starred={starredIds.has(repo.id)}
                      folders={allFolders}
                      currentFolderId={getEffectiveGroup(repo, folderMap)}
                      menuOpen={openMenuRepoId === repo.id}
                      isDragging={dragRepoId === repo.id}
                      onToggleStar={() => toggleStar(repo.id)}
                      onOpenMenu={() =>
                        setOpenMenuRepoId(openMenuRepoId === repo.id ? null : repo.id)
                      }
                      onMove={(folderId) => moveRepo(repo.id, folderId)}
                      onNewFolder={() => openNewFolder(repo.id)}
                      onDragStart={() => setDragRepoId(repo.id)}
                      onDragEnd={() => {
                        setDragRepoId(null)
                        setDragOverFolderId(null)
                      }}
                    />
                  ))}
                </div>
              )
            )}

          </div>
        </div>
      </div>

      <CreateGitHubRepoModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleRepoCreated}
      />
    </>
  )
}
