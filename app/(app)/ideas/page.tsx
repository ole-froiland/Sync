'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUp, Compass, MessageSquareQuote, Plus, Sparkles } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useUser } from '@/context/UserContext'

type IdeaStatus = 'under-review' | 'planned' | 'in-progress' | 'shipped'
type IdeaTag = 'ux' | 'chat' | 'calendar' | 'mobile' | 'integrations'

type Idea = {
  id: string
  title: string
  summary: string
  detail: string
  status: IdeaStatus
  tag: IdeaTag
  votes: number
  author: string
}

const STORAGE_KEY = 'sync-ideas-board'
const VOTE_KEY = 'sync-idea-votes'

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
  },
]

const statusOrder: IdeaStatus[] = ['under-review', 'planned', 'in-progress', 'shipped']

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

export default function IdeasPage() {
  const profile = useUser()
  const [ideas, setIdeas] = useState<Idea[]>(seedIdeas)
  const [activeStatus, setActiveStatus] = useState<IdeaStatus | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string>(seedIdeas[0].id)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftSummary, setDraftSummary] = useState('')
  const [draftTag, setDraftTag] = useState<IdeaTag>('ux')
  const [votes, setVotes] = useState<string[]>([])

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const rawIdeas = window.localStorage.getItem(STORAGE_KEY)
        const rawVotes = window.localStorage.getItem(VOTE_KEY)
        if (rawIdeas) {
          const parsed = JSON.parse(rawIdeas) as Idea[]
          if (Array.isArray(parsed) && parsed.length > 0) setIdeas(parsed)
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
    const list = activeStatus === 'all' ? ideas : ideas.filter((idea) => idea.status === activeStatus)
    return [...list].sort((a, b) => b.votes - a.votes)
  }, [activeStatus, ideas])

  const selectedIdea = useMemo(
    () => filteredIdeas.find((idea) => idea.id === selectedId) ?? filteredIdeas[0] ?? null,
    [filteredIdeas, selectedId]
  )

  function toggleVote(id: string) {
    const hasVoted = votes.includes(id)
    setVotes((prev) => (hasVoted ? prev.filter((value) => value !== id) : [...prev, id]))
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.id === id ? { ...idea, votes: Math.max(0, idea.votes + (hasVoted ? -1 : 1)) } : idea
      )
    )
  }

  function submitIdea() {
    if (!draftTitle.trim() || !draftSummary.trim()) return
    const nextIdea: Idea = {
      id: `idea-${Date.now()}`,
      title: draftTitle.trim(),
      summary: draftSummary.trim(),
      detail: draftSummary.trim(),
      status: 'under-review',
      tag: draftTag,
      votes: 1,
      author: profile?.first_name ?? profile?.name ?? 'You',
    }
    setIdeas((prev) => [nextIdea, ...prev])
    setVotes((prev) => [...prev, nextIdea.id])
    setSelectedId(nextIdea.id)
    setDraftTitle('')
    setDraftSummary('')
  }

  return (
    <>
      <TopBar
        title="Ideas"
        actions={
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
              {ideas.length} tracked
            </Badge>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
                  <Plus size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pitch an improvement</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Collect friction, fixes and bigger product bets.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="Title your idea"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none ring-0 transition focus:border-purple-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900"
                />
                <textarea
                  value={draftSummary}
                  onChange={(event) => setDraftSummary(event.target.value)}
                  placeholder="What should improve, and why is it worth building?"
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900"
                />
                <div className="flex items-center justify-between gap-3">
                  <select
                    value={draftTag}
                    onChange={(event) => setDraftTag(event.target.value as IdeaTag)}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="ux">UX</option>
                    <option value="chat">Chat</option>
                    <option value="calendar">Calendar</option>
                    <option value="mobile">Mobile</option>
                    <option value="integrations">Integrations</option>
                  </select>
                  <Button size="sm" onClick={submitIdea}>
                    Submit
                  </Button>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2">
                <Compass size={16} className="text-gray-400 dark:text-gray-500" />
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Browse</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveStatus('all')}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${activeStatus === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
                >
                  All
                </button>
                {statusOrder.map((status) => (
                  <button
                    key={status}
                    onClick={() => setActiveStatus(status)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${activeStatus === status ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
                  >
                    {statusLabel(status)}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                    Suggestion feed
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    Vote on what ships next
                  </h2>
                </div>
                <Sparkles size={18} className="text-purple-500" />
              </div>

              <div className="mt-5 space-y-3">
                {filteredIdeas.map((idea) => {
                  const voted = votes.includes(idea.id)
                  const selected = selectedIdea?.id === idea.id
                  return (
                    <button
                      key={idea.id}
                      onClick={() => setSelectedId(idea.id)}
                      className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition ${
                        selected
                          ? 'border-purple-300 bg-purple-50/70 dark:border-purple-800 dark:bg-purple-950/20'
                          : 'border-gray-100 hover:border-gray-200 dark:border-gray-800 dark:hover:border-gray-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleVote(idea.id)
                        }}
                        className={`mt-0.5 flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-2xl border text-xs font-semibold ${
                          voted
                            ? 'border-purple-300 bg-purple-600 text-white dark:border-purple-700'
                            : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                        }`}
                      >
                        <ArrowUp size={13} />
                        {idea.votes}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{idea.title}</p>
                          <Badge className={statusClass(idea.status)}>{statusLabel(idea.status)}</Badge>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                          {idea.summary}
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                          <span>{idea.tag}</span>
                          <span>•</span>
                          <span>{idea.author}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </Card>

            <Card>
              {selectedIdea ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                        Selected idea
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {selectedIdea.title}
                      </h3>
                    </div>
                    <Badge className={statusClass(selectedIdea.status)}>{statusLabel(selectedIdea.status)}</Badge>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {selectedIdea.detail}
                  </p>

                  <div className="mt-6 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/70">
                    <div className="flex items-center gap-2">
                      <MessageSquareQuote size={16} className="text-gray-400 dark:text-gray-500" />
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Decision lens</p>
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                      <li>How often does this pain show up in the current flow?</li>
                      <li>Does it sharpen focus, speed or trust?</li>
                      <li>Can we ship a small first slice instead of the whole thing?</li>
                    </ul>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No ideas match this filter.</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
