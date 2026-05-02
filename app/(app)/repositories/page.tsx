'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import Button from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import CreateGitHubRepoModal from '@/components/dashboard/CreateGitHubRepoModal'
import { useGitHub } from '@/context/GitHubContext'
import { formatDate } from '@/lib/utils'
import type { GitHubUserRepo } from '@/types'
import {
  GitBranch,
  Lock,
  Globe,
  ExternalLink,
  AlertCircle,
  GitFork,
  Archive,
} from 'lucide-react'

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

function RepoCard({ repo }: { repo: GitHubUserRepo }) {
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
        <a
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 flex-shrink-0 transition-colors"
          aria-label={`Open ${repo.name} on GitHub`}
        >
          <ExternalLink size={14} />
        </a>
      </div>

      {repo.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
          {repo.description}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            repo.private
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
          }`}
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

  // loading = connected but fetch hasn't finished (and no error yet)
  const loading = github.connected && !loadingDone && !error

  const fetchRepos = useCallback(() => {
    fetch('/api/github/user-repos')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRepos(data)
          setError(null)
        } else {
          setError({ message: data.error ?? 'Failed to load repositories', code: data.code })
        }
      })
      .catch(() => setError({ message: 'Network error. Please try again.', code: 'network_error' }))
      .finally(() => setLoadingDone(true))
  }, [])

  useEffect(() => {
    if (github.connected) fetchRepos()
  }, [github.connected, fetchRepos])

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

  return (
    <>
      <TopBar
        title="Repositories"
        actions={
          github.connected ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <GitBranch size={14} />
              New repository
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Not connected */}
        {!github.connected && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <GitBranch size={26} className="text-gray-400 dark:text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                Connect your GitHub account
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
                Link your GitHub to view and manage your repositories directly from Sync. Your
                token is stored securely server-side and never exposed to the browser.
              </p>
            </div>
            <a href="/api/github/connect">
              <Button>
                <GitBranch size={14} />
                Connect GitHub
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

        {/* Error */}
        {github.connected && !loading && error && (
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
            {error.code === 'token_expired' || error.code === 'not_connected' ? (
              <a href="/api/github/connect">
                <Button variant="secondary" size="sm">
                  <GitBranch size={13} />
                  Reconnect GitHub
                </Button>
              </a>
            ) : (
              <Button variant="secondary" size="sm" onClick={handleRetry}>
                Try again
              </Button>
            )}
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

        {/* Empty */}
        {github.connected && loadingDone && !error && repos.length === 0 && (
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

        {/* Repos grid */}
        {github.connected && loadingDone && !error && repos.length > 0 && (
          <>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
              {repos.length} {repos.length === 1 ? 'repository' : 'repositories'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {repos.map((repo) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
            </div>
          </>
        )}
      </div>

      <CreateGitHubRepoModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleRepoCreated}
      />
    </>
  )
}
