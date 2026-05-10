'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock3, Plus, Sparkles } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useUser } from '@/context/UserContext'

type CalendarEvent = {
  id: string
  title: string
  start: string
  end: string
  tone: 'violet' | 'emerald' | 'amber' | 'sky'
  kind: 'focus' | 'meeting' | 'launch' | 'deadline'
  note?: string
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const STORAGE_KEY = 'sync-calendar-events'

const seedEvents: CalendarEvent[] = [
  {
    id: 'cal-1',
    title: 'Sprint planning',
    start: '2026-05-12T09:00:00',
    end: '2026-05-12T10:00:00',
    tone: 'violet',
    kind: 'meeting',
    note: 'Scope dashboard polish and chat follow-ups.',
  },
  {
    id: 'cal-2',
    title: 'Ship unread badge',
    start: '2026-05-13T14:00:00',
    end: '2026-05-13T15:00:00',
    tone: 'emerald',
    kind: 'launch',
    note: 'Deploy and verify notification state.',
  },
  {
    id: 'cal-3',
    title: 'Deep work: calendar UX',
    start: '2026-05-15T10:00:00',
    end: '2026-05-15T12:30:00',
    tone: 'sky',
    kind: 'focus',
  },
  {
    id: 'cal-4',
    title: 'Feedback review',
    start: '2026-05-19T13:00:00',
    end: '2026-05-19T14:00:00',
    tone: 'amber',
    kind: 'deadline',
    note: 'Sort roadmap ideas and mark next wins.',
  },
]

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function formatTimeRange(start: string, end: string) {
  return `${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(start))} - ${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(end))}`
}

function toneClasses(tone: CalendarEvent['tone']) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900'
    case 'amber':
      return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900'
    case 'sky':
      return 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900'
    default:
      return 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-900'
  }
}

export default function CalendarPage() {
  const profile = useUser()
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>(seedEvents)

  useEffect(() => {
    queueMicrotask(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      try {
        const parsed = JSON.parse(raw) as CalendarEvent[]
        if (Array.isArray(parsed) && parsed.length > 0) setEvents(parsed)
      } catch {
        // ignore invalid stored value
      }
    })
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  }, [events])

  const eventMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const key = new Date(event.start).toDateString()
      const list = map.get(key) ?? []
      list.push(event)
      list.sort((a, b) => +new Date(a.start) - +new Date(b.start))
      map.set(key, list)
    }
    return map
  }, [events])

  const visibleDays = useMemo(() => {
    const first = startOfMonth(currentMonth)
    const firstWeekday = (first.getDay() + 6) % 7
    const gridStart = new Date(first)
    gridStart.setDate(first.getDate() - firstWeekday)

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + index)
      return date
    })
  }, [currentMonth])

  const monthEvents = useMemo(
    () =>
      events.filter((event) => monthKey(new Date(event.start)) === monthKey(currentMonth)),
    [currentMonth, events]
  )

  const upcoming = useMemo(
    () =>
      [...events]
        .sort((a, b) => +new Date(a.start) - +new Date(b.start))
        .slice(0, 6),
    [events]
  )

  function shiftMonth(offset: number) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1))
  }

  function addQuickEvent() {
    const base = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 18, 11, 0, 0)
    const newEvent: CalendarEvent = {
      id: `cal-${Date.now()}`,
      title: `${profile?.first_name ?? profile?.name ?? 'Team'} review block`,
      start: base.toISOString(),
      end: new Date(base.getTime() + 60 * 60 * 1000).toISOString(),
      tone: 'violet',
      kind: 'meeting',
      note: 'Quick placeholder event. Replace later with real calendar data.',
    }
    setEvents((prev) => [...prev, newEvent].sort((a, b) => +new Date(a.start) - +new Date(b.start)))
  }

  return (
    <>
      <TopBar
        title="Calendar"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>
              Today
            </Button>
            <Button size="sm" onClick={addQuickEvent}>
              <Plus size={14} />
              Add block
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                  Schedule
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(currentMonth)}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => shiftMonth(-1)}>
                  <ChevronLeft size={14} />
                </Button>
                <Button size="sm" variant="secondary" onClick={() => shiftMonth(1)}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {visibleDays.map((day) => {
                const key = day.toDateString()
                const dayEvents = eventMap.get(key) ?? []
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
                const isToday = day.toDateString() === new Date().toDateString()
                return (
                  <div
                    key={key}
                    className={`min-h-28 rounded-2xl border p-3 text-left ${
                      isCurrentMonth
                        ? 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
                        : 'border-transparent bg-gray-50/70 dark:bg-gray-900/30'
                    } ${isToday ? 'ring-1 ring-purple-400/70' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-medium ${
                          isCurrentMonth
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-400 dark:text-gray-600'
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className={`rounded-xl px-2.5 py-1.5 text-[11px] ring-1 ${toneClasses(event.tone)}`}
                        >
                          <p className="truncate font-semibold">{event.title}</p>
                          <p className="mt-0.5 truncate opacity-80">
                            {new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(event.start))}
                          </p>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="px-1 text-[11px] text-gray-400 dark:text-gray-500">
                          +{dayEvents.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
                  <Sparkles size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Calendar pulse</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {monthEvents.length} blocks in this month
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-800/70">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Focus</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {monthEvents.filter((event) => event.kind === 'focus').length}
                  </p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-800/70">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Meetings</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {monthEvents.filter((event) => event.kind === 'meeting').length}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upcoming</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Outlook-style agenda, compact and fast.</p>
                </div>
                <Clock3 size={16} className="text-gray-400 dark:text-gray-500" />
              </div>
              <div className="mt-4 space-y-3">
                {upcoming.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {event.title}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {new Intl.DateTimeFormat('en', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          }).format(new Date(event.start))}
                        </p>
                      </div>
                      <Badge className={toneClasses(event.tone)}>{event.kind}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                      {formatTimeRange(event.start, event.end)}
                    </p>
                    {event.note && (
                      <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        {event.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
