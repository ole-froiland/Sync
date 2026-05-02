'use client'

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
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
} from 'lucide-react'

type Group = 'all' | 'active' | 'side-projects' | 'archived'
type SortKey = 'updated' | 'name'

const ACTIVE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000

function getRepoGroup(repo: GitHubUserRepo): 'active' | 'side-projects' | 'archived' {
  if (repo.archived) return 'archived'
  if (Date.now() - new Date(repo.updated_at).getTime() <= ACTIVE_THRESHOLD_MS) return 'active'
  return 'side-projects'
}

const GROUPS: { id: Exclude<Group, 'all'>; label: string; icon: ReactNode }[] = [
  { id: 'active', label: 'Active', icon: <Zap size={13} /> },
  { id: 'side-projects', label: 'Side projects', icon: <Folder size={13} /> },
  { id: 'archived', label: 'Archived', icon: <Archive size={13} /> },
]

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

function RepoCard({
  repo,
  starred,
  onToggleStar,
}: {
  repo: GitHubUserRepo
  starred: boolean
  onToggleStar: () => void
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-3 hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
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
            aria-label={starred ? 'Unstar' : 'Star'}
          >
            <Star size={13} fill={starred ? 'currentColor' : 'none'} />
          </button>
          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
            aria-label={`Open ${repo.name} on GitHub`}
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

export default function RepositoriesPage() {
  const github = useGitHub()

  const [repos, setRepos] = useState<GitHubUserRepo[]>([])
  const [loadingDone, setLoadingDone] = useState(false)
  const [error, setError] = useState<{ message: string; code?: string } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const [activeGroup, setActiveGroup] = useState<Group>('all')
  const [sortKey, setSortKey] = useState<SortKey>('updated')
  const [search, setSearch] = useState('')
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const notConnected =
    !loadingDone
      ? false
      : error?.code === 'not_connected' || error?.code === 'token_expired'

  const loading = !loadingDone && !error

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

  function handleRetry() {
    setError(null)
    setLoadingDone(false)
    fetchRepos()
  }

  function handleRepoCreated() {
    setLoadingDone(false)
    setError(null)
    fetchRepos()
  }

  function toggleStar(id: number) {
    setStarredIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCollapse(group: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  const groupCounts = useMemo(() => {
    const counts: Record<'active' | 'side-projects' | 'archived', number> = {
      active: 0,
      'side-projects': 0,
      archived: 0,
    }
    for (const repo of repos) counts[getRepoGroup(repo)]++
    return counts
  }, [repos])

  const filteredRepos = useMemo(() => {
    const q = search.toLowerCase()
    let result = repos.filter((repo) => {
      if (activeGroup !== 'all' && getRepoGroup(repo) !== activeGroup) return false
      if (q && !repo.name.toLowerCase().includes(q) && !repo.description?.toLowerCase().includes(q))
        return false
      return true
    })
    result = [...result].sort((a, b) =>
      sortKey === 'name'
        ? a.name.localeCompare(b.name)
        : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    return result
  }, [repos, activeGroup, search, sortKey])

  const groupedRepos = useMemo(() => {
    if (activeGroup !== 'all') return null
    const groups: Record<'active' | 'side-projects' | 'archived', GitHubUserRepo[]> = {
      active: [],
      'side-projects': [],
      archived: [],
    }
    for (const repo of filteredRepos) groups[getRepoGroup(repo)].push(repo)
    return groups
  }, [activeGroup, filteredRepos])

  const showSidebar = loadingDone && !error
  const showNewRepoButton = loadingDone && !notConnected && !error

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
        {/* Left filter sidebar — only when loaded */}
        {showSidebar && (
          <nav className="w-44 shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-3 px-2 overflow-y-auto">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1 mb-2">
              Folders
            </p>

            <button
              onClick={() => setActiveGroup('all')}
              className={cn(
                'w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors',
                activeGroup === 'all'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <span className="flex items-center gap-2">
                <LayoutGrid size={13} />
                All repos
              </span>
              <span className="text-xs tabular-nums">{repos.length}</span>
            </button>

            <div className="my-2 h-px bg-gray-100 dark:bg-gray-800" />

            {GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors',
                  activeGroup === g.id
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <span className="flex items-center gap-2">
                  {g.icon}
                  {g.label}
                </span>
                <span className="text-xs tabular-nums">{groupCounts[g.id]}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search + sort bar — only when we have repos */}
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
                  placeholder="Search repositories..."
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
                    {error?.code === 'token_expired'
                      ? 'GitHub token expired'
                      : 'Connect your GitHub account'}
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
                  <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
                    {error.message}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleRetry}>
                  Try again
                </Button>
              </div>
            )}

            {/* Loading skeletons */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <RepoSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Empty — no repos at all */}
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

            {/* No results from search/filter */}
            {loadingDone && !error && repos.length > 0 && filteredRepos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  No repositories match
                </p>
                <button
                  onClick={() => {
                    setSearch('')
                    setActiveGroup('all')
                  }}
                  className="text-xs text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Repos — grouped (all) or flat (specific group) */}
            {loadingDone && !error && filteredRepos.length > 0 &&
              (activeGroup === 'all' ? (
                <div className="space-y-8">
                  {GROUPS.map((g) => {
                    const groupRepos = groupedRepos![g.id]
                    if (groupRepos.length === 0) return null
                    const isCollapsed = collapsed.has(g.id)
                    return (
                      <div key={g.id}>
                        <button
                          onClick={() => toggleCollapse(g.id)}
                          className="flex items-center gap-1.5 mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                          {g.label}
                          <span className="font-normal text-gray-300 dark:text-gray-600 ml-0.5">
                            {groupRepos.length}
                          </span>
                        </button>
                        {!isCollapsed && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {groupRepos.map((repo) => (
                              <RepoCard
                                key={repo.id}
                                repo={repo}
                                starred={starredIds.has(repo.id)}
                                onToggleStar={() => toggleStar(repo.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredRepos.map((repo) => (
                    <RepoCard
                      key={repo.id}
                      repo={repo}
                      starred={starredIds.has(repo.id)}
                      onToggleStar={() => toggleStar(repo.id)}
                    />
                  ))}
                </div>
              ))}
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
