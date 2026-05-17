'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Search, Send, X } from 'lucide-react'
import Image from 'next/image'
import TopBar from '@/components/layout/TopBar'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useUser } from '@/context/UserContext'

type IdeaStatus = 'under-review' | 'planned' | 'in-progress' | 'shipped'
type IdeaTag = 'ux' | 'chat' | 'calendar' | 'mobile' | 'integrations'
type TimeFilter = 'today' | 'week' | 'month' | 'custom'

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
  imageUrl?: string | null
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
  { id: 'custom', label: 'Customize' },
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

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromKey(key: string) {
  return new Date(`${key}T00:00:00`)
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date)
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7))

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function matchesTimeFilter(idea: Idea, filter: TimeFilter, customFrom: string, customTo: string) {
  const createdAt = new Date(idea.createdAt).getTime()
  const now = Date.now()
  const age = now - createdAt
  const day = 24 * 60 * 60 * 1000

  if (Number.isNaN(createdAt)) return true
  if (filter === 'today') return age <= day
  if (filter === 'week') return age <= 7 * day
  if (filter === 'month') return age <= 31 * day

  const from = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY
  const to = customTo ? new Date(`${customTo}T23:59:59`).getTime() : Number.POSITIVE_INFINITY
  return createdAt >= from && createdAt <= to
}

function ideaMatchesQuery(idea: Idea, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  return [idea.title, idea.summary, idea.detail, idea.author, idea.tag, statusLabel(idea.status)]
    .join(' ')
    .toLowerCase()
    .includes(needle)
}

function activeTimeLabel(filter: TimeFilter, customFrom: string, customTo: string) {
  if (filter !== 'custom') return timeFilters.find((item) => item.id === filter)?.label ?? 'Today'
  if (customFrom && customTo && customFrom !== customTo) return `${customFrom.slice(5)} - ${customTo.slice(5)}`
  if (customFrom) return customFrom.slice(5)
  return 'Customize'
}

function isBetween(value: string, start: string, end: string) {
  const time = dateFromKey(value).getTime()
  const startTime = dateFromKey(start).getTime()
  const endTime = dateFromKey(end).getTime()
  return time >= Math.min(startTime, endTime) && time <= Math.max(startTime, endTime)
}

export default function IdeasPage() {
  const profile = useUser()
  const [ideas, setIdeas] = useState<Idea[]>(seedIdeas)
  const [activeTime, setActiveTime] = useState<TimeFilter>('today')
  const [query, setQuery] = useState('')
  const [draftImage, setDraftImage] = useState<string | null>(null)
  const [customFrom, setCustomFrom] = useState(todayInputValue())
  const [customTo, setCustomTo] = useState(todayInputValue())
  const [votes, setVotes] = useState<string[]>([])
  const [storageLoaded, setStorageLoaded] = useState(false)
  const [timeMenuOpen, setTimeMenuOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const rawIdeas = window.localStorage.getItem(STORAGE_KEY)
        const rawVotes = window.localStorage.getItem(VOTE_KEY)
        if (rawIdeas) {
          const parsed = JSON.parse(rawIdeas) as Idea[]
          if (Array.isArray(parsed)) {
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
      } finally {
        setStorageLoaded(true)
      }
    })
  }, [])

  useEffect(() => {
    if (!storageLoaded) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas))
    } catch {
      // ignore storage quota errors
    }
  }, [ideas, storageLoaded])

  useEffect(() => {
    if (!storageLoaded) return
    try {
      window.localStorage.setItem(VOTE_KEY, JSON.stringify(votes))
    } catch {
      // ignore storage quota errors
    }
  }, [storageLoaded, votes])

  const filteredIdeas = useMemo(() => {
    return ideas
      .filter((idea) => matchesTimeFilter(idea, activeTime, customFrom, customTo))
      .filter((idea) => ideaMatchesQuery(idea, query))
      .sort((a, b) => b.votes - a.votes || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [activeTime, customFrom, customTo, ideas, query])

  function toggleVote(id: string) {
    const hasVoted = votes.includes(id)
    setVotes((prev) => (hasVoted ? prev.filter((value) => value !== id) : [...prev, id]))
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.id === id ? { ...idea, votes: Math.max(0, idea.votes + (hasVoted ? -1 : 1)) } : idea
      )
    )
  }

  function attachImage(file: File) {
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setDraftImage(reader.result)
    }
    reader.readAsDataURL(file)
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'))
    const file = imageItem?.getAsFile()
    if (file) attachImage(file)
  }

  function submitIdea(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = query.trim()
    if (!value && !draftImage) return

    const nextIdea: Idea = {
      id: `idea-${Date.now()}`,
      title: value || 'Image idea',
      summary: draftImage ? 'Image attached from the feed composer.' : 'New idea from the feed composer.',
      detail: value,
      status: 'under-review',
      tag: 'ux',
      votes: 1,
      author: profile?.first_name ?? profile?.name ?? 'You',
      createdAt: new Date().toISOString(),
      imageUrl: draftImage,
    }

    setIdeas((prev) => [nextIdea, ...prev])
    setVotes((prev) => [...prev, nextIdea.id])
    setActiveTime('today')
    setQuery('')
    setDraftImage(null)
  }

  function choosePreset(filter: TimeFilter) {
    setActiveTime(filter)
    if (filter !== 'custom') {
      setTimeMenuOpen(false)
      setRangeAnchor(null)
      setHoverDate(null)
      return
    }

    setTimeMenuOpen(true)
    setRangeAnchor(null)
    setHoverDate(null)
  }

  function chooseCalendarDate(key: string) {
    setActiveTime('custom')

    if (!rangeAnchor || (customFrom && customTo && !hoverDate)) {
      setCustomFrom(key)
      setCustomTo('')
      setRangeAnchor(key)
      setHoverDate(null)
      return
    }

    const start = dateFromKey(rangeAnchor).getTime() <= dateFromKey(key).getTime() ? rangeAnchor : key
    const end = start === rangeAnchor ? key : rangeAnchor
    setCustomFrom(start)
    setCustomTo(end)
    setRangeAnchor(null)
    setHoverDate(null)
    setTimeMenuOpen(false)
  }

  function calendarDayClass(day: Date) {
    const key = dateKey(day)
    const inCurrentMonth = day.getMonth() === calendarMonth.getMonth()
    const isSelectedStart = customFrom === key
    const isSelectedEnd = customTo === key
    const isHoveredRange = rangeAnchor && hoverDate ? isBetween(key, rangeAnchor, hoverDate) : false
    const isSelectedRange = customFrom && customTo ? isBetween(key, customFrom, customTo) : false

    if (isSelectedStart || isSelectedEnd) return 'bg-purple-600 text-white shadow-sm shadow-purple-500/30'
    if (isHoveredRange || isSelectedRange) return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200'
    if (!inCurrentMonth) return 'text-gray-300 hover:bg-gray-50 dark:text-gray-700 dark:hover:bg-gray-800'
    return 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
  }

  return (
    <>
      <TopBar title="Ideas" />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <main className="mx-auto max-w-4xl">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <form onSubmit={submitIdea} className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative flex-1">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onPaste={handlePaste}
                    placeholder="Search or write a new idea..."
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-950"
                  />
                </label>
                <Button type="submit" className="h-12 shrink-0 gap-2" disabled={!query.trim() && !draftImage}>
                  <Send size={16} />
                  Post
                </Button>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setTimeMenuOpen((open) => !open)}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700 outline-none transition hover:bg-gray-100 focus:border-purple-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:w-36"
                  >
                    <span className="truncate">{activeTimeLabel(activeTime, customFrom, customTo)}</span>
                    <ChevronDown size={15} />
                  </button>

                  {timeMenuOpen && (
                    <div className="absolute right-0 top-14 z-20 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                      <div className="grid gap-1">
                        {timeFilters.map((filter) => (
                          <button
                            key={filter.id}
                            type="button"
                            onClick={() => choosePreset(filter.id)}
                            className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                              activeTime === filter.id
                                ? 'bg-purple-600 text-white'
                                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
                            }`}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>

                      {activeTime === 'custom' && (
                        <div className="mt-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                          <div className="mb-2 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                              aria-label="Previous month"
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{monthTitle(calendarMonth)}</p>
                            <button
                              type="button"
                              onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                              aria-label="Next month"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-gray-400 dark:text-gray-500">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                              <span key={`${day}-${index}`} className="py-1">
                                {day}
                              </span>
                            ))}
                          </div>
                          <div className="mt-1 grid grid-cols-7 gap-1">
                            {calendarDays(calendarMonth).map((day) => {
                              const key = dateKey(day)
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => chooseCalendarDate(key)}
                                  onMouseEnter={() => {
                                    if (rangeAnchor) setHoverDate(key)
                                  }}
                                  className={`h-8 rounded-lg text-sm transition ${calendarDayClass(day)}`}
                                >
                                  {day.getDate()}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {draftImage && (
                <div className="relative w-fit overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
                  <div className="relative h-24 w-36 overflow-hidden rounded-lg">
                    <Image src={draftImage} alt="" fill sizes="144px" className="object-cover" unoptimized />
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftImage(null)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gray-950/70 text-white transition hover:bg-gray-950"
                    aria-label="Remove image"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </form>

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
                      {idea.imageUrl && (
                        <div className="relative mt-3 h-72 w-full overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                          <Image src={idea.imageUrl} alt="" fill sizes="(max-width: 896px) 100vw, 768px" className="object-cover" unoptimized />
                        </div>
                      )}
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
