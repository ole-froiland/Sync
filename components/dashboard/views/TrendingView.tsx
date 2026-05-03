'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Star, ExternalLink, Globe } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { GitHubRepo } from '@/types'

type Timeframe = 'daily' | 'weekly'

const LANGUAGE_DOT_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-green-500',
  Rust: 'bg-orange-500',
  Go: 'bg-cyan-500',
  Java: 'bg-red-500',
  'C++': 'bg-purple-500',
  Ruby: 'bg-red-400',
  Swift: 'bg-orange-400',
  Kotlin: 'bg-violet-500',
  C: 'bg-gray-500',
  'C#': 'bg-green-600',
  PHP: 'bg-indigo-400',
  Scala: 'bg-red-600',
  Dart: 'bg-sky-500',
  Elixir: 'bg-purple-400',
  Haskell: 'bg-violet-600',
  Lua: 'bg-blue-400',
  Shell: 'bg-gray-400',
  Zig: 'bg-amber-500',
}

export default function TrendingView() {
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<Timeframe>('weekly')
  const [language, setLanguage] = useState<string>('all')
  const [languages, setLanguages] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/github/repos')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRepos(data)
          const langs = Array.from(
            new Set(data.map((r: GitHubRepo) => r.language).filter(Boolean))
          ) as string[]
          setLanguages(langs)
        } else {
          setError(data.error ?? 'Failed to load')
        }
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = repos
    .filter((r) => language === 'all' || r.language === language)
    .slice(0, timeframe === 'daily' ? 3 : repos.length)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header + filters */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            GitHub Trending
          </h2>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Timeframe toggle */}
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {(['daily', 'weekly'] as Timeframe[]).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  timeframe === t
                    ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {t === 'daily' ? 'Daily' : 'Weekly'}
              </button>
            ))}
          </div>

          {/* Language filter */}
          {languages.length > 0 && (
            <div className="relative">
              <Globe
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
              />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="pl-7 pr-7 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600"
              >
                <option value="all">All languages</option>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500 text-xs">
                ▾
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2.5 p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl"
            >
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <div className="flex items-center gap-3 mt-1">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-3 w-10 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <TrendingUp size={24} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 dark:text-gray-500">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <TrendingUp size={24} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No repos found for this filter
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((repo) => (
            <a
              key={repo.id}
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-2 p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline truncate leading-snug">
                  {repo.full_name}
                </span>
                <ExternalLink
                  size={12}
                  className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 flex-shrink-0 mt-0.5 transition-colors"
                />
              </div>

              {repo.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                  {repo.description}
                </p>
              )}

              <div className="flex items-center gap-2 mt-auto pt-1">
                {repo.language && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        LANGUAGE_DOT_COLORS[repo.language] ?? 'bg-gray-400'
                      }`}
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {repo.language}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-amber-500 ml-auto">
                  <Star size={10} />
                  <span>{repo.stargazers_count.toLocaleString()}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
