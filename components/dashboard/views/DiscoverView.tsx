'use client'

import { useMemo, useState } from 'react'
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Newspaper,
  Plus,
  Radio,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import type { NewsItem } from '@/types'

type SummaryMode = 'short' | 'medium' | 'long'
type SourceFilterValue =
  | 'All'
  | 'TechCrunch'
  | 'Hacker News'
  | 'Anthropic'
  | 'OpenAI'
  | 'Supabase'
  | 'Vercel'

type Article = {
  id: number
  title: string
  url: string
  source: Exclude<SourceFilterValue, 'All'>
  time: string
  preview: string
}

type SummaryState = {
  loading: boolean
  text: string | null
  error: string | null
}

type PodcastState = {
  status: 'idle' | 'loading' | 'generating' | 'ready' | 'error'
  message: string | null
  audioUrl: string | null
}

const SOURCES: SourceFilterValue[] = [
  'All',
  'TechCrunch',
  'Hacker News',
  'Anthropic',
  'OpenAI',
  'Supabase',
  'Vercel',
]

const SUMMARY_OPTIONS: { value: SummaryMode; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
]

function timeSince(unixSeconds: number): string {
  const diff = Math.max(0, Date.now() / 1000 - unixSeconds)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function getArticleUrl(item: NewsItem) {
  return item.url ?? `https://news.ycombinator.com/item?id=${item.id}`
}

function toArticle(item: NewsItem): Article {
  const comments = item.descendants ?? 0
  const commentLabel = comments === 1 ? 'comment' : 'comments'

  return {
    id: item.id,
    title: item.title,
    url: getArticleUrl(item),
    source: 'Hacker News',
    time: timeSince(item.time),
    preview: `${item.score} points by ${item.by} with ${comments} ${commentLabel}.`,
  }
}

interface DiscoverViewProps {
  news: NewsItem[]
  newsLoading: boolean
}

interface SummarizeControlProps {
  value: SummaryMode
  onChange: (value: SummaryMode) => void
}

function SummarizeControl({ value, onChange }: SummarizeControlProps) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      {SUMMARY_OPTIONS.map((option) => {
        const active = value === option.value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-8 min-w-16 rounded-[5px] px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

interface SourceFilterProps {
  activeSources: SourceFilterValue[]
  onChange: (sources: SourceFilterValue[]) => void
}

function SourceFilter({ activeSources, onChange }: SourceFilterProps) {
  function toggleSource(source: SourceFilterValue) {
    if (source === 'All') {
      onChange(['All'])
      return
    }

    const selected = activeSources.includes('All')
      ? [source]
      : activeSources.includes(source)
        ? activeSources.filter((item) => item !== source)
        : [...activeSources, source]

    onChange(selected.length > 0 ? selected : ['All'])
  }

  return (
    <div className="flex flex-col gap-3 border-y border-gray-200 py-4 dark:border-gray-800 lg:flex-row lg:items-center">
      <button
        type="button"
        className="inline-flex h-9 w-fit items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-900"
      >
        Sources
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {SOURCES.map((source) => {
          const active = activeSources.includes(source)

          return (
            <button
              key={source}
              type="button"
              aria-pressed={active}
              onClick={() => toggleSource(source)}
              className={cn(
                'h-8 rounded-full border px-3 text-sm font-medium transition-colors',
                active
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:bg-gray-900'
              )}
            >
              {source}
            </button>
          )
        })}

        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-gray-300 bg-white px-3 text-sm font-medium text-gray-600 transition-colors hover:border-indigo-300 hover:text-indigo-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400 dark:hover:border-indigo-800 dark:hover:text-indigo-300"
        >
          <Plus size={14} />
          Add source
        </button>
      </div>

      <button
        type="button"
        className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100"
        title="Filter settings"
        aria-label="Filter settings"
      >
        <SlidersHorizontal size={16} />
      </button>
    </div>
  )
}

interface ArticleRowProps {
  article: Article
  summary: SummaryState | undefined
  saved: boolean
  onOpen: (article: Article) => void
  onSummarize: (article: Article) => void
  onToggleSaved: (articleId: number) => void
}

function ArticleRow({
  article,
  summary,
  saved,
  onOpen,
  onSummarize,
  onToggleSaved,
}: ArticleRowProps) {
  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => onOpen(article)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen(article)
      }}
      className="group cursor-pointer border-b border-gray-200 px-2 py-4 transition-colors last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900/60 sm:px-3"
    >
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-3 sm:gap-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-50 text-xs font-bold text-orange-600 ring-1 ring-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900">
          Y
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold leading-6 text-gray-950 transition-colors group-hover:text-indigo-700 dark:text-gray-100 dark:group-hover:text-indigo-300">
            {article.title}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span>{article.source}</span>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span>{article.time}</span>
          </div>
          <p className="mt-1 truncate text-sm text-gray-600 dark:text-gray-400">{article.preview}</p>

          {summary?.loading && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              Summarizing
            </p>
          )}
          {summary?.error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{summary.error}</p>
          )}
          {summary?.text && (
            <p className="mt-3 border-l-2 border-indigo-200 pl-3 text-sm leading-6 text-gray-700 dark:border-indigo-800 dark:text-gray-300">
              {summary.text}
            </p>
          )}
        </div>

        <div className="flex items-start gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onSummarize(article)
            }}
            className="inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium text-gray-500 transition-colors hover:bg-white hover:text-indigo-700 dark:text-gray-400 dark:hover:bg-gray-950 dark:hover:text-indigo-300 sm:w-auto sm:px-2"
            aria-label="Summarize article"
            title="Summarize article"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">Summarize</span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleSaved(article.id)
            }}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
              saved
                ? 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/50'
                : 'text-gray-400 hover:bg-white hover:text-gray-700 dark:hover:bg-gray-950 dark:hover:text-gray-200'
            )}
            aria-label={saved ? 'Remove bookmark' : 'Save article'}
            title={saved ? 'Remove bookmark' : 'Save article'}
          >
            {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          </button>
        </div>
      </div>
    </article>
  )
}

export default function DiscoverView({ news, newsLoading }: DiscoverViewProps) {
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('short')
  const [activeSources, setActiveSources] = useState<SourceFilterValue[]>(['All'])
  const [summaries, setSummaries] = useState<Record<number, SummaryState>>({})
  const [savedArticles, setSavedArticles] = useState<number[]>([])
  const [podcast, setPodcast] = useState<PodcastState>({
    status: 'idle',
    message: null,
    audioUrl: null,
  })

  const articles = useMemo(() => news.map(toArticle), [news])
  const visibleArticles = useMemo(() => {
    if (activeSources.includes('All')) return articles
    return articles.filter((article) => activeSources.includes(article.source))
  }, [activeSources, articles])

  async function summarizeArticle(article: Article) {
    setSummaries((current) => ({
      ...current,
      [article.id]: { loading: true, text: null, error: null },
    }))

    try {
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: summaryMode,
          article: {
            title: article.title,
            source: article.source,
            preview: article.preview,
            url: article.url,
          },
        }),
      })

      const data = (await response.json()) as { summary?: string; error?: string }
      if (!response.ok || !data.summary) {
        throw new Error(data.error ?? 'Summary unavailable')
      }

      setSummaries((current) => ({
        ...current,
        [article.id]: { loading: false, text: data.summary ?? null, error: null },
      }))
    } catch {
      setSummaries((current) => ({
        ...current,
        [article.id]: { loading: false, text: null, error: 'Could not summarize this article.' },
      }))
    }
  }

  async function makePodcast() {
    if (visibleArticles.length === 0) return

    setPodcast({ status: 'loading', message: 'Preparing podcast', audioUrl: null })

    try {
      const selected = savedArticles.length
        ? visibleArticles.filter((article) => savedArticles.includes(article.id))
        : visibleArticles
      const sourceArticles = selected.length > 0 ? selected : visibleArticles

      const response = await fetch('/api/podcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles: sourceArticles.map((article) => ({
            title: article.title,
            source: article.source,
            preview: article.preview,
            url: article.url,
          })),
        }),
      })

      const data = (await response.json()) as {
        status?: 'generating' | 'ready'
        audioUrl?: string
        message?: string
        error?: string
      }
      if (!response.ok) throw new Error(data.error ?? 'Podcast unavailable')

      setPodcast({
        status: data.audioUrl ? 'ready' : 'generating',
        message: data.message ?? `Generating podcast from ${sourceArticles.length} stories.`,
        audioUrl: data.audioUrl ?? null,
      })
    } catch {
      setPodcast({
        status: 'error',
        message: 'Could not start podcast generation.',
        audioUrl: null,
      })
    }
  }

  function openArticle(article: Article) {
    window.open(article.url, '_blank', 'noopener,noreferrer')
  }

  function toggleSaved(articleId: number) {
    setSavedArticles((current) =>
      current.includes(articleId)
        ? current.filter((id) => id !== articleId)
        : [...current, articleId]
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-gray-950 dark:text-gray-100">
            Discover
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Read, filter, summarize, or turn stories into a podcast.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Summarize</span>
            <SummarizeControl value={summaryMode} onChange={setSummaryMode} />
          </div>
          <button
            type="button"
            onClick={makePodcast}
            disabled={newsLoading || visibleArticles.length === 0 || podcast.status === 'loading'}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {podcast.status === 'loading' ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Radio size={15} />
            )}
            Make podcast
          </button>
        </div>
      </div>

      <SourceFilter activeSources={activeSources} onChange={setActiveSources} />

      {podcast.status !== 'idle' && (
        <div
          className={cn(
            'mt-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
            podcast.status === 'error'
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
              : 'border-indigo-100 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300'
          )}
        >
          {podcast.status === 'loading' ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <CheckCircle2 size={15} />
          )}
          <span>{podcast.message}</span>
          {podcast.audioUrl && (
            <a
              href={podcast.audioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto font-medium underline"
            >
              Open audio
            </a>
          )}
        </div>
      )}

      <section className="mt-5">
        {newsLoading ? (
          <div>
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-4 border-b border-gray-200 px-2 py-4 dark:border-gray-800 sm:px-3"
              >
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-full" />
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            ))}
          </div>
        ) : visibleArticles.length === 0 ? (
          <div className="py-20 text-center">
            <Newspaper size={24} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              No articles found
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Try All sources or refresh the feed.
            </p>
          </div>
        ) : (
          <div>
            {visibleArticles.map((article) => (
              <ArticleRow
                key={article.id}
                article={article}
                summary={summaries[article.id]}
                saved={savedArticles.includes(article.id)}
                onOpen={openArticle}
                onSummarize={summarizeArticle}
                onToggleSaved={toggleSaved}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
