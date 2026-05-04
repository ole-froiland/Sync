'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Newspaper,
  Plus,
  Radio,
  Sparkles,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import type { FeedItem } from '@/types'

// ─── Local types ──────────────────────────────────────────────────────────────

type SummaryMode = 'short' | 'medium' | 'long'

type Article = {
  id: string
  title: string
  url: string
  source: string
  time: string
  by: string | null
  description: string | null
  imageUrl: string | null
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

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCES = [
  'All',
  'Hacker News',
  'TechCrunch',
  'The Verge',
  'Wired',
  'Ars Technica',
  'MIT Tech Review',
  'VentureBeat',
  'The Decoder',
  'OpenAI',
  'Anthropic',
  'DeepMind',
  'Microsoft AI',
  'GitHub',
  'Vercel',
  'Supabase',
]

const SUMMARY_OPTIONS: { value: SummaryMode; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeSince(unixSeconds: number): string {
  if (!unixSeconds) return ''
  const diff = Math.max(0, Date.now() / 1000 - unixSeconds)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function toArticle(item: FeedItem): Article {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    source: item.source,
    time: timeSince(item.publishedAt),
    by: item.author,
    description: item.description,
    imageUrl: item.imageUrl,
  }
}

// Effective image for an article:
//   RSS image → use immediately (no fetch needed)
//   no RSS image, og-image fetched → use result (string | null)
//   no RSS image, og-image pending → undefined (show skeleton)
function getImage(
  article: Article,
  ogImages: Record<string, string | null>
): string | null | undefined {
  if (article.imageUrl !== null) return article.imageUrl
  if (article.id in ogImages) return ogImages[article.id]
  return undefined
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DiscoverViewProps {
  news: FeedItem[]
  newsLoading: boolean
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────

interface ThumbnailProps {
  imageUrl: string | null | undefined
  className?: string
  iconSize?: number
}

function Thumbnail({ imageUrl, className, iconSize = 32 }: ThumbnailProps) {
  // Track which URL failed so the check is a simple comparison, not a useEffect
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const failed = typeof imageUrl === 'string' && imageUrl === failedUrl

  if (imageUrl === undefined) {
    return <Skeleton className={cn('rounded-none', className)} />
  }

  if (imageUrl === null || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-gray-100 dark:bg-gray-900', className)}>
        <Newspaper size={iconSize} className="text-gray-300 dark:text-gray-700" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      className={cn('object-cover', className)}
      onError={() => setFailedUrl(imageUrl)}
    />
  )
}

// ─── Source filter ────────────────────────────────────────────────────────────

interface SourceFilterProps {
  activeSources: string[]
  onChange: (sources: string[]) => void
}

function SourceFilter({ activeSources, onChange }: SourceFilterProps) {
  function toggleSource(source: string) {
    if (source === 'All') {
      onChange(['All'])
      return
    }
    const selected = activeSources.includes('All')
      ? [source]
      : activeSources.includes(source)
        ? activeSources.filter((s) => s !== source)
        : [...activeSources, source]
    onChange(selected.length > 0 ? selected : ['All'])
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {SOURCES.map((source) => {
        const active = activeSources.includes(source)
        return (
          <button
            key={source}
            type="button"
            aria-pressed={active}
            onClick={() => toggleSource(source)}
            className={cn(
              'h-8 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors',
              active
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-900'
            )}
          >
            {source}
          </button>
        )
      })}
      <button
        type="button"
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-gray-300 bg-white px-3 text-sm font-medium text-gray-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400"
      >
        <Plus size={13} />
        Add
      </button>
    </div>
  )
}

// ─── Summary mode control ─────────────────────────────────────────────────────

interface SummarizeControlProps {
  value: SummaryMode
  onChange: (value: SummaryMode) => void
}

function SummarizeControl({ value, onChange }: SummarizeControlProps) {
  return (
    <div className="inline-flex rounded-full border border-gray-200 bg-white p-0.5 dark:border-gray-800 dark:bg-gray-950">
      {SUMMARY_OPTIONS.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'h-7 min-w-14 rounded-full px-3 text-xs font-medium transition-colors',
              active
                ? 'bg-indigo-600 text-white'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Hero article ─────────────────────────────────────────────────────────────

interface HeroArticleProps {
  article: Article
  imageUrl: string | null | undefined
  summary: SummaryState | undefined
  saved: boolean
  podcastLoading: boolean
  onOpen: (article: Article) => void
  onSummarize: (article: Article) => void
  onPodcast: () => void
  onToggleSaved: (id: string) => void
}

function HeroArticle({
  article,
  imageUrl,
  summary,
  saved,
  podcastLoading,
  onOpen,
  onSummarize,
  onPodcast,
  onToggleSaved,
}: HeroArticleProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      {/* Full-width image — text is NOT overlaid */}
      <button
        type="button"
        className="block w-full cursor-pointer overflow-hidden"
        onClick={() => onOpen(article)}
        aria-label={`Read: ${article.title}`}
      >
        <Thumbnail imageUrl={imageUrl} className="h-64 w-full sm:h-80" iconSize={40} />
      </button>

      {/* Text content below image */}
      <div className="px-5 pt-4 pb-3">
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">{article.source}</span>
          {article.by && (
            <>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span>{article.by}</span>
            </>
          )}
          {article.time && (
            <>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span>{article.time}</span>
            </>
          )}
        </div>
        <button type="button" className="text-left" onClick={() => onOpen(article)}>
          <h2 className="text-xl font-bold leading-snug text-gray-900 hover:text-indigo-700 dark:text-gray-100 dark:hover:text-indigo-300 sm:text-2xl">
            {article.title}
          </h2>
        </button>
        {article.description && !summary?.text && !summary?.loading && (
          <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-2">
            {article.description}
          </p>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
        <button
          type="button"
          onClick={() => onOpen(article)}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <ExternalLink size={14} />
          Read
        </button>
        <button
          type="button"
          onClick={() => onSummarize(article)}
          disabled={summary?.loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900"
        >
          {summary?.loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Summarize
        </button>
        <button
          type="button"
          onClick={onPodcast}
          disabled={podcastLoading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900"
        >
          {podcastLoading ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
          Podcast
        </button>
        <button
          type="button"
          onClick={() => onToggleSaved(article.id)}
          className={cn(
            'ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
            saved
              ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300'
              : 'border-gray-200 text-gray-400 hover:text-gray-700 dark:border-gray-800 dark:hover:text-gray-200'
          )}
          aria-label={saved ? 'Remove bookmark' : 'Save article'}
        >
          {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        </button>
      </div>

      {/* Inline summary */}
      {(summary?.text || summary?.error) && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 dark:border-gray-800 dark:bg-gray-900/40">
          {summary.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{summary.error}</p>
          ) : (
            <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">{summary.text}</p>
          )}
        </div>
      )}
    </article>
  )
}

// ─── Featured card (2-col grid) ───────────────────────────────────────────────

interface FeaturedCardProps {
  article: Article
  imageUrl: string | null | undefined
  summary: SummaryState | undefined
  saved: boolean
  onOpen: (article: Article) => void
  onSummarize: (article: Article) => void
  onToggleSaved: (id: string) => void
}

function FeaturedCard({
  article,
  imageUrl,
  summary,
  saved,
  onOpen,
  onSummarize,
  onToggleSaved,
}: FeaturedCardProps) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-950">
      <button
        type="button"
        className="block w-full cursor-pointer overflow-hidden"
        onClick={() => onOpen(article)}
        aria-label={`Read: ${article.title}`}
      >
        <Thumbnail imageUrl={imageUrl} className="h-40 w-full" iconSize={24} />
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="font-medium text-indigo-600 dark:text-indigo-400">{article.source}</span>
          {article.time && (
            <>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span className="text-gray-400 dark:text-gray-500">{article.time}</span>
            </>
          )}
        </div>

        <button type="button" className="flex-1 text-left" onClick={() => onOpen(article)}>
          <h3 className="line-clamp-3 text-sm font-semibold leading-5 text-gray-900 transition-colors group-hover:text-indigo-700 dark:text-gray-100 dark:group-hover:text-indigo-300">
            {article.title}
          </h3>
        </button>

        {summary?.loading && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 size={12} className="animate-spin" /> Summarizing…
          </p>
        )}
        {summary?.error && (
          <p className="mt-3 text-xs text-red-500 dark:text-red-400">{summary.error}</p>
        )}
        {summary?.text && (
          <p className="mt-3 line-clamp-3 border-l-2 border-indigo-200 pl-2.5 text-xs leading-5 text-gray-600 dark:border-indigo-800 dark:text-gray-400">
            {summary.text}
          </p>
        )}

        <div className="mt-4 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSummarize(article)}
            disabled={summary?.loading}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-indigo-700 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-indigo-300"
          >
            <Sparkles size={12} />
            Summarize
          </button>
          <button
            type="button"
            onClick={() => onToggleSaved(article.id)}
            className={cn(
              'ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              saved
                ? 'text-indigo-600 dark:text-indigo-300'
                : 'text-gray-300 hover:text-gray-600 dark:text-gray-700 dark:hover:text-gray-300'
            )}
            aria-label={saved ? 'Remove bookmark' : 'Save'}
          >
            {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          </button>
        </div>
      </div>
    </article>
  )
}

// ─── Compact list row ─────────────────────────────────────────────────────────

interface ArticleRowProps {
  article: Article
  summary: SummaryState | undefined
  saved: boolean
  onOpen: (article: Article) => void
  onSummarize: (article: Article) => void
  onToggleSaved: (id: string) => void
}

function ArticleRow({ article, summary, saved, onOpen, onSummarize, onToggleSaved }: ArticleRowProps) {
  return (
    <article className="group flex cursor-pointer items-start gap-4 border-b border-gray-100 py-4 last:border-b-0 transition-colors hover:bg-gray-50/60 dark:border-gray-900 dark:hover:bg-gray-900/30">
      <div className="min-w-0 flex-1" onClick={() => onOpen(article)}>
        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-gray-900 transition-colors group-hover:text-indigo-700 dark:text-gray-100 dark:group-hover:text-indigo-300">
          {article.title}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="font-medium text-indigo-500 dark:text-indigo-400">{article.source}</span>
          {article.time && (
            <>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span className="text-gray-400 dark:text-gray-500">{article.time}</span>
            </>
          )}
        </div>
        {summary?.loading && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 size={11} className="animate-spin" /> Summarizing…
          </p>
        )}
        {summary?.error && (
          <p className="mt-2 text-xs text-red-500 dark:text-red-400">{summary.error}</p>
        )}
        {summary?.text && (
          <p className="mt-2 border-l-2 border-indigo-200 pl-2.5 text-xs leading-5 text-gray-600 dark:border-indigo-800 dark:text-gray-400">
            {summary.text}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onSummarize(article)}
          disabled={summary?.loading}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-white hover:text-indigo-700 disabled:opacity-30 dark:hover:bg-gray-950 dark:hover:text-indigo-300"
          aria-label="Summarize"
        >
          <Sparkles size={13} />
          <span className="hidden sm:inline">Summarize</span>
        </button>
        <button
          type="button"
          onClick={() => onToggleSaved(article.id)}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            saved
              ? 'text-indigo-600 dark:text-indigo-300'
              : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-600 dark:text-gray-700 dark:hover:text-gray-300'
          )}
          aria-label={saved ? 'Remove bookmark' : 'Save'}
        >
          {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        </button>
      </div>
    </article>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        <Skeleton className="h-64 w-full rounded-none sm:h-80" />
        <div className="space-y-2 px-5 pt-4 pb-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>
        <div className="flex gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="ml-auto h-9 w-9 rounded-lg" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <Skeleton className="h-40 w-full rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white px-4 dark:border-gray-800 dark:bg-gray-950">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-4 border-b border-gray-100 py-4 last:border-b-0 dark:border-gray-900">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function DiscoverView({ news, newsLoading }: DiscoverViewProps) {
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('short')
  const [activeSources, setActiveSources] = useState<string[]>(['All'])
  const [summaries, setSummaries] = useState<Record<string, SummaryState>>({})
  const [savedArticles, setSavedArticles] = useState<string[]>([])
  const [podcast, setPodcast] = useState<PodcastState>({ status: 'idle', message: null, audioUrl: null })
  // og-image fallback: only fetched for articles without an RSS image
  const [ogImages, setOgImages] = useState<Record<string, string | null>>({})
  const processedRef = useRef<Set<string>>(new Set())

  const articles = useMemo(() => news.map(toArticle), [news])

  const visibleArticles = useMemo(() => {
    if (activeSources.includes('All')) return articles
    return articles.filter((a) => activeSources.includes(a.source))
  }, [activeSources, articles])

  const [heroArticle, secondArticle, thirdArticle, ...listArticles] = visibleArticles
  const featuredArticles = [secondArticle, thirdArticle].filter(Boolean)

  // Fetch og:image only for articles that have no image from the RSS feed
  useEffect(() => {
    let cancelled = false

    for (const article of visibleArticles) {
      if (article.imageUrl !== null) continue // already has RSS image
      if (processedRef.current.has(article.id)) continue
      processedRef.current.add(article.id)

      fetch(`/api/og-image?url=${encodeURIComponent(article.url)}`)
        .then((r) => r.json() as Promise<{ imageUrl: string | null }>)
        .then((data) => {
          if (!cancelled) setOgImages((c) => ({ ...c, [article.id]: data.imageUrl }))
        })
        .catch(() => {
          if (!cancelled) setOgImages((c) => ({ ...c, [article.id]: null }))
        })
    }

    return () => {
      cancelled = true
    }
  }, [visibleArticles])

  async function summarizeArticle(article: Article) {
    setSummaries((c) => ({ ...c, [article.id]: { loading: true, text: null, error: null } }))
    try {
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: summaryMode,
          article: {
            title: article.title,
            source: article.source,
            preview: article.description ?? '',
            url: article.url,
          },
        }),
      })
      const data = (await response.json()) as { summary?: string; error?: string }
      if (!response.ok || !data.summary) throw new Error(data.error ?? 'Summary unavailable')
      setSummaries((c) => ({ ...c, [article.id]: { loading: false, text: data.summary ?? null, error: null } }))
    } catch {
      setSummaries((c) => ({ ...c, [article.id]: { loading: false, text: null, error: 'Could not summarize this article.' } }))
    }
  }

  async function makePodcast() {
    if (visibleArticles.length === 0) return
    setPodcast({ status: 'loading', message: 'Preparing podcast…', audioUrl: null })
    try {
      const selected = savedArticles.length
        ? visibleArticles.filter((a) => savedArticles.includes(a.id))
        : visibleArticles
      const sourceArticles = selected.length > 0 ? selected : visibleArticles
      const response = await fetch('/api/podcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles: sourceArticles.map((a) => ({
            title: a.title,
            source: a.source,
            preview: a.description ?? '',
            url: a.url,
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
      setPodcast({ status: 'error', message: 'Could not start podcast generation.', audioUrl: null })
    }
  }

  function openArticle(article: Article) {
    window.open(article.url, '_blank', 'noopener,noreferrer')
  }

  function toggleSaved(id: string) {
    setSavedArticles((c) => (c.includes(id) ? c.filter((i) => i !== id) : [...c, id]))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Discover</h1>
          <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">
            Your AI-powered tech briefing
          </p>
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <span className="hidden text-sm font-medium text-gray-500 dark:text-gray-400 sm:inline">
            Summary
          </span>
          <SummarizeControl value={summaryMode} onChange={setSummaryMode} />
        </div>
      </div>

      {/* Source filter */}
      <SourceFilter activeSources={activeSources} onChange={setActiveSources} />

      {/* Podcast banner */}
      {podcast.status !== 'idle' && (
        <div
          className={cn(
            'mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm',
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
            <a href={podcast.audioUrl} target="_blank" rel="noopener noreferrer" className="ml-auto font-medium underline">
              Open audio
            </a>
          )}
        </div>
      )}

      {/* Content */}
      <div className="mt-6">
        {newsLoading ? (
          <LoadingSkeleton />
        ) : visibleArticles.length === 0 ? (
          <div className="py-20 text-center">
            <Newspaper size={24} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No articles found</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Try All sources or refresh the feed.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Hero */}
            {heroArticle && (
              <HeroArticle
                article={heroArticle}
                imageUrl={getImage(heroArticle, ogImages)}
                summary={summaries[heroArticle.id]}
                saved={savedArticles.includes(heroArticle.id)}
                podcastLoading={podcast.status === 'loading'}
                onOpen={openArticle}
                onSummarize={summarizeArticle}
                onPodcast={makePodcast}
                onToggleSaved={toggleSaved}
              />
            )}

            {/* Featured 2-col grid */}
            {featuredArticles.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {featuredArticles.map((article) => (
                  <FeaturedCard
                    key={article.id}
                    article={article}
                    imageUrl={getImage(article, ogImages)}
                    summary={summaries[article.id]}
                    saved={savedArticles.includes(article.id)}
                    onOpen={openArticle}
                    onSummarize={summarizeArticle}
                    onToggleSaved={toggleSaved}
                  />
                ))}
              </div>
            )}

            {/* More stories */}
            {listArticles.length > 0 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                    More stories
                  </span>
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-100 bg-white px-4 dark:border-gray-800 dark:bg-gray-950">
                  {listArticles.map((article) => (
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
