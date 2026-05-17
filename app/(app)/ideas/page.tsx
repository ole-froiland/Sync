'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUp, Search, Send, Sparkles } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useUser } from '@/context/UserContext'

type IdeaStatus = 'under-review' | 'planned' | 'in-progress' | 'shipped'
type IdeaTag = 'ux' | 'chat' | 'calendar' | 'mobile' | 'integrations'
type TimeFilter = 'today' | 'week' | 'month'

type Idea = {
  id: string
  title: string
  summary: string
  detail: string
  status: IdeaStatus
  tag: IdeaTag
  votes: number
  author: string
  createdAt: string
}

const STORAGE_KEY = 'sync-ideas-board'
const VOTE_KEY = 'sync-idea-votes'

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

const seedIdeas: Idea[] = [
  {
    id: 'idea-1',
    title: 'Unread state per conversation',
    summary: 'Show who has replied since you last looked.',
    detail: 'Add a real unread model for direct messages and request threads so the sidebar feels alive instead of static.',
    status: 'in-progress',
    tag: 'chat',
    votes: 14,
    author: 'Ole',
    createdAt: daysAgo(0),
  },
  {
    id: 'idea-2',
    title: 'Calendar drag and resize',
    summary: 'Move planning blocks directly inside the month view.',
    detail: 'The current calendar is fast, but the next step is direct manipulation so planning feels closer to Outlook.',
    status: 'planned',
    tag: 'calendar',
    votes: 11,
    author: 'Elias',
    createdAt: daysAgo(2),
  },
  {
    id: 'idea-3',
    title: 'Mobile-first chat composer',
    summary: 'Reduce header height and make reply actions easier on small screens.',
    detail: 'The composer and sync actions should feel thumb-friendly and stay visible without chewing up the whole viewport.',
    status: 'under-review',
    tag: 'mobile',
    votes: 9,
    author: 'Sebastian',
    createdAt: daysAgo(9),
  },
  {
    id: 'idea-4',
    title: 'Connected account activity timeline',
    summary: 'Show GitHub, projects and social events in one stream.',
    detail: 'A compact timeline could turn the dashboard into a single place to see what actually changed across the workspace.',
    status: 'shipped',
    tag: 'integrations',
    votes: 18,
    author: 'Arvind',
    createdAt: daysAgo(18),
  },
]

const timeFilters: { id: TimeFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
]

function statusLabel(status: IdeaStatus) {
  switch (status) {
    case 'under-review':
      return 'Under review'
    case 'planned':
      return 'Planned'
    case 'in-progress':
      return 'In progress'
    default:
      return 'Shipped'
  }
}

function statusClass(status: IdeaStatus) {
  switch (status) {
    case 'planned':
      return 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
    case 'in-progress':
      return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
    case 'shipped':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    default:
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
  }
}

function matchesTimeFilter(idea: Idea, filter: TimeFilter) {
  const createdAt = new Date(idea.createdAt).getTime()
  const now = Date.now()
  const age = now - createdAt
  const day = 24 * 60 * 60 * 1000

  if (Number.isNaN(createdAt)) return true
  if (filter === 'today') return age <= day
  if (filter === 'week') return age <= 7 * day
  return age <= 31 * day
}

function ideaMatchesQuery(idea: Idea, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  return [idea.title, idea.summary, idea.detail, idea.author, idea.tag, statusLabel(idea.status)]
    .join(' ')
    .toLowerCase()
    .includes(needle)
}

export default function IdeasPage() {
  const profile = useUser()
  const [ideas, setIdeas] = useState<Idea[]>(seedIdeas)
  const [activeTime, setActiveTime] = useState<TimeFilter>('today')
  const [query, setQuery] = useState('')
  const [votes, setVotes] = useState<string[]>([])

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const rawIdeas = window.localStorage.getItem(STORAGE_KEY)
        const rawVotes = window.localStorage.getItem(VOTE_KEY)
        if (rawIdeas) {
          const parsed = JSON.parse(rawIdeas) as Idea[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            setIdeas(
              parsed.map((idea) => ({
                ...idea,
                createdAt: idea.createdAt ?? new Date().toISOString(),
              }))
            )
          }
        }
        if (rawVotes) {
          const parsed = JSON.parse(rawVotes) as string[]
          if (Array.isArray(parsed)) setVotes(parsed)
        }
      } catch {
        // ignore invalid local data
      }
    })
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas))
  }, [ideas])

  useEffect(() => {
    window.localStorage.setItem(VOTE_KEY, JSON.stringify(votes))
  }, [votes])

  const filteredIdeas = useMemo(() => {
    return ideas
      .filter((idea) => matchesTimeFilter(idea, activeTime))
      .filter((idea) => ideaMatchesQuery(idea, query))
      .sort((a, b) => b.votes - a.votes || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [activeTime, ideas, query])

  function toggleVote(id: string) {
    const hasVoted = votes.includes(id)
    setVotes((prev) => (hasVoted ? prev.filter((value) => value !== id) : [...prev, id]))
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.id === id ? { ...idea, votes: Math.max(0, idea.votes + (hasVoted ? -1 : 1)) } : idea
      )
    )
  }

  function submitIdea(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = query.trim()
    if (!value) return

    const nextIdea: Idea = {
      id: `idea-${Date.now()}`,
      title: value,
      summary: 'New idea from the feed composer.',
      detail: value,
      status: 'under-review',
      tag: 'ux',
      votes: 1,
      author: profile?.first_name ?? profile?.name ?? 'You',
      createdAt: new Date().toISOString(),
    }

    setIdeas((prev) => [nextIdea, ...prev])
    setVotes((prev) => [...prev, nextIdea.id])
    setActiveTime('today')
    setQuery('')
  }

  return (
    <>
      <TopBar title="Ideas" />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <main className="mx-auto max-w-4xl">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <form onSubmit={submitIdea} className="flex flex-col gap-3 sm:flex-row">
              <label className="relative flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search or write a new idea..."
                  className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-950"
                />
              </label>
              <Button type="submit" className="h-12 shrink-0 gap-2" disabled={!query.trim()}>
                <Send size={16} />
                Post
              </Button>
            </form>

            <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-500" />
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Suggestion feed</p>
                <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {filteredIdeas.length}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:inline-grid">
                {timeFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveTime(filter.id)}
                    className={`h-9 rounded-lg px-3 text-sm font-medium transition ${
                      activeTime === filter.id
                        ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-4 space-y-3">
            {filteredIdeas.length > 0 ? (
              filteredIdeas.map((idea) => {
                const voted = votes.includes(idea.id)
                return (
                  <article
                    key={idea.id}
                    className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                  >
                    <button
                      type="button"
                      onClick={() => toggleVote(idea.id)}
                      className={`mt-0.5 flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl border text-xs font-semibold transition ${
                        voted
                          ? 'border-purple-500 bg-purple-600 text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-purple-300 hover:text-purple-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-purple-700 dark:hover:text-purple-300'
                      }`}
                    >
                      <ArrowUp size={13} />
                      {idea.votes}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{idea.title}</h2>
                        <Badge className={statusClass(idea.status)}>{statusLabel(idea.status)}</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{idea.summary}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                        <span>{idea.tag}</span>
                        <span>•</span>
                        <span>{idea.author}</span>
                      </div>
                    </div>
                  </article>
                )
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm text-gray-500 dark:text-gray-400">No ideas match this view.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  )
}
