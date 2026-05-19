'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Search, Sparkles } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
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

type CalendarView = 'month' | 'week' | 'day'
type CalendarProvider = 'google' | 'apple' | 'microsoft'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const STORAGE_KEY = 'sync-calendar-events'
const HOUR_HEIGHT = 56

const calendarConnectors: Array<{ id: CalendarProvider; label: string; description: string }> = [
  { id: 'google', label: 'Google', description: 'OAuth + Calendar API' },
  { id: 'apple', label: 'Apple', description: 'CalDAV / iCloud' },
  { id: 'microsoft', label: 'Microsoft', description: 'Graph Calendar' },
]

const kindOptions: Array<{ kind: CalendarEvent['kind']; label: string; tone: CalendarEvent['tone'] }> = [
  { kind: 'meeting', label: 'Meeting', tone: 'violet' },
  { kind: 'focus', label: 'Focus', tone: 'sky' },
  { kind: 'launch', label: 'Launch', tone: 'emerald' },
  { kind: 'deadline', label: 'Deadline', tone: 'amber' },
]

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

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

function localDateTimeString(date: Date) {
  return `${dateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function dateWithTime(day: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours || 0, minutes || 0, 0)
}

function endTimeFor(startTime: string) {
  const end = dateWithTime(new Date(), startTime)
  end.setHours(end.getHours() + 1)
  return `${pad(end.getHours())}:${pad(end.getMinutes())}`
}

function isSameDay(a: Date, b: Date) {
  return dateKey(a) === dateKey(b)
}

function formatTimeRange(start: string, end: string) {
  return `${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(start))} - ${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(end))}`
}

function eventMatches(event: CalendarEvent, query: string) {
  const value = query.trim().toLowerCase()
  if (!value) return true
  return `${event.title} ${event.kind} ${event.note ?? ''}`.toLowerCase().includes(value)
}

function eventPosition(event: CalendarEvent) {
  const start = new Date(event.start)
  const end = new Date(event.end)
  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const durationMinutes = Math.max(30, Math.round((+end - +start) / 60000))
  return {
    top: (startMinutes / 60) * HOUR_HEIGHT,
    height: Math.max(28, (durationMinutes / 60) * HOUR_HEIGHT),
  }
}

function toneClasses(tone: CalendarEvent['tone'], active = false) {
  const highlight = active ? ' ring-2 ring-fuchsia-300 dark:ring-fuchsia-400' : ''
  switch (tone) {
    case 'emerald':
      return `bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900${highlight}`
    case 'amber':
      return `bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900${highlight}`
    case 'sky':
      return `bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900${highlight}`
    default:
      return `bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-900${highlight}`
  }
}

export default function CalendarPage() {
  const profile = useUser()
  const [viewDate, setViewDate] = useState(() => new Date())
  const [view, setView] = useState<CalendarView>('month')
  const [events, setEvents] = useState<CalendarEvent[]>(seedEvents)
  const [searchQuery, setSearchQuery] = useState('')
  const [createTarget, setCreateTarget] = useState<{ date: Date; time: string } | null>(null)
  const [eventTitle, setEventTitle] = useState('')
  const [eventStart, setEventStart] = useState('09:00')
  const [eventEnd, setEventEnd] = useState('10:00')
  const [eventKind, setEventKind] = useState<CalendarEvent['kind']>('meeting')

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

  const filteredEvents = useMemo(
    () => events.filter((event) => eventMatches(event, searchQuery)),
    [events, searchQuery]
  )

  const eventMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of filteredEvents) {
      const key = new Date(event.start).toDateString()
      const list = map.get(key) ?? []
      list.push(event)
      list.sort((a, b) => +new Date(a.start) - +new Date(b.start))
      map.set(key, list)
    }
    return map
  }, [filteredEvents])

  const currentMonth = startOfMonth(viewDate)

  const visibleDays = useMemo(() => {
    const first = startOfMonth(viewDate)
    const firstWeekday = (first.getDay() + 6) % 7
    const gridStart = new Date(first)
    gridStart.setDate(first.getDate() - firstWeekday)

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + index)
      return date
    })
  }, [viewDate])

  const weekDays = useMemo(() => {
    const first = startOfWeek(viewDate)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(first)
      date.setDate(first.getDate() + index)
      return date
    })
  }, [viewDate])

  const monthEvents = useMemo(
    () =>
      filteredEvents.filter((event) => monthKey(new Date(event.start)) === monthKey(currentMonth)),
    [currentMonth, filteredEvents]
  )

  const upcoming = useMemo(
    () =>
      [...filteredEvents]
        .sort((a, b) => +new Date(a.start) - +new Date(b.start))
        .slice(0, 6),
    [filteredEvents]
  )

  const title = useMemo(() => {
    if (view === 'day') {
      return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(viewDate)
    }
    if (view === 'week') {
      const start = weekDays[0]
      const end = weekDays[6]
      return `${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(start)} - ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)}`
    }
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(currentMonth)
  }, [currentMonth, view, viewDate, weekDays])

  function shiftPeriod(offset: number) {
    setViewDate((prev) => {
      if (view === 'day') {
        const next = new Date(prev)
        next.setDate(next.getDate() + offset)
        return next
      }
      if (view === 'week') {
        const next = new Date(prev)
        next.setDate(next.getDate() + offset * 7)
        return next
      }
      return new Date(prev.getFullYear(), prev.getMonth() + offset, 1)
    })
  }

  function openCreateModal(day: Date, time = '09:00') {
    setEventTitle('')
    setEventStart(time)
    setEventEnd(endTimeFor(time))
    setEventKind('meeting')
    setCreateTarget({ date: new Date(day.getFullYear(), day.getMonth(), day.getDate()), time })
    setViewDate(day)
  }

  function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!createTarget || !eventTitle.trim()) return
    const selectedKind = kindOptions.find((option) => option.kind === eventKind) ?? kindOptions[0]
    const start = dateWithTime(createTarget.date, eventStart)
    const end = dateWithTime(createTarget.date, eventEnd)
    if (+end <= +start) end.setHours(start.getHours() + 1, start.getMinutes())

    const newEvent: CalendarEvent = {
      id: `cal-${Date.now()}`,
      title: eventTitle.trim(),
      start: localDateTimeString(start),
      end: localDateTimeString(end),
      tone: selectedKind.tone,
      kind: selectedKind.kind,
    }
    setEvents((prev) => [...prev, newEvent].sort((a, b) => +new Date(a.start) - +new Date(b.start)))
    setCreateTarget(null)
  }

  function addQuickEvent() {
    const base = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), 11, 0, 0)
    const newEvent: CalendarEvent = {
      id: `cal-${Date.now()}`,
      title: `${profile?.first_name ?? profile?.name ?? 'Team'} review block`,
      start: localDateTimeString(base),
      end: localDateTimeString(new Date(base.getTime() + 60 * 60 * 1000)),
      tone: 'violet',
      kind: 'meeting',
      note: 'Quick placeholder event. Replace later with real calendar data.',
    }
    setEvents((prev) => [...prev, newEvent].sort((a, b) => +new Date(a.start) - +new Date(b.start)))
  }

  function handleDragStart(event: DragEvent<HTMLDivElement>, calendarEvent: CalendarEvent) {
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', calendarEvent.id)
  }

  function moveEventToDay(eventId: string, day: Date) {
    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== eventId) return event
        const start = new Date(event.start)
        const end = new Date(event.end)
        const duration = +end - +start
        const nextStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), start.getHours(), start.getMinutes(), 0)
        const nextEnd = new Date(+nextStart + duration)
        return { ...event, start: localDateTimeString(nextStart), end: localDateTimeString(nextEnd) }
      })
    )
  }

  function handleDayDrop(event: DragEvent<HTMLDivElement>, day: Date) {
    event.preventDefault()
    const eventId = event.dataTransfer.getData('text/plain')
    if (eventId) moveEventToDay(eventId, day)
  }

  function dayEvents(day: Date) {
    return eventMap.get(day.toDateString()) ?? []
  }

  function timelineEvents(day: Date) {
    return filteredEvents
      .filter((event) => isSameDay(new Date(event.start), day))
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))
  }

  function renderEventPill(event: CalendarEvent, compact = false) {
    const isSearchHit = searchQuery.trim().length > 0 && eventMatches(event, searchQuery)
    return (
      <div
        key={event.id}
        draggable={view === 'month'}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
        onDragStart={(dragEvent) => handleDragStart(dragEvent, event)}
        className={`cursor-grab rounded-xl px-2.5 py-1.5 text-[11px] ring-1 active:cursor-grabbing ${toneClasses(event.tone, isSearchHit)}`}
      >
        <p className="truncate font-semibold">{event.title}</p>
        {!compact && (
          <p className="mt-0.5 truncate opacity-80">
            {new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(event.start))}
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      <TopBar
        title="Calendar"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setViewDate(new Date())}>
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
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                    Schedule
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-950/40">
                    {(['month', 'week', 'day'] as CalendarView[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setView(item)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                          view === item
                            ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => shiftPeriod(-1)}>
                    <ChevronLeft size={14} />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => shiftPeriod(1)}>
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
              <div className="relative max-w-md">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search events..."
                  className="pl-9"
                />
              </div>
            </div>

            {view === 'month' && (
              <>
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
                    const eventsForDay = dayEvents(day)
                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
                    const isToday = day.toDateString() === new Date().toDateString()
                    return (
                      <div
                        key={key}
                        onClick={() => openCreateModal(day)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDayDrop(event, day)}
                        className={`min-h-28 cursor-pointer rounded-2xl border p-3 text-left transition hover:border-purple-300 hover:bg-purple-50/40 dark:hover:border-purple-700 dark:hover:bg-purple-950/20 ${
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
                          {eventsForDay.length > 0 && (
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">
                              {eventsForDay.length}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 space-y-1.5">
                          {eventsForDay.slice(0, 3).map((event) => renderEventPill(event))}
                          {eventsForDay.length > 3 && (
                            <p className="px-1 text-[11px] text-gray-400 dark:text-gray-500">
                              +{eventsForDay.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {view === 'week' && (
              <div className="mt-5 overflow-x-auto">
                <div className="min-w-[860px]">
                  <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-gray-100 text-center text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <div />
                    {weekDays.map((day) => (
                      <button
                        key={dateKey(day)}
                        type="button"
                        onClick={() => setViewDate(day)}
                        className={`pb-3 ${isSameDay(day, new Date()) ? 'text-purple-600 dark:text-purple-300' : ''}`}
                      >
                        <span className="block uppercase tracking-[0.16em]">{WEEKDAYS[(day.getDay() + 6) % 7]}</span>
                        <span className="mt-1 block text-lg font-semibold">{day.getDate()}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
                    <div>
                      {HOURS.map((hour) => (
                        <div key={hour} className="h-14 border-b border-gray-100 pr-2 pt-1 text-right text-[11px] text-gray-400 dark:border-gray-800">
                          {pad(hour)}:00
                        </div>
                      ))}
                    </div>
                    {weekDays.map((day) => (
                      <TimelineColumn key={dateKey(day)} day={day} events={timelineEvents(day)} onCreate={openCreateModal} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view === 'day' && (
              <div className="mt-5 grid grid-cols-[64px_minmax(0,1fr)]">
                <div>
                  {HOURS.map((hour) => (
                    <div key={hour} className="h-14 border-b border-gray-100 pr-2 pt-1 text-right text-[11px] text-gray-400 dark:border-gray-800">
                      {pad(hour)}:00
                    </div>
                  ))}
                </div>
                <TimelineColumn day={viewDate} events={timelineEvents(viewDate)} onCreate={openCreateModal} />
              </div>
            )}
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
                    {monthEvents.length} visible blocks this month
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
              <div className="flex items-start gap-2">
                <div className="rounded-xl bg-gray-50 p-2 text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                  <CalendarDays size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Calendar sources</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Connector-ready targets for sync.</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {calendarConnectors.map((connector) => (
                  <button
                    key={connector.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-left transition hover:border-purple-200 hover:bg-purple-50 dark:border-gray-800 dark:hover:border-purple-800 dark:hover:bg-purple-950/20"
                  >
                    <span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{connector.label}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{connector.description}</span>
                    </span>
                    <Badge variant="outline" className="text-gray-500 dark:text-gray-400">Ready</Badge>
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upcoming</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Filtered by the current search.</p>
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
                {upcoming.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    No events match this search.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Modal open={Boolean(createTarget)} onClose={() => setCreateTarget(null)} title="Create event">
        <form onSubmit={saveEvent} className="space-y-4">
          <Input
            label="Title"
            value={eventTitle}
            onChange={(event) => setEventTitle(event.target.value)}
            placeholder="Event title"
            autoFocus
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Start" type="time" value={eventStart} onChange={(event) => setEventStart(event.target.value)} />
            <Input label="End" type="time" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} />
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Type
            <select
              value={eventKind}
              onChange={(event) => setEventKind(event.target.value as CalendarEvent['kind'])}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              {kindOptions.map((option) => (
                <option key={option.kind} value={option.kind}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!eventTitle.trim()}>
              Save event
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

function TimelineColumn({
  day,
  events,
  onCreate,
}: {
  day: Date
  events: CalendarEvent[]
  onCreate: (day: Date, time?: string) => void
}) {
  return (
    <div className="relative h-[1344px] border-l border-gray-100 dark:border-gray-800">
      {HOURS.map((hour) => (
        <button
          key={hour}
          type="button"
          onClick={() => onCreate(day, `${pad(hour)}:00`)}
          className="block h-14 w-full border-b border-gray-100 text-left transition hover:bg-purple-50/50 dark:border-gray-800 dark:hover:bg-purple-950/20"
          aria-label={`Create event at ${pad(hour)}:00`}
        />
      ))}
      {events.map((event) => {
        const position = eventPosition(event)
        return (
          <div
            key={event.id}
            className={`absolute left-1 right-1 z-10 overflow-hidden rounded-xl px-2 py-1 text-xs ring-1 ${toneClasses(event.tone)}`}
            style={{ top: position.top + 2, height: position.height - 4 }}
          >
            <p className="truncate font-semibold">{event.title}</p>
            <p className="truncate opacity-80">{formatTimeRange(event.start, event.end)}</p>
          </div>
        )
      })}
    </div>
  )
}
