'use client'

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type DragEvent,
} from 'react'
import TopBar from '@/components/layout/TopBar'
import Button from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import CreateGitHubRepoModal from '@/components/dashboard/CreateGitHubRepoModal'
import { useGitHub } from '@/context/GitHubContext'
import { useUser } from '@/context/UserContext'
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
  FolderOpen,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Check,
  Plus,
  FolderPlus,
  Pencil,
  Trash2,
  Home,
} from 'lucide-react'

type SortKey = 'updated' | 'name'
type RootSectionId = 'favorites' | 'private'
type ViewId = 'home' | RootSectionId | `folder:${string}`
type RepoLocationMap = Record<string, { folderId: string | null }>
type FolderNodeId = 'home' | `folder:${string}`

interface FolderDef {
  id: string
  label: string
  parentId: string | null
}

interface PathSegment {
  id: ViewId
  label: string
}

type DragItem = { type: 'repo'; repoId: number } | { type: 'folder'; folderId: string } | null

const ROOT_SECTIONS: RootSectionId[] = ['favorites', 'private']

const ROOT_SECTION_META: Record<RootSectionId, { label: string; icon: React.ReactNode }> = {
  favorites: { label: 'Favorites', icon: <Star size={13} /> },
  private: { label: 'Private', icon: <Lock size={13} /> },
}

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function makeStorageKey(userId: string | null | undefined, suffix: string): string {
  return `sync_repositories_${suffix}_${userId ?? 'anon'}`
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function isRootSectionView(view: ViewId): view is RootSectionId {
  return view !== 'home' && !view.startsWith('folder:')
}

function sortRepos(repos: GitHubUserRepo[], sortKey: SortKey): GitHubUserRepo[] {
  return [...repos].sort((a, b) =>
    sortKey === 'name'
      ? a.name.localeCompare(b.name)
      : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )
}

function matchesRepoSearch(repo: GitHubUserRepo, query: string): boolean {
  if (!query) return true
  const haystack = `${repo.name} ${repo.full_name} ${repo.description ?? ''} ${repo.language ?? ''}`.toLowerCase()
  return haystack.includes(query)
}

function getViewFolderId(view: ViewId): string | null {
  return view.startsWith('folder:') ? view.slice('folder:'.length) : null
}

function getRepoFolderId(
  repoId: number,
  locations: RepoLocationMap,
  folderMap: Map<string, FolderDef>
): string | null {
  const folderId = locations[String(repoId)]?.folderId ?? null
  return folderId && folderMap.has(folderId) ? folderId : null
}

function buildFolderMap(folders: FolderDef[]): Map<string, FolderDef> {
  return new Map(folders.map((folder) => [folder.id, folder]))
}

function getFolderPath(folderId: string, folderMap: Map<string, FolderDef>): FolderDef[] {
  const path: FolderDef[] = []
  let current = folderMap.get(folderId) ?? null

  while (current) {
    path.unshift(current)
    current = current.parentId ? (folderMap.get(current.parentId) ?? null) : null
  }

  return path
}

function isFolderDescendant(
  folderId: string,
  possibleParentId: string,
  folderMap: Map<string, FolderDef>
): boolean {
  let current = folderMap.get(possibleParentId) ?? null

  while (current) {
    if (current.parentId === folderId) return true
    current = current.parentId ? (folderMap.get(current.parentId) ?? null) : null
  }

  return false
}

function collectDescendantIds(folderId: string, folders: FolderDef[]): string[] {
  const descendants = new Set<string>([folderId])
  let changed = true

  while (changed) {
    changed = false
    for (const folder of folders) {
      if (!descendants.has(folder.id) && folder.parentId && descendants.has(folder.parentId)) {
        descendants.add(folder.id)
        changed = true
      }
    }
  }

  return [...descendants]
}

function RepoSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="mb-1 h-3 w-full" />
      <Skeleton className="mb-4 h-3 w-2/3" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

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
  icon: React.ReactNode
  label: string
  count: number
  active: boolean
  dragOver: boolean
  onClick: () => void
  onDragOver?: (e: DragEvent<HTMLButtonElement>) => void
  onDragLeave?: () => void
  onDrop?: (e: DragEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-sm transition-all duration-150',
        active
          ? 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-900'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200',
        dragOver && 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300'
      )}
    >
      <span className="pointer-events-none flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="pointer-events-none text-xs tabular-nums text-inherit/70">{count}</span>
    </button>
  )
}

function MoveMenu({
  folders,
  currentFolderId,
  onMove,
  onNewFolder,
}: {
  folders: Array<{ id: string; label: string; depth: number }>
  currentFolderId: string | null
  onMove: (folderId: string | null) => void
  onNewFolder: () => void
}) {
  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-2xl border border-gray-200 bg-white py-1 shadow-lg shadow-black/5 dark:border-gray-700 dark:bg-gray-900 dark:shadow-black/30"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
        Move to folder
      </p>
      <button
        onClick={() => onMove(null)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <span className="flex items-center gap-2">
          <Home size={13} className="text-gray-400 dark:text-gray-500" />
          Home
        </span>
        {currentFolderId === null && <Check size={12} className="ml-2 text-purple-500" />}
      </button>
      {folders.map((folder) => (
        <button
          key={folder.id}
          onClick={() => onMove(folder.id)}
          className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <span className="flex items-center gap-2">
            <span style={{ width: folder.depth * 12 }} aria-hidden />
            <Folder size={13} className="text-gray-400 dark:text-gray-500" />
            {folder.label}
          </span>
          {currentFolderId === folder.id && <Check size={12} className="ml-2 text-purple-500" />}
        </button>
      ))}
      <div className="mx-2 my-1 h-px bg-gray-100 dark:bg-gray-800" />
      <button
        onClick={onNewFolder}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <FolderPlus size={13} />
        New folder
      </button>
    </div>
  )
}

function FolderMenu({
  onAddSubfolder,
  canMoveToRoot,
  onRename,
  onDelete,
  onMoveToRoot,
}: {
  onAddSubfolder: () => void
  canMoveToRoot: boolean
  onRename: () => void
  onDelete: () => void
  onMoveToRoot: () => void
}) {
  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 min-w-[168px] rounded-2xl border border-gray-200 bg-white py-1 shadow-lg shadow-black/5 dark:border-gray-700 dark:bg-gray-900 dark:shadow-black/30"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onAddSubfolder}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <FolderPlus size={13} />
        Add subfolder
      </button>
      <button
        onClick={onRename}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Pencil size={13} />
        Rename
      </button>
      {canMoveToRoot && (
        <button
          onClick={onMoveToRoot}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Home size={13} />
          Move to root
        </button>
      )}
      <div className="mx-2 my-1 h-px bg-gray-100 dark:bg-gray-800" />
      <button
        onClick={onDelete}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
      >
        <Trash2 size={13} />
        Delete
      </button>
    </div>
  )
}

function FolderTreeItem({
  folder,
  depth,
  foldersByParent,
  activeFolderId,
  collapsed,
  dragOverNode,
  repoCounts,
  childFolderCounts,
  editingFolderId,
  editingValue,
  onEditingChange,
  onEditingSubmit,
  onEditingCancel,
  openFolderMenuId,
  onToggleCollapse,
  onSelect,
  onAddSubfolder,
  onStartRename,
  onDelete,
  onMoveToRoot,
  onOpenMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  folder: FolderDef
  depth: number
  foldersByParent: Map<string | null, FolderDef[]>
  activeFolderId: string | null
  collapsed: Set<string>
  dragOverNode: FolderNodeId | null
  repoCounts: Record<string, number>
  childFolderCounts: Record<string, number>
  editingFolderId: string | null
  editingValue: string
  onEditingChange: (value: string) => void
  onEditingSubmit: (folderId: string) => void
  onEditingCancel: () => void
  openFolderMenuId: string | null
  onToggleCollapse: (folderId: string) => void
  onSelect: (folderId: string) => void
  onAddSubfolder: (folderId: string) => void
  onStartRename: (folder: FolderDef) => void
  onDelete: (folderId: string) => void
  onMoveToRoot: (folderId: string) => void
  onOpenMenu: (folderId: string | null) => void
  onDragStart: (folderId: string) => void
  onDragEnd: () => void
  onDragOver: (e: DragEvent<HTMLDivElement>, folderId: string) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent<HTMLDivElement>, folderId: string) => void
}) {
  const children = foldersByParent.get(folder.id) ?? []
  const isCollapsed = collapsed.has(folder.id)
  const isActive = activeFolderId === folder.id
  const isEditing = editingFolderId === folder.id
  const dragOver = dragOverNode === `folder:${folder.id}`
  const repoCount = repoCounts[folder.id] ?? 0
  const childCount = childFolderCounts[folder.id] ?? 0
  const itemCount = repoCount + childCount
  const menuOpen = openFolderMenuId === folder.id

  return (
    <div>
      <div
        onDragOver={(e) => onDragOver(e, folder.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, folder.id)}
        className={cn(
          'group relative flex items-center gap-1 rounded-xl pr-1 transition-colors',
          dragOver && 'bg-purple-50 dark:bg-purple-950/40'
        )}
        style={{ paddingLeft: depth * 14 }}
      >
        <button
          onClick={() => (children.length > 0 ? onToggleCollapse(folder.id) : onSelect(folder.id))}
          className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          {children.length > 0 ? (
            isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />
          ) : (
            <span className="h-3 w-3" />
          )}
        </button>

        <button
          draggable={!isEditing}
          onDragStart={() => onDragStart(folder.id)}
          onDragEnd={onDragEnd}
          onClick={() => onSelect(folder.id)}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-between rounded-xl px-2 py-1.5 text-sm transition-colors',
            isActive
              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-200'
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {isCollapsed ? <Folder size={13} /> : <FolderOpen size={13} />}
            {isEditing ? (
              <input
                autoFocus
                value={editingValue}
                onChange={(e) => onEditingChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onEditingSubmit(folder.id)
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    onEditingCancel()
                  }
                }}
                onBlur={() => onEditingSubmit(folder.id)}
                className="min-w-0 rounded-md border border-purple-300 bg-transparent px-1.5 py-0.5 text-sm text-gray-900 outline-none ring-0 dark:border-purple-700 dark:text-gray-100"
              />
            ) : (
              <span className="truncate">{folder.label}</span>
            )}
          </span>
          {itemCount > 0 ? (
            <span className="ml-2 text-[11px] tabular-nums text-inherit/70">{itemCount}</span>
          ) : null}
        </button>

        {!isEditing && (
          <div className="relative flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAddSubfolder(folder.id)
              }}
              className="rounded-md p-1 text-gray-300 opacity-0 transition-all hover:text-gray-500 group-hover:opacity-100 dark:text-gray-600 dark:hover:text-gray-400"
              title="Add subfolder"
            >
              <Plus size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenMenu(menuOpen ? null : folder.id)
              }}
              className="rounded-md p-1 text-gray-300 opacity-0 transition-all hover:text-gray-500 group-hover:opacity-100 dark:text-gray-600 dark:hover:text-gray-400"
            >
              <MoreHorizontal size={13} />
            </button>
            {menuOpen && (
              <FolderMenu
                onAddSubfolder={() => onAddSubfolder(folder.id)}
                canMoveToRoot={folder.parentId !== null}
                onRename={() => onStartRename(folder)}
                onDelete={() => onDelete(folder.id)}
                onMoveToRoot={() => onMoveToRoot(folder.id)}
              />
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
          isCollapsed ? 'grid-rows-[0fr] opacity-50' : 'grid-rows-[1fr] opacity-100'
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-0.5 space-y-0.5">
            {children.map((child) => (
              <FolderTreeItem
                key={child.id}
                folder={child}
                depth={depth + 1}
                foldersByParent={foldersByParent}
                activeFolderId={activeFolderId}
                collapsed={collapsed}
                dragOverNode={dragOverNode}
                repoCounts={repoCounts}
                childFolderCounts={childFolderCounts}
                editingFolderId={editingFolderId}
                editingValue={editingValue}
                onEditingChange={onEditingChange}
                onEditingSubmit={onEditingSubmit}
                onEditingCancel={onEditingCancel}
                openFolderMenuId={openFolderMenuId}
                onToggleCollapse={onToggleCollapse}
                onSelect={onSelect}
                onAddSubfolder={onAddSubfolder}
                onStartRename={onStartRename}
                onDelete={onDelete}
                onMoveToRoot={onMoveToRoot}
                onOpenMenu={onOpenMenu}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function FolderCard({
  folder,
  repoCount,
  childCount,
  onOpen,
  menuOpen,
  onOpenMenu,
  onAddSubfolder,
  onRename,
  onDelete,
  onMoveToRoot,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  dragOver,
}: {
  folder: FolderDef
  repoCount: number
  childCount: number
  onOpen: () => void
  menuOpen: boolean
  onOpenMenu: () => void
  onAddSubfolder: () => void
  onRename: () => void
  onDelete: () => void
  onMoveToRoot: () => void
  draggable: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (e: DragEvent<HTMLButtonElement>) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent<HTMLButtonElement>) => void
  dragOver: boolean
}) {
  return (
    <div
      className={cn(
        'group relative flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition-all dark:border-gray-800 dark:bg-gray-900',
        dragOver && 'border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-950/30'
      )}
    >
      <button
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onOpen}
        className="min-w-0 flex-1"
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              <Folder size={15} className="text-gray-500 dark:text-gray-400" />
              <span className="truncate">{folder.label}</span>
            </div>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              {repoCount} repos · {childCount} folders
            </p>
          </div>
          <ChevronRight size={15} className="text-gray-300 dark:text-gray-600" />
        </div>
      </button>
      <div className="relative ml-3 flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAddSubfolder()
          }}
          className="rounded-md p-1 text-gray-300 opacity-0 transition-all hover:text-gray-500 group-hover:opacity-100 dark:text-gray-600 dark:hover:text-gray-400"
          title="Add subfolder"
        >
          <Plus size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenMenu()
          }}
          className="rounded-md p-1 text-gray-300 opacity-0 transition-all hover:text-gray-500 group-hover:opacity-100 dark:text-gray-600 dark:hover:text-gray-400"
        >
          <MoreHorizontal size={13} />
        </button>
        {menuOpen && (
          <FolderMenu
            onAddSubfolder={onAddSubfolder}
            canMoveToRoot={folder.parentId !== null}
            onRename={onRename}
            onDelete={onDelete}
            onMoveToRoot={onMoveToRoot}
          />
        )}
      </div>
    </div>
  )
}

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
  folders: Array<{ id: string; label: string; depth: number }>
  currentFolderId: string | null
  menuOpen: boolean
  isDragging: boolean
  onToggleStar: () => void
  onOpenMenu: () => void
  onMove: (folderId: string | null) => void
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
        'relative flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 transition-all duration-150 hover:border-gray-200 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700',
        'cursor-grab select-none active:cursor-grabbing',
        isDragging && 'scale-[0.98] opacity-40'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {repo.private ? (
            <Lock size={13} className="flex-shrink-0 text-gray-400 dark:text-gray-500" />
          ) : (
            <Globe size={13} className="flex-shrink-0 text-gray-400 dark:text-gray-500" />
          )}
          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            className="truncate text-sm font-semibold text-gray-900 transition-colors hover:text-purple-600 dark:text-gray-100 dark:hover:text-purple-400"
          >
            {repo.name}
          </a>
          {repo.fork && <GitFork size={12} className="flex-shrink-0 text-gray-300 dark:text-gray-600" />}
          {repo.archived && (
            <Archive size={12} className="flex-shrink-0 text-amber-400 dark:text-amber-500" />
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5">
          <button
            onClick={onToggleStar}
            title={starred ? 'Remove from favorites' : 'Add to favorites'}
            className={cn(
              'rounded p-1 transition-colors',
              starred
                ? 'text-amber-400 hover:text-amber-500'
                : 'text-gray-200 hover:text-amber-400 dark:text-gray-700 dark:hover:text-amber-500'
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
              className="rounded p-1 text-gray-300 transition-colors hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
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
            className="p-1 text-gray-300 transition-colors hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {repo.description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {repo.description}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-3">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            repo.private
              ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
          )}
        >
          {repo.private ? 'Private' : 'Public'}
        </span>
        {repo.language && <span className="text-xs text-gray-400 dark:text-gray-500">{repo.language}</span>}
        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
          <GitBranch size={11} />
          {repo.default_branch}
        </span>
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
          Updated {formatDate(repo.updated_at)}
        </span>
      </div>
    </div>
  )
}

export default function RepositoriesPage() {
  const github = useGitHub()
  const user = useUser()

  const [repos, setRepos] = useState<GitHubUserRepo[]>([])
  const [loadingDone, setLoadingDone] = useState(false)
  const [error, setError] = useState<{ message: string; code?: string } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const [folders, setFolders] = useState<FolderDef[]>(() =>
    typeof window === 'undefined' ? [] : lsGet<FolderDef[]>(makeStorageKey(user?.id, 'folders'), [])
  )
  const [repoLocations, setRepoLocations] = useState<RepoLocationMap>(() =>
    typeof window === 'undefined'
      ? {}
      : lsGet<RepoLocationMap>(makeStorageKey(user?.id, 'repo_locations'), {})
  )
  const [starredIds, setStarredIds] = useState<Set<number>>(() =>
    typeof window === 'undefined'
      ? new Set()
      : new Set(lsGet<number[]>(makeStorageKey(user?.id, 'starred'), []))
  )
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() =>
    typeof window === 'undefined'
      ? new Set()
      : new Set(lsGet<string[]>(makeStorageKey(user?.id, 'collapsed_folders'), []))
  )

  const [activeView, setActiveView] = useState<ViewId>('home')
  const [sortKey, setSortKey] = useState<SortKey>('updated')
  const [search, setSearch] = useState('')
  const [openRepoMenuId, setOpenRepoMenuId] = useState<number | null>(null)
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null)

  const [folderComposerOpen, setFolderComposerOpen] = useState(false)
  const [folderComposerName, setFolderComposerName] = useState('')
  const folderComposerRef = useRef<HTMLInputElement>(null)
  const folderComposerSubmittedRef = useRef(false)
  const [pendingAssignRepoId, setPendingAssignRepoId] = useState<number | null>(null)
  const [pendingParentFolderId, setPendingParentFolderId] = useState<string | null>(null)

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')

  const [dragItem, setDragItem] = useState<DragItem>(null)
  const [dragOverNode, setDragOverNode] = useState<FolderNodeId | null>(null)

  const storageKeys = useMemo(
    () => ({
      folders: makeStorageKey(user?.id, 'folders'),
      locations: makeStorageKey(user?.id, 'repo_locations'),
      stars: makeStorageKey(user?.id, 'starred'),
      collapsed: makeStorageKey(user?.id, 'collapsed_folders'),
    }),
    [user?.id]
  )

  const folderMap = useMemo(() => buildFolderMap(folders), [folders])

  const foldersByParent = useMemo(() => {
    const map = new Map<string | null, FolderDef[]>()

    for (const folder of folders) {
      const siblings = map.get(folder.parentId) ?? []
      siblings.push(folder)
      map.set(folder.parentId, siblings)
    }

    for (const [parentId, list] of map) {
      map.set(
        parentId,
        [...list].sort((a, b) => a.label.localeCompare(b.label))
      )
    }

    return map
  }, [folders])

  const flattenedFolders = useMemo(() => {
    const items: Array<{ id: string; label: string; depth: number }> = []

    const walk = (parentId: string | null, depth: number) => {
      for (const folder of foldersByParent.get(parentId) ?? []) {
        items.push({ id: folder.id, label: folder.label, depth })
        walk(folder.id, depth + 1)
      }
    }

    walk(null, 0)
    return items
  }, [foldersByParent])

  const childFolderCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const folder of folders) {
      counts[folder.id] = foldersByParent.get(folder.id)?.length ?? 0
    }
    return counts
  }, [folders, foldersByParent])

  const directRepoCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const location of Object.values(repoLocations)) {
      if (!location.folderId) continue
      counts[location.folderId] = (counts[location.folderId] ?? 0) + 1
    }
    return counts
  }, [repoLocations])

  const rootCounts = useMemo(() => {
    return {
      home: repos.filter((repo) => getRepoFolderId(repo.id, repoLocations, folderMap) === null).length,
      favorites: repos.filter((repo) => starredIds.has(repo.id)).length,
      private: repos.filter((repo) => repo.private).length,
    }
  }, [folderMap, repoLocations, repos, starredIds])

  const notConnected =
    !loadingDone ? false : error?.code === 'not_connected' || error?.code === 'token_expired'
  const loading = !loadingDone && !error
  const showSidebar = loadingDone && !error
  const showNewRepoButton = loadingDone && !notConnected && !error

  useEffect(() => {
    localStorage.setItem(storageKeys.folders, JSON.stringify(folders))
  }, [folders, storageKeys])

  useEffect(() => {
    localStorage.setItem(storageKeys.locations, JSON.stringify(repoLocations))
  }, [repoLocations, storageKeys])

  useEffect(() => {
    localStorage.setItem(storageKeys.collapsed, JSON.stringify([...collapsedFolders]))
  }, [collapsedFolders, storageKeys])

  useEffect(() => {
    localStorage.setItem(storageKeys.stars, JSON.stringify([...starredIds]))
  }, [starredIds, storageKeys])

  useEffect(() => {
    if (openRepoMenuId === null && openFolderMenuId === null) return

    const close = () => {
      setOpenRepoMenuId(null)
      setOpenFolderMenuId(null)
    }

    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openRepoMenuId, openFolderMenuId])

  useEffect(() => {
    if (!folderComposerOpen) return
    folderComposerSubmittedRef.current = false
    requestAnimationFrame(() => folderComposerRef.current?.focus())
  }, [folderComposerOpen])

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
  }, [fetchRepos])

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

  const toggleStar = (id: number) => {
    setStarredIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openFolderComposer = (parentFolderId: string | null, assignRepoId?: number | null) => {
    setFolderComposerOpen(true)
    setPendingParentFolderId(parentFolderId)
    setPendingAssignRepoId(assignRepoId ?? null)
    setFolderComposerName('')
    setOpenFolderMenuId(null)
    setOpenRepoMenuId(null)
  }

  const closeFolderComposer = () => {
    setFolderComposerOpen(false)
    setFolderComposerName('')
    setPendingParentFolderId(null)
    setPendingAssignRepoId(null)
  }

  const createFolder = (name: string, parentFolderId: string | null, assignRepoId?: number | null) => {
    if (folderComposerSubmittedRef.current) return
    folderComposerSubmittedRef.current = true

    const trimmed = name.trim()
    if (!trimmed) {
      closeFolderComposer()
      return
    }

    const id = genId()
    const nextFolder: FolderDef = {
      id,
      label: trimmed,
      parentId: parentFolderId,
    }

    setFolders((prev) => [...prev, nextFolder])
    if (assignRepoId !== null && assignRepoId !== undefined) {
      setRepoLocations((prev) => ({ ...prev, [String(assignRepoId)]: { folderId: id } }))
    }

    setCollapsedFolders((prev) => {
      const next = new Set(prev)
      if (parentFolderId) next.delete(parentFolderId)
      return next
    })
    closeFolderComposer()
    setActiveView(`folder:${id}`)
  }

  const confirmFolderComposer = () =>
    createFolder(folderComposerName, pendingParentFolderId, pendingAssignRepoId)

  const moveRepoToFolder = (repoId: number, folderId: string | null) => {
    setRepoLocations((prev) => ({ ...prev, [String(repoId)]: { folderId } }))
    setOpenRepoMenuId(null)
  }

  const startRenameFolder = (folder: FolderDef) => {
    setEditingFolderId(folder.id)
    setEditingFolderName(folder.label)
    setOpenFolderMenuId(null)
  }

  const submitFolderRename = (folderId: string) => {
    const trimmed = editingFolderName.trim()
    if (!trimmed) {
      setEditingFolderId(null)
      setEditingFolderName('')
      return
    }

    setFolders((prev) =>
      prev.map((folder) => (folder.id === folderId ? { ...folder, label: trimmed } : folder))
    )
    setEditingFolderId(null)
    setEditingFolderName('')
  }

  const cancelFolderRename = () => {
    setEditingFolderId(null)
    setEditingFolderName('')
  }

  const deleteFolder = (folderId: string) => {
    const deletedIds = new Set(collectDescendantIds(folderId, folders))

    setFolders((prev) => prev.filter((folder) => !deletedIds.has(folder.id)))
    setRepoLocations((prev) => {
      const next: RepoLocationMap = {}
      for (const [repoId, location] of Object.entries(prev)) {
        next[repoId] =
          location.folderId && deletedIds.has(location.folderId) ? { folderId: null } : location
      }
      return next
    })
    setCollapsedFolders((prev) => {
      const next = new Set(prev)
      for (const id of deletedIds) next.delete(id)
      return next
    })
    if (activeView === `folder:${folderId}`) setActiveView('home')
    setOpenFolderMenuId(null)
  }

  const moveFolderToRoot = (folderId: string) => {
    setFolders((prev) =>
      prev.map((folder) => (folder.id === folderId ? { ...folder, parentId: null } : folder))
    )
    setOpenFolderMenuId(null)
  }

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const handleDropOnHome = () => {
    if (!dragItem) return

    if (dragItem.type === 'repo') {
      moveRepoToFolder(dragItem.repoId, null)
    } else {
      setFolders((prev) =>
        prev.map((folder) => (folder.id === dragItem.folderId ? { ...folder, parentId: null } : folder))
      )
    }

    setDragItem(null)
    setDragOverNode(null)
  }

  const handleDropOnFolder = (folderId: string) => {
    if (!dragItem) return

    if (dragItem.type === 'repo') {
      moveRepoToFolder(dragItem.repoId, folderId)
    } else if (dragItem.folderId !== folderId && !isFolderDescendant(dragItem.folderId, folderId, folderMap)) {
      setFolders((prev) =>
        prev.map((folder) => (folder.id === dragItem.folderId ? { ...folder, parentId: folderId } : folder))
      )
      setCollapsedFolders((prev) => {
        const next = new Set(prev)
        next.delete(folderId)
        return next
      })
    }

    setDragItem(null)
    setDragOverNode(null)
  }

  const resolvedActiveView: ViewId =
    activeView.startsWith('folder:') && !folderMap.has(activeView.slice('folder:'.length))
      ? 'home'
      : activeView

  const currentFolderId = getViewFolderId(resolvedActiveView)
  const currentFolder = currentFolderId ? (folderMap.get(currentFolderId) ?? null) : null
  const currentPath = useMemo(
    () => (currentFolder ? getFolderPath(currentFolder.id, folderMap) : []),
    [currentFolder, folderMap]
  )

  const pathSegments = useMemo<PathSegment[]>(() => {
    if (resolvedActiveView === 'home') return [{ id: 'home', label: 'Home' }]
    if (isRootSectionView(resolvedActiveView)) {
      return [
        { id: 'home', label: 'Home' },
        { id: resolvedActiveView, label: ROOT_SECTION_META[resolvedActiveView].label },
      ]
    }

    return [
      { id: 'home', label: 'Home' },
      ...currentPath.map((folder) => ({ id: `folder:${folder.id}` as ViewId, label: folder.label })),
    ]
  }, [currentPath, resolvedActiveView])

  const currentRepos = useMemo(() => {
    const query = search.trim().toLowerCase()

    const filtered = repos.filter((repo) => {
      const folderId = getRepoFolderId(repo.id, repoLocations, folderMap)

      if (resolvedActiveView === 'home' && folderId !== null) return false
      if (resolvedActiveView === 'favorites' && !starredIds.has(repo.id)) return false
      if (resolvedActiveView === 'private' && !repo.private) return false
      if (resolvedActiveView.startsWith('folder:') && folderId !== currentFolderId) return false
      if (!matchesRepoSearch(repo, query)) return false
      return true
    })

    return sortRepos(filtered, sortKey)
  }, [currentFolderId, folderMap, repoLocations, repos, resolvedActiveView, search, sortKey, starredIds])

  const visibleChildFolders = useMemo(() => {
    if (resolvedActiveView !== 'home' && !resolvedActiveView.startsWith('folder:')) return []

    const query = search.trim().toLowerCase()
    const parentId = currentFolderId
    const childFolders = foldersByParent.get(parentId) ?? []

    return childFolders.filter((folder) => !query || folder.label.toLowerCase().includes(query))
  }, [currentFolderId, foldersByParent, resolvedActiveView, search])

  const currentTitle = useMemo(() => {
    if (resolvedActiveView === 'home') return 'Repositories'
    if (isRootSectionView(resolvedActiveView)) return ROOT_SECTION_META[resolvedActiveView].label
    return currentFolder?.label ?? 'Folder'
  }, [currentFolder, resolvedActiveView])

  const currentSubtitle = useMemo(() => {
    if (resolvedActiveView === 'home') return 'Organize repositories with folders, favorites, and private views.'
    if (resolvedActiveView === 'favorites') return 'Starred repositories live here without duplicating the source repo.'
    if (resolvedActiveView === 'private') return 'Private repositories are scoped to your account and hidden from other users.'
    if (resolvedActiveView.startsWith('folder:')) return 'Nested folders behave like a lightweight file system for your repos.'
    return ''
  }, [resolvedActiveView])

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

      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <nav className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-100 bg-white px-3 py-4 dark:border-gray-800 dark:bg-gray-900">
            <SidebarItem
              icon={<Home size={13} />}
              label="Home"
              count={rootCounts.home}
              active={resolvedActiveView === 'home'}
              dragOver={dragOverNode === 'home'}
              onClick={() => setActiveView('home')}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverNode('home')
              }}
              onDragLeave={() => setDragOverNode(null)}
              onDrop={(e) => {
                e.preventDefault()
                handleDropOnHome()
              }}
            />

            <div className="mt-1 space-y-0.5">
              {ROOT_SECTIONS.map((sectionId) => (
                <SidebarItem
                  key={sectionId}
                  icon={ROOT_SECTION_META[sectionId].icon}
                  label={ROOT_SECTION_META[sectionId].label}
                  count={rootCounts[sectionId]}
                  active={resolvedActiveView === sectionId}
                  dragOver={false}
                  onClick={() => setActiveView(sectionId)}
                />
              ))}
            </div>

            <div className="my-3 h-px bg-gray-100 dark:bg-gray-800" />

            <div className="space-y-0.5">
              {(foldersByParent.get(null) ?? []).map((folder) => (
                <FolderTreeItem
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  foldersByParent={foldersByParent}
                  activeFolderId={currentFolderId}
                  collapsed={collapsedFolders}
                  dragOverNode={dragOverNode}
                  repoCounts={directRepoCounts}
                  childFolderCounts={childFolderCounts}
                  editingFolderId={editingFolderId}
                  editingValue={editingFolderName}
                  onEditingChange={setEditingFolderName}
                  onEditingSubmit={submitFolderRename}
                  onEditingCancel={cancelFolderRename}
                  openFolderMenuId={openFolderMenuId}
                  onToggleCollapse={toggleFolderCollapse}
                  onSelect={(folderId) => setActiveView(`folder:${folderId}`)}
                  onAddSubfolder={(folderId) => openFolderComposer(folderId)}
                  onStartRename={startRenameFolder}
                  onDelete={deleteFolder}
                  onMoveToRoot={moveFolderToRoot}
                  onOpenMenu={setOpenFolderMenuId}
                  onDragStart={(folderId) => setDragItem({ type: 'folder', folderId })}
                  onDragEnd={() => {
                    setDragItem(null)
                    setDragOverNode(null)
                  }}
                  onDragOver={(e, folderId) => {
                    e.preventDefault()
                    setDragOverNode(`folder:${folderId}`)
                  }}
                  onDragLeave={() => setDragOverNode(null)}
                  onDrop={(e, folderId) => {
                    e.preventDefault()
                    handleDropOnFolder(folderId)
                  }}
                />
              ))}
            </div>

            {folderComposerOpen && (
              <div className="mt-2 px-1">
                <input
                  ref={folderComposerRef}
                  value={folderComposerName}
                  onChange={(e) => setFolderComposerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      confirmFolderComposer()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      closeFolderComposer()
                    }
                  }}
                  onBlur={confirmFolderComposer}
                  placeholder="New folder"
                  className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
            )}

            <button
              onClick={() => openFolderComposer(null, null)}
              className="mt-2 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
            >
              <Plus size={13} />
              New folder
            </button>
          </nav>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          {showSidebar && repos.length > 0 && (
            <div className="border-b border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                    {pathSegments.map((segment, index) => (
                      <div key={segment.id} className="flex items-center gap-1.5">
                        {index > 0 && <span>/</span>}
                        <button
                          onClick={() => setActiveView(segment.id)}
                          className={cn(
                            'rounded-md px-1.5 py-0.5 transition-colors',
                            index === pathSegments.length - 1
                              ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300'
                              : 'hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300'
                          )}
                        >
                          {segment.label}
                        </button>
                      </div>
                    ))}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{currentTitle}</h2>
                  {currentSubtitle ? (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{currentSubtitle}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1 sm:w-80">
                    <Search
                      size={13}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                    />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={
                        resolvedActiveView === 'home' || resolvedActiveView.startsWith('folder:')
                          ? 'Search folders and repositories...'
                          : 'Search repositories...'
                      }
                      className="w-full rounded-xl border border-gray-200 bg-transparent py-2 pl-8 pr-3 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  >
                    <option value="updated">Last updated</option>
                    <option value="name">Name A-Z</option>
                  </select>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      openFolderComposer(
                        resolvedActiveView.startsWith('folder:') ? currentFolderId : null,
                        null
                      )
                    }
                  >
                    <FolderPlus size={14} />
                    New folder
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {notConnected && (
              <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
                  <GitBranch size={26} className="text-gray-400 dark:text-gray-500" />
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {error?.code === 'token_expired' ? 'GitHub token expired' : 'Connect your GitHub account'}
                  </p>
                  <p className="max-w-xs text-xs text-gray-400 dark:text-gray-500">
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
                  <a href="/settings" className="underline transition-colors hover:text-gray-400">
                    Settings → Connected accounts
                  </a>
                </p>
              </div>
            )}

            {loadingDone && error && !notConnected && (
              <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30">
                  <AlertCircle size={24} className="text-red-400 dark:text-red-500" />
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Failed to load repositories
                  </p>
                  <p className="max-w-xs text-xs text-gray-400 dark:text-gray-500">{error.message}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleRetry}>
                  Try again
                </Button>
              </div>
            )}

            {loading && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <RepoSkeleton key={i} />
                ))}
              </div>
            )}

            {loadingDone && !error && repos.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
                  <GitBranch size={26} className="text-gray-400 dark:text-gray-500" />
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
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

            {loadingDone && !error && repos.length > 0 && (
              <div className="space-y-6">
                {visibleChildFolders.length > 0 && (
                  <section>
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                      <Folder size={12} />
                      Subfolders
                    </div>
                    <div className="space-y-2">
                      {visibleChildFolders.map((folder) => (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          repoCount={directRepoCounts[folder.id] ?? 0}
                          childCount={childFolderCounts[folder.id] ?? 0}
                          onOpen={() => setActiveView(`folder:${folder.id}`)}
                          menuOpen={openFolderMenuId === folder.id}
                          onOpenMenu={() =>
                            setOpenFolderMenuId(openFolderMenuId === folder.id ? null : folder.id)
                          }
                          onAddSubfolder={() => openFolderComposer(folder.id)}
                          onRename={() => startRenameFolder(folder)}
                          onDelete={() => deleteFolder(folder.id)}
                          onMoveToRoot={() => moveFolderToRoot(folder.id)}
                          draggable
                          onDragStart={() => setDragItem({ type: 'folder', folderId: folder.id })}
                          onDragEnd={() => {
                            setDragItem(null)
                            setDragOverNode(null)
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setDragOverNode(`folder:${folder.id}`)
                          }}
                          onDragLeave={() => setDragOverNode(null)}
                          onDrop={(e) => {
                            e.preventDefault()
                            handleDropOnFolder(folder.id)
                          }}
                          dragOver={dragOverNode === `folder:${folder.id}`}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {currentRepos.length === 0 && visibleChildFolders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {search
                        ? 'No folders or repositories match your search.'
                        : resolvedActiveView === 'favorites'
                          ? 'No favorites yet.'
                          : resolvedActiveView.startsWith('folder:')
                            ? 'This folder is empty.'
                            : 'No repositories match this view.'}
                    </p>
                    <button
                      onClick={() => {
                        setSearch('')
                        if (resolvedActiveView !== 'home' && !resolvedActiveView.startsWith('folder:')) {
                          setActiveView('home')
                        }
                      }}
                      className="text-xs text-purple-500 transition-colors hover:text-purple-600 dark:hover:text-purple-400"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  currentRepos.length > 0 && (
                    <section>
                      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                        <GitBranch size={12} />
                        Repositories
                        <span className="text-gray-300 dark:text-gray-600">{currentRepos.length}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {currentRepos.map((repo) => (
                          <RepoCard
                            key={repo.id}
                            repo={repo}
                            starred={starredIds.has(repo.id)}
                            folders={flattenedFolders}
                            currentFolderId={repoLocations[String(repo.id)]?.folderId ?? null}
                            menuOpen={openRepoMenuId === repo.id}
                            isDragging={dragItem?.type === 'repo' && dragItem.repoId === repo.id}
                            onToggleStar={() => toggleStar(repo.id)}
                            onOpenMenu={() =>
                              setOpenRepoMenuId(openRepoMenuId === repo.id ? null : repo.id)
                            }
                            onMove={(folderId) => moveRepoToFolder(repo.id, folderId)}
                            onNewFolder={() => openFolderComposer(currentFolderId, repo.id)}
                            onDragStart={() => setDragItem({ type: 'repo', repoId: repo.id })}
                            onDragEnd={() => {
                              setDragItem(null)
                              setDragOverNode(null)
                            }}
                          />
                        ))}
                      </div>
                    </section>
                  )
                )}
              </div>
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
