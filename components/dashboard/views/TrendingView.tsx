'use client'

import { useEffect, useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  GitFork,
  Star,
  TrendingUp,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type {
  TrendingDeveloper,
  TrendingLanguage,
  TrendingRepository,
  TrendingResponse,
} from '@/types'

type Timeframe = 'daily' | 'weekly' | 'monthly'
type TrendingKind = 'repositories' | 'developers'

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

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

const PERIOD_LABELS: Record<Timeframe, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
}

const formatCount = (value: number) =>
  Intl.NumberFormat('en', { notation: 'compact' }).format(value)

function isTrendingResponse(data: TrendingResponse | { error?: string }): data is TrendingResponse {
  return 'kind' in data
}

export default function TrendingView() {
  const [repositories, setRepositories] = useState<TrendingRepository[]>([])
  const [developers, setDevelopers] = useState<TrendingDeveloper[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<Timeframe>('weekly')
  const [kind, setKind] = useState<TrendingKind>('repositories')
  const [language, setLanguage] = useState('all')
  const [languages, setLanguages] = useState<TrendingLanguage[]>([])
  const [sourceUrl, setSourceUrl] = useState('https://github.com/trending?since=weekly')

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      kind,
      since: timeframe,
      language,
    })

    fetch(`/api/github/trending?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: TrendingResponse | { error?: string }) => {
        if (isTrendingResponse(data)) {
          setRepositories(data.repositories ?? [])
          setDevelopers(data.developers ?? [])
          setLanguages(data.languages)
          setSourceUrl(data.sourceUrl)
          setError(null)
        } else {
          setError(data.error ?? 'Failed to load GitHub Trending')
          setRepositories([])
          setDevelopers([])
        }
      })
      .catch((err) => {
        if ((err as DOMException).name !== 'AbortError') {
          setError('Failed to load GitHub Trending')
          setRepositories([])
          setDevelopers([])
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [kind, timeframe, language])

  function handleTimeframeChange(value: Timeframe) {
    if (value === timeframe) return
    setLoading(true)
    setError(null)
    setTimeframe(value)
  }

  function handleKindChange(value: TrendingKind) {
    if (value === kind) return
    setLoading(true)
    setError(null)
    setKind(value)
  }

  function handleLanguageChange(value: string) {
    if (value === language) return
    setLoading(true)
    setError(null)
    setLanguage(value)
  }

  const hasResults = kind === 'repositories' ? repositories.length > 0 : developers.length > 0

  return (
    <div className="mx-auto max-w-[1012px] px-4 pb-10 pt-7 sm:px-6">
      <header className="mb-5 text-center">
        <h1 className="text-[32px] font-semibold leading-tight text-gray-950 dark:text-gray-50">
          Trending
        </h1>
        <p className="mt-2 text-base text-gray-500 dark:text-gray-400">
          See what the developer community is building, starring, and sharing right now.
        </p>
      </header>

      <section className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/40 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-full rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950 lg:w-auto">
            {(['repositories', 'developers'] as TrendingKind[]).map((item) => {
              const active = kind === item

              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleKindChange(item)}
                  className={`flex flex-1 items-center justify-center border-r border-gray-200 px-3 py-1.5 text-sm font-medium transition-colors last:border-r-0 dark:border-gray-700 lg:flex-none ${
                    active
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                      : 'bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {item === 'repositories' ? 'Repositories' : 'Developers'}
                </button>
              )
            })}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-center lg:gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="shrink-0 font-medium">Language:</span>
              <span className="relative block w-full sm:w-44">
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="h-8 w-full appearance-none rounded-md border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  <option value="all">Any</option>
                  {languages.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </span>
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="shrink-0 font-medium">Date range:</span>
              <span className="relative block w-full sm:w-36">
                <select
                  value={timeframe}
                  onChange={(e) => handleTimeframeChange(e.target.value as Timeframe)}
                  className="h-8 w-full appearance-none rounded-md border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  {(['daily', 'weekly', 'monthly'] as Timeframe[]).map((item) => (
                    <option key={item} value={item}>
                      {TIMEFRAME_LABELS[item]}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </span>
            </label>
          </div>
        </div>

        {loading ? (
          <div>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="grid gap-3 border-b border-gray-200 px-4 py-4 last:border-b-0 dark:border-gray-800 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
              >
                <Skeleton className="h-5 w-5 rounded-md" />
                <div className="min-w-0 space-y-3">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="hidden h-8 w-20 rounded-md sm:block" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-4 py-20 text-center">
            <TrendingUp size={24} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
          </div>
        ) : !hasResults ? (
          <div className="px-4 py-20 text-center">
            <TrendingUp size={24} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No trending {kind} found for this filter
            </p>
          </div>
        ) : kind === 'repositories' ? (
          <div>
            {repositories.map((repo) => (
              <article
                key={repo.fullName}
                className="grid gap-3 border-b border-gray-200 px-4 py-4 last:border-b-0 dark:border-gray-800 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:gap-4"
              >
                <div className="pt-1 font-mono text-sm text-gray-500 dark:text-gray-400">
                  {repo.rank}.
                </div>

                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <BookOpen size={16} className="shrink-0 text-gray-500 dark:text-gray-400" />
                    <a
                      href={repo.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate text-xl font-semibold leading-tight text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {repo.fullName}
                    </a>
                  </div>

                  {repo.description && (
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                      {repo.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                    {repo.language && (
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`h-3 w-3 rounded-full border border-black/10 dark:border-white/10 ${
                            LANGUAGE_DOT_COLORS[repo.language] ?? 'bg-gray-400'
                          }`}
                        />
                        {repo.language}
                      </span>
                    )}
                    {repo.totalStars !== undefined && (
                      <span className="flex items-center gap-1">
                        <Star size={13} />
                        {repo.totalStars.toLocaleString()}
                      </span>
                    )}
                    {repo.forks !== undefined && (
                      <span className="flex items-center gap-1">
                        <GitFork size={13} />
                        {repo.forks.toLocaleString()}
                      </span>
                    )}
                    {repo.builtBy && repo.builtBy.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <span>Built by</span>
                        <span className="flex -space-x-1">
                          {repo.builtBy.slice(0, 5).map((user) => (
                            <a
                              key={user.username}
                              href={user.profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block h-5 w-5 overflow-hidden rounded-full border border-white bg-gray-100 dark:border-gray-950 dark:bg-gray-800"
                              title={user.username}
                            >
                              {user.avatarUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={user.avatarUrl}
                                  alt={`@${user.username}`}
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </a>
                          ))}
                        </span>
                      </span>
                    )}
                    {repo.starsThisPeriod !== undefined && (
                      <span className="flex items-center gap-1 sm:ml-auto">
                        <Star size={13} />
                        {formatCount(repo.starsThisPeriod)} stars this {PERIOD_LABELS[timeframe]}
                      </span>
                    )}
                  </div>
                </div>

                <a
                  href={repo.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 sm:self-start"
                >
                  <Star size={13} />
                  Star
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div>
            {developers.map((developer) => (
              <article
                key={developer.username}
                className="grid gap-3 border-b border-gray-200 px-4 py-4 last:border-b-0 dark:border-gray-800 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:gap-4"
              >
                <div className="pt-1 font-mono text-sm text-gray-500 dark:text-gray-400">
                  {developer.rank}.
                </div>

                <div className="flex min-w-0 gap-3">
                  {developer.avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={developer.avatarUrl}
                      alt={`@${developer.username}`}
                      className="h-12 w-12 shrink-0 rounded-full border border-gray-200 bg-gray-100 object-cover dark:border-gray-700 dark:bg-gray-800"
                    />
                  )}
                  <div className="min-w-0">
                    <a
                      href={developer.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-xl font-semibold leading-tight text-gray-900 hover:text-indigo-600 hover:underline dark:text-gray-100 dark:hover:text-indigo-400"
                    >
                      {developer.name ?? developer.username}
                    </a>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                      @{developer.username}
                    </p>

                    {developer.popularRepo && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Popular repo
                        </p>
                        <a
                          href={developer.popularRepoUrl ?? developer.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          <BookOpen
                            size={14}
                            className="shrink-0 text-gray-500 dark:text-gray-400"
                          />
                          <span className="truncate">{developer.popularRepo}</span>
                        </a>
                        {developer.repoDescription && (
                          <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
                            {developer.repoDescription}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <a
                  href={developer.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 sm:self-start"
                >
                  <ExternalLink size={13} />
                  Follow
                </a>
              </article>
            ))}
          </div>
        )}

        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
          Ranked in the same order as{' '}
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
            GitHub Trending
          </a>
          . Cached for up to five minutes.
        </div>
      </section>
    </div>
  )
}
