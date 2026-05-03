'use client'

import { useEffect, useState } from 'react'
import {
  Building2,
  ChevronDown,
  Code2,
  ExternalLink,
  Flame,
  GitFork,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { GitHubRepo } from '@/types'

type Timeframe = 'daily' | 'weekly' | 'monthly'
type TrendingKind = 'repositories' | 'developers'

type TrendingDeveloper = {
  login: string
  avatarUrl: string
  repos: GitHubRepo[]
  stars: number
  topLanguage: string | null
}

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

function buildDevelopers(repos: GitHubRepo[]): TrendingDeveloper[] {
  return Object.values(
    repos.reduce<Record<string, TrendingDeveloper>>((acc, repo) => {
      const login = repo.owner.login
      const current = acc[login] ?? {
        login,
        avatarUrl: repo.owner.avatar_url,
        repos: [],
        stars: 0,
        topLanguage: null,
      }

      current.repos.push(repo)
      current.stars += repo.stargazers_count
      current.topLanguage ??= repo.language
      acc[login] = current

      return acc
    }, {})
  ).sort((a, b) => b.stars - a.stars)
}

export default function TrendingView() {
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<Timeframe>('weekly')
  const [kind, setKind] = useState<TrendingKind>('repositories')
  const [language, setLanguage] = useState('all')
  const [languages, setLanguages] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/github/repos?range=${timeframe}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRepos(data)
          setLanguages(
            Array.from(
              new Set(data.map((repo: GitHubRepo) => repo.language).filter(Boolean))
            ) as string[]
          )
        } else {
          setError(data.error ?? 'Failed to load')
        }
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false))
  }, [timeframe])

  function handleTimeframeChange(value: Timeframe) {
    setLoading(true)
    setError(null)
    setTimeframe(value)
  }

  const filteredRepos = repos
    .filter((repo) => language === 'all' || repo.language === language)
    .slice(0, 25)
  const developers = buildDevelopers(filteredRepos)
  const hasResults = kind === 'repositories' ? filteredRepos.length > 0 : developers.length > 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/40 dark:text-indigo-300">
          <TrendingUp size={13} />
          GitHub activity in Sync
        </div>
        <h1 className="mt-4 text-4xl font-semibold text-gray-950 dark:text-gray-50">Trending</h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          See what the developer community is building, starring, and sharing right now.
        </p>
      </header>

      <section className="mx-auto overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-4 border-b border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900/70 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full rounded-md border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-950 lg:w-auto">
            {(['repositories', 'developers'] as TrendingKind[]).map((item) => {
              const active = kind === item
              const Icon = item === 'repositories' ? Code2 : Users

              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setKind(item)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-colors lg:flex-none ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                  }`}
                >
                  <Icon size={14} />
                  {item === 'repositories' ? 'Repositories' : 'Developers'}
                </button>
              )
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-center">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="shrink-0 font-medium">Language:</span>
              <span className="relative block w-full sm:w-48">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="h-9 w-full appearance-none rounded-md border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  <option value="all">Any</option>
                  {languages.map((item) => (
                    <option key={item} value={item}>
                      {item}
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
                  className="h-9 w-full appearance-none rounded-md border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
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
                className="grid gap-4 border-b border-gray-100 px-4 py-5 last:border-b-0 dark:border-gray-800 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
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
            {filteredRepos.map((repo, index) => (
              <article
                key={repo.id}
                className="group grid gap-3 border-b border-gray-100 px-4 py-5 transition-colors last:border-b-0 hover:bg-gray-50/80 dark:border-gray-800 dark:hover:bg-gray-800/30 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:gap-4"
              >
                <div className="font-mono text-sm font-semibold text-gray-400 dark:text-gray-500">
                  {index + 1}
                </div>

                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate text-base font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {repo.full_name}
                    </a>
                    <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      Public
                    </span>
                  </div>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                    {repo.description ?? 'No description provided.'}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                    {repo.language && (
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`h-3 w-3 rounded-full ${
                            LANGUAGE_DOT_COLORS[repo.language] ?? 'bg-gray-400'
                          }`}
                        />
                        {repo.language}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Star size={13} />
                      {repo.stargazers_count.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame size={13} />
                      {formatCount(repo.stargazers_count)} stars this {PERIOD_LABELS[timeframe]}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 size={13} />
                      {repo.owner.login}
                    </span>
                  </div>
                </div>

                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-indigo-200 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:border-indigo-800 dark:hover:text-indigo-400 sm:self-start"
                >
                  <Star size={13} />
                  Star
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div>
            {developers.map((developer, index) => {
              const topRepo = developer.repos[0]

              return (
                <article
                  key={developer.login}
                  className="group grid gap-3 border-b border-gray-100 px-4 py-5 transition-colors last:border-b-0 hover:bg-gray-50/80 dark:border-gray-800 dark:hover:bg-gray-800/30 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:gap-4"
                >
                  <div className="font-mono text-sm font-semibold text-gray-400 dark:text-gray-500">
                    {index + 1}
                  </div>

                  <div className="flex min-w-0 gap-3">
                    <span
                      aria-hidden="true"
                      className="h-12 w-12 shrink-0 rounded-full border border-gray-200 bg-cover bg-center dark:border-gray-700"
                      style={{ backgroundImage: `url(${developer.avatarUrl})` }}
                    />
                    <div className="min-w-0">
                      <a
                        href={`https://github.com/${developer.login}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-base font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {developer.login}
                      </a>
                      <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
                        Popular repo: {topRepo?.full_name ?? 'No repository details available'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                        {developer.topLanguage && (
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`h-3 w-3 rounded-full ${
                                LANGUAGE_DOT_COLORS[developer.topLanguage] ?? 'bg-gray-400'
                              }`}
                            />
                            {developer.topLanguage}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Star size={13} />
                          {developer.stars.toLocaleString()} stars
                        </span>
                        <span className="flex items-center gap-1">
                          <GitFork size={13} />
                          {developer.repos.length} trending repos
                        </span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={`https://github.com/${developer.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-indigo-200 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:border-indigo-800 dark:hover:text-indigo-400 sm:self-start"
                  >
                    <ExternalLink size={13} />
                    Profile
                  </a>
                </article>
              )
            })}
          </div>
        )}

        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-400">
          Ranked by GitHub stars from repositories discovered through the existing GitHub data
          source.
        </div>
      </section>
    </div>
  )
}
