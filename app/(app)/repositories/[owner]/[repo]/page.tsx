'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/layout/TopBar'
import Button from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, formatDate } from '@/lib/utils'
import { languageColor } from '@/lib/github-language-colors'
import { renderMarkdown } from '@/lib/markdown'
import ShareRepoModal from '@/components/repositories/ShareRepoModal'
import DeployMenu from '@/components/repositories/DeployMenu'
import {
  ArrowLeft,
  ExternalLink,
  Code2,
  Copy,
  Share2,
  Sparkles,
  Star,
  GitFork,
  GitBranch,
  Lock,
  Globe,
  Archive,
  AlertCircle,
  FileText,
  Eye,
  Calendar,
  Check,
} from 'lucide-react'

type RepoDetail = {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  visibility: string
  default_branch: string
  updated_at: string
  pushed_at: string
  created_at: string
  html_url: string
  clone_url: string
  ssh_url: string
  language: string | null
  fork: boolean
  archived: boolean
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  watchers_count: number
  size: number
  license: { spdx_id?: string; name?: string } | null
  homepage: string | null
  topics: string[]
  owner: { login: string; avatar_url: string } | null
  readme: string | null
}

type LoadError = { message: string; code?: string }

type SummaryState =
  | { status: 'idle' }
  | { status: 'loading'; mode: 'summary' | 'explain' }
  | { status: 'ready'; mode: 'summary' | 'explain'; text: string }
  | { status: 'error'; message: string }

export default function RepositoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string; repo: string }>
  searchParams: Promise<{ from?: string | string[]; path?: string | string[] }>
}) {
  const { owner, repo } = use(params)
  const query = use(searchParams)
  const projectPath =
    query.from === 'projects' && typeof query.path === 'string' ? query.path : null

  const [data, setData] = useState<RepoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<LoadError | null>(null)
  const [copied, setCopied] = useState<'clone' | 'share' | null>(null)
  const [summary, setSummary] = useState<SummaryState>({ status: 'idle' })
  const [shareOpen, setShareOpen] = useState(false)
  const [toasts, setToasts] = useState<Array<{ id: number; tone: 'success' | 'error'; message: string }>>([])

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, tone, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2400)
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/github/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`)
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) {
          setError({ message: body?.error ?? 'Failed to load repository', code: body?.code })
          return
        }
        setData(body)
      })
      .catch(() =>
        setError({ message: 'Network error. Please try again.', code: 'network_error' })
      )
      .finally(() => setLoading(false))
  }, [owner, repo])

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const r = await fetch(
          `/api/github/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
        )
        const body = await r.json()
        if (cancelled) return
        if (!r.ok) {
          setError({ message: body?.error ?? 'Failed to load repository', code: body?.code })
          setData(null)
        } else {
          setData(body)
          setError(null)
        }
      } catch {
        if (!cancelled) {
          setError({ message: 'Network error. Please try again.', code: 'network_error' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [owner, repo])

  const flashCopied = useCallback((kind: 'clone' | 'share') => {
    setCopied(kind)
    setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1600)
  }, [])

  const copyToClipboard = useCallback(
    async (text: string, kind: 'clone' | 'share') => {
      try {
        await navigator.clipboard.writeText(text)
        flashCopied(kind)
      } catch {
        // ignore
      }
    },
    [flashCopied]
  )

  const handleCopyClone = () => {
    if (data) copyToClipboard(data.clone_url, 'clone')
  }

  const handleShare = () => {
    setShareOpen(true)
  }

  const handleOpenVSCode = () => {
    if (!data) return
    window.location.href = `vscode://vscode.git/clone?url=${encodeURIComponent(data.clone_url)}`
  }

  const summarize = useCallback(
    async (mode: 'summary' | 'explain') => {
      if (!data) return
      setSummary({ status: 'loading', mode })
      try {
        const res = await fetch('/api/ai/summarize-repo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: data.full_name,
            description: data.description,
            language: data.language,
            topics: data.topics,
            readme: data.readme,
            mode,
          }),
        })
        const body = await res.json()
        if (!res.ok) {
          setSummary({ status: 'error', message: body?.error ?? 'Could not summarize' })
          return
        }
        setSummary({ status: 'ready', mode, text: body.summary as string })
      } catch {
        setSummary({ status: 'error', message: 'Network error' })
      }
    },
    [data]
  )

  const readmeSource = data?.readme ?? null
  const renderedReadme = useMemo(() => {
    if (!readmeSource) return ''
    return renderMarkdown(readmeSource)
  }, [readmeSource])

  const langColor = languageColor(data?.language)

  return (
    <>
      <TopBar
        title={data ? data.full_name : `${owner}/${repo}`}
        actions={
          <Link
            href="/repositories"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <ArrowLeft size={14} />
            All repositories
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          {projectPath && (
            <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  if (window.history.length > 1) window.history.back()
                  else window.location.href = '/projects'
                }}
                className="inline-flex items-center gap-1.5 font-medium text-gray-500 transition hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-300"
              >
                <ArrowLeft size={14} />
                Tilbake til Projects
              </button>
              <span className="text-gray-400 dark:text-gray-600">/</span>
              <span className="min-w-0 truncate font-semibold text-gray-950 dark:text-gray-100">
                {projectPath}
              </span>
            </div>
          )}

          {loading && <DetailSkeleton />}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30">
                <AlertCircle size={24} className="text-red-400 dark:text-red-500" />
              </div>
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {error.code === 'not_found'
                    ? 'Repository not found'
                    : 'Failed to load repository'}
                </p>
                <p className="max-w-xs text-xs text-gray-400 dark:text-gray-500">
                  {error.message}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={load}>
                  Try again
                </Button>
                <Link href="/repositories">
                  <Button size="sm">Back to repositories</Button>
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && data && (
            <>
              <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                      <span>{owner}</span>
                      <span>/</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                        {data.name}
                      </h1>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none',
                          data.private
                            ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                        )}
                      >
                        {data.private ? <Lock size={9} /> : <Globe size={9} />}
                        {data.private ? 'Private' : 'Public'}
                      </span>
                      {data.fork && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          <GitFork size={9} />
                          Fork
                        </span>
                      )}
                      {data.archived && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          <Archive size={9} />
                          Archived
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      {data.description || (
                        <span className="text-gray-400 dark:text-gray-500">No description.</span>
                      )}
                    </p>

                    {data.topics.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {data.topics.slice(0, 8).map((topic) => (
                          <span
                            key={topic}
                            className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={data.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      <ExternalLink size={13} />
                      GitHub
                    </a>
                    <button
                      onClick={handleOpenVSCode}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      <Code2 size={13} />
                      VS Code
                    </button>
                    <button
                      onClick={handleCopyClone}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                      title="Copy clone URL"
                    >
                      {copied === 'clone' ? <Check size={13} /> : <Copy size={13} />}
                      {copied === 'clone' ? 'Copied' : 'Clone'}
                    </button>
                    <button
                      onClick={handleShare}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      <Share2 size={13} />
                      Share
                    </button>
                    <DeployMenu repoUrl={data.html_url} />
                    <Button size="sm" onClick={() => summarize('summary')}>
                      <Sparkles size={13} />
                      Summarize
                    </Button>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  {data.language && (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: langColor }}
                      />
                      <span className="text-gray-600 dark:text-gray-300">{data.language}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <GitBranch size={11} />
                    {data.default_branch}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Star size={11} />
                    {data.stargazers_count.toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <GitFork size={11} />
                    {data.forks_count.toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Eye size={11} />
                    {data.watchers_count.toLocaleString()}
                  </span>
                  {data.license?.spdx_id && data.license.spdx_id !== 'NOASSERTION' && (
                    <span className="inline-flex items-center gap-1.5">
                      <FileText size={11} />
                      {data.license.spdx_id}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={11} />
                    Updated {formatDate(data.updated_at)}
                  </span>
                </div>
              </div>

              {summary.status !== 'idle' && (
                <div className="mt-4 rounded-2xl border border-purple-200/70 bg-gradient-to-br from-purple-50 to-fuchsia-50/40 p-5 dark:border-purple-900/50 dark:from-purple-950/30 dark:to-fuchsia-950/20">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-purple-700 dark:text-purple-300">
                      <Sparkles size={12} />
                      {summary.status === 'ready' && summary.mode === 'explain'
                        ? 'What this repo does'
                        : 'AI summary'}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => summarize('summary')}
                        disabled={summary.status === 'loading'}
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                          summary.status === 'ready' && summary.mode === 'summary'
                            ? 'bg-purple-200/60 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200'
                            : 'text-purple-600 hover:bg-purple-100/60 dark:text-purple-300 dark:hover:bg-purple-900/40'
                        )}
                      >
                        Summarize
                      </button>
                      <button
                        onClick={() => summarize('explain')}
                        disabled={summary.status === 'loading'}
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                          summary.status === 'ready' && summary.mode === 'explain'
                            ? 'bg-purple-200/60 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200'
                            : 'text-purple-600 hover:bg-purple-100/60 dark:text-purple-300 dark:hover:bg-purple-900/40'
                        )}
                      >
                        Explain
                      </button>
                    </div>
                  </div>
                  {summary.status === 'loading' && (
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  )}
                  {summary.status === 'ready' && (
                    <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                      {summary.text}
                    </p>
                  )}
                  {summary.status === 'error' && (
                    <p className="text-sm text-red-600 dark:text-red-400">{summary.message}</p>
                  )}
                </div>
              )}

              <div className="mt-6">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  <FileText size={12} />
                  README
                </div>
                {data.readme ? (
                  <div
                    className="rounded-2xl border border-gray-200/80 bg-white px-6 py-5 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                    // The renderer escapes HTML before emitting markup, so output is safe.
                    dangerouslySetInnerHTML={{ __html: renderedReadme }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-900">
                    <FileText size={20} className="text-gray-300 dark:text-gray-600" />
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      No README yet
                    </p>
                    <p className="max-w-xs text-xs text-gray-400 dark:text-gray-500">
                      Add a README on GitHub to give this repository a clear, scannable
                      introduction.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {data && (
        <ShareRepoModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          repo={{
            full_name: data.full_name,
            name: data.name,
            url: data.html_url,
            owner: data.owner?.login ?? owner,
            description: data.description,
            language: data.language,
          }}
          onToast={showToast}
        />
      )}

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
    </>
  )
}

function DetailSkeleton() {
  return (
    <>
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <Skeleton className="mb-2 h-4 w-24" />
        <Skeleton className="mb-3 h-7 w-72" />
        <Skeleton className="mb-1 h-3 w-full" />
        <Skeleton className="mb-4 h-3 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
      <div className="mt-6 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </>
  )
}
