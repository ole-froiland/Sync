'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Star, ExternalLink } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { TrendingRepository, TrendingResponse } from '@/types'

function isTrendingResponse(data: TrendingResponse | { error?: string }): data is TrendingResponse {
  return 'kind' in data
}

export default function GitHubTrending() {
  const [repos, setRepos] = useState<TrendingRepository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/github/trending?kind=repositories&since=weekly&language=all')
      .then((r) => r.json())
      .then((data: TrendingResponse | { error?: string }) => {
        if (isTrendingResponse(data)) setRepos(data.repositories ?? [])
        else setError(data.error ?? 'Failed to load')
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={13} className="text-gray-400 dark:text-gray-500" />
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            GitHub Trending
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 py-1">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || repos.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
        <TrendingUp size={20} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">GitHub Trending</p>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
          {error ?? 'No trending repos found this week'}
        </p>
      </div>
    )
  }

  return (
    <div className="border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={13} className="text-gray-400 dark:text-gray-500" />
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
          GitHub Trending
        </h3>
        <span className="text-xs text-gray-300 dark:text-gray-600 ml-auto">This week</span>
      </div>
      <div className="flex flex-col gap-0">
        {repos.slice(0, 5).map((repo, i) => (
          <div
            key={repo.fullName}
            className={`flex items-start gap-3 py-3 ${
              i < Math.min(repos.length, 5) - 1
                ? 'border-b border-gray-50 dark:border-gray-800/60'
                : ''
            }`}
          >
            <div className="flex-1 min-w-0">
              <a
                href={repo.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
              >
                {repo.fullName}
              </a>
              {repo.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 leading-snug mt-0.5">
                  {repo.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1">
                {repo.language && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{repo.language}</span>
                )}
                {repo.totalStars !== undefined && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-500">
                    <Star size={10} />
                    {repo.totalStars.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <a
              href={repo.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 flex-shrink-0 mt-0.5"
            >
              <ExternalLink size={12} />
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
