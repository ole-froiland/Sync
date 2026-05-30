'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import {
  Apple,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { useUser } from '@/context/UserContext'
import NotesPanel from '@/components/notes/NotesPanel'

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
type CalendarProvider = 'apple' | 'microsoft' | 'google'
type NotepadTask = { id: string; title: string; createdAt: string }
type ProviderStatus = {
  provider: CalendarProvider
  configured: boolean
  connected: boolean
  account: string | null
  status: string | null
  updatedAt: string | null
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const VISIBLE_START_HOUR = 6
const VISIBLE_END_HOUR = 22
const SLOT_HOURS = Array.from(
  { length: VISIBLE_END_HOUR - VISIBLE_START_HOUR },
  (_, index) => VISIBLE_START_HOUR + index
)
const STORAGE_KEY = 'sync-calendar-events'
const NOTEPAD_STORAGE_KEY = 'sync-calendar-notepad-tasks'
const HOUR_HEIGHT = 30

const providerMeta: Record<CalendarProvider, { label: string; button: string; description: string }> = {
  apple: {
    label: 'Apple Calendar',
    button: 'Add Apple Calendar',
    description: 'Connect with iCloud CalDAV credentials.',
  },
  microsoft: {
    label: 'Microsoft Outlook Calendar',
    button: 'Add Microsoft Outlook Calendar',
    description: 'Connect through Microsoft OAuth.',
  },
  google: {
    label: 'Google Calendar',
    button: 'Add Google Calendar',
    description: 'Connect through Google OAuth.',
  },
}

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
  const startMinutes = (start.getHours() - VISIBLE_START_HOUR) * 60 + start.getMinutes()
  const durationMinutes = Math.max(30, Math.round((+end - +start) / 60000))
  return {
    top: Math.max(0, (startMinutes / 60) * HOUR_HEIGHT),
    height: Math.max(24, (durationMinutes / 60) * HOUR_HEIGHT),
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

function dayTimeOverlaps(events: CalendarEvent[], day: Date, hour: number) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return events.some((event) => {
    const eventStart = new Date(event.start)
    const eventEnd = new Date(event.end)
    return isSameDay(eventStart, day) && start < eventEnd && end > eventStart
  })
}

function firstFreeHour(events: CalendarEvent[], day: Date, preferredHour: number) {
  const candidates = [
    preferredHour,
    ...SLOT_HOURS.filter((hour) => hour !== preferredHour && hour > preferredHour),
    ...SLOT_HOURS.filter((hour) => hour < preferredHour),
  ].filter((hour) => hour >= VISIBLE_START_HOUR && hour < VISIBLE_END_HOUR)

  return candidates.find((hour) => !dayTimeOverlaps(events, day, hour)) ?? null
}

function calendarErrorMessage(code: string | null, detail: string | null) {
  if (!code) return null
  const suffix = detail ? ` (${decodeURIComponent(detail)})` : ''
  if (code.includes('not_configured')) return `Calendar provider is not configured.${suffix}`
  if (code.includes('denied')) return `Calendar connection was cancelled.${suffix}`
  if (code.includes('token_failed')) return `Calendar token exchange failed.${suffix}`
  if (code.includes('save_failed')) return `Calendar connection could not be saved.${suffix}`
  return `Calendar connection failed.${suffix}`
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
  const [notepadTasks, setNotepadTasks] = useState<NotepadTask[]>([])
  const [notepadDraft, setNotepadDraft] = useState('')
  const [dropError, setDropError] = useState<string | null>(null)
  const [externalOpen, setExternalOpen] = useState(false)
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([])
  const [providerError, setProviderError] = useState<string | null>(null)
  const [appleModalOpen, setAppleModalOpen] = useState(false)
  const [appleUsername, setAppleUsername] = useState('')
  const [applePassword, setApplePassword] = useState('')
  const [appleServerUrl, setAppleServerUrl] = useState('https://caldav.icloud.com')
  const [appleSaving, setAppleSaving] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      const rawEvents = window.localStorage.getItem(STORAGE_KEY)
      if (rawEvents) {
        try {
          const parsed = JSON.parse(rawEvents) as CalendarEvent[]
          if (Array.isArray(parsed) && parsed.length > 0) setEvents(parsed)
        } catch {}
      }

      const rawTasks = window.localStorage.getItem(NOTEPAD_STORAGE_KEY)
      if (rawTasks) {
        try {
          const parsed = JSON.parse(rawTasks) as NotepadTask[]
          if (Array.isArray(parsed)) setNotepadTasks(parsed)
        } catch {}
      }

      const params = new URLSearchParams(window.location.search)
      const error = calendarErrorMessage(params.get('calendar_error'), params.get('detail'))
      if (error) setProviderError(error)
      if (params.get('calendar_connected')) setExternalOpen(true)
      if (params.get('calendar_error') || params.get('calendar_connected')) {
        window.history.replaceState({}, '', '/calendar')
      }
    })
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  }, [events])

  useEffect(() => {
    window.localStorage.setItem(NOTEPAD_STORAGE_KEY, JSON.stringify(notepadTasks))
  }, [notepadTasks])

  useEffect(() => {
    void refreshProviderStatus()
  }, [])

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

  async function refreshProviderStatus() {
    try {
      const res = await fetch('/api/calendar/status')
      if (!res.ok) throw new Error('Could not load calendar connections.')
      const body = (await res.json()) as { providers?: ProviderStatus[] }
      setProviderStatuses(body.providers ?? [])
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : 'Could not load calendar connections.')
    }
  }

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

  function createEventFromTitle(titleText: string, day: Date, hour: number, source: 'note' | 'manual') {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const noteEvent: CalendarEvent = {
      id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: titleText.trim(),
      start: localDateTimeString(start),
      end: localDateTimeString(end),
      tone: source === 'note' ? 'sky' : 'violet',
      kind: source === 'note' ? 'focus' : 'meeting',
    }
    setEvents((prev) => [...prev, noteEvent].sort((a, b) => +new Date(a.start) - +new Date(b.start)))
    setDropError(null)
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

  function addNotepadTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const titleText = notepadDraft.trim()
    if (!titleText) return
    setNotepadTasks((prev) => [
      { id: `note-${Date.now()}`, title: titleText, createdAt: new Date().toISOString() },
      ...prev,
    ])
    setNotepadDraft('')
  }

  function handleEventDragStart(event: DragEvent<HTMLDivElement>, calendarEvent: CalendarEvent) {
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-sync-calendar-event', calendarEvent.id)
  }

  function handleTaskDragStart(event: DragEvent<HTMLDivElement>, task: NotepadTask) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-sync-notepad-task', task.id)
  }

  function moveEventToDay(eventId: string, day: Date, hour?: number) {
    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== eventId) return event
        const start = new Date(event.start)
        const end = new Date(event.end)
        const duration = +end - +start
        const nextStart = new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          hour ?? start.getHours(),
          hour == null ? start.getMinutes() : 0,
          0
        )
        const nextEnd = new Date(+nextStart + duration)
        return { ...event, start: localDateTimeString(nextStart), end: localDateTimeString(nextEnd) }
      })
    )
  }

  function handleCalendarDrop(event: DragEvent<HTMLElement>, day: Date, preferredHour: number) {
    event.preventDefault()
    const eventId = event.dataTransfer.getData('application/x-sync-calendar-event')
    if (eventId) {
      moveEventToDay(eventId, day, preferredHour)
      return
    }

    const taskId = event.dataTransfer.getData('application/x-sync-notepad-task')
    if (!taskId) return

    const task = notepadTasks.find((item) => item.id === taskId)
    if (!task) return

    const freeHour = firstFreeHour(events, day, preferredHour)
    if (freeHour == null) {
      setDropError('No free one-hour slot is available that day between 06:00 and 22:00.')
      return
    }

    createEventFromTitle(task.title, day, freeHour, 'note')
  }

  function dayEvents(day: Date) {
    return eventMap.get(day.toDateString()) ?? []
  }

  function timelineEvents(day: Date) {
    return filteredEvents
      .filter((event) => isSameDay(new Date(event.start), day))
      .filter((event) => {
        const hour = new Date(event.start).getHours()
        return hour >= VISIBLE_START_HOUR && hour < VISIBLE_END_HOUR
      })
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))
  }

  function renderEventPill(event: CalendarEvent, compact = false) {
    const isSearchHit = searchQuery.trim().length > 0 && eventMatches(event, searchQuery)
    return (
      <div
        key={event.id}
        draggable={view === 'month'}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
        onDragStart={(dragEvent) => handleEventDragStart(dragEvent, event)}
        className={`cursor-grab rounded-md px-2 py-1 text-[11px] ring-1 active:cursor-grabbing ${toneClasses(event.tone, isSearchHit)}`}
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

  function providerStatus(provider: CalendarProvider) {
    return providerStatuses.find((item) => item.provider === provider)
  }

  async function disconnectProvider(provider: CalendarProvider) {
    setProviderError(null)
    const res = await fetch(`/api/calendar/${provider}/disconnect`, { method: 'DELETE' })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setProviderError(body.error ?? 'Could not disconnect calendar.')
      return
    }
    await refreshProviderStatus()
  }

  function connectProvider(provider: CalendarProvider) {
    setProviderError(null)
    const status = providerStatus(provider)
    if (provider === 'apple') {
      setAppleModalOpen(true)
      return
    }
    if (status && !status.configured) {
      setProviderError(`${providerMeta[provider].label} OAuth is not configured on this server.`)
      return
    }
    window.location.href = `/api/calendar/${provider}/connect`
  }

  async function saveAppleConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppleSaving(true)
    setProviderError(null)
    try {
      const res = await fetch('/api/calendar/apple/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: appleUsername,
          appPassword: applePassword,
          serverUrl: appleServerUrl,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not save Apple Calendar setup.')
      setAppleModalOpen(false)
      setApplePassword('')
      await refreshProviderStatus()
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : 'Could not save Apple Calendar setup.')
    } finally {
      setAppleSaving(false)
    }
  }

  return (
    <>
      <TopBar title="Calendar" />

      <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col overflow-hidden bg-gray-50 px-4 py-4 dark:bg-gray-950">
        <div className="flex min-h-0 flex-1 gap-4">
          <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Schedule
                </p>
                <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="relative w-64">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search events..."
                    className="h-9 pl-9"
                  />
                </div>
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-950/40">
                  {(['month', 'week', 'day'] as CalendarView[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setView(item)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                        view === item
                          ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                          : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="secondary" onClick={() => setViewDate(new Date())}>
                  Today
                </Button>
                <Button size="sm" variant="secondary" onClick={() => shiftPeriod(-1)} aria-label="Previous period">
                  <ChevronLeft size={14} />
                </Button>
                <Button size="sm" variant="secondary" onClick={() => shiftPeriod(1)} aria-label="Next period">
                  <ChevronRight size={14} />
                </Button>
                <Button size="sm" onClick={addQuickEvent}>
                  <Plus size={14} />
                  Add block
                </Button>
              </div>
            </div>

            {providerError && (
              <p className="mx-4 mt-3 shrink-0 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">
                {providerError}
              </p>
            )}
            {dropError && (
              <p className="mx-4 mt-3 shrink-0 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                {dropError}
              </p>
            )}

            <div className="min-h-0 flex-1 p-3">
              {view === 'month' && (
                <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-2">
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                    {WEEKDAYS.map((day) => (
                      <div key={day} className="py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid min-h-0 grid-cols-7 grid-rows-6 gap-1.5">
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
                          onDrop={(event) => handleCalendarDrop(event, day, 9)}
                          className={`min-h-0 cursor-pointer rounded-lg border p-2 text-left transition hover:border-purple-300 hover:bg-purple-50/40 dark:hover:border-purple-700 dark:hover:bg-purple-950/20 ${
                            isCurrentMonth
                              ? 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
                              : 'border-transparent bg-gray-50/70 dark:bg-gray-900/30'
                          } ${isToday ? 'ring-1 ring-purple-400/70' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-medium ${
                                isCurrentMonth
                                  ? 'text-gray-900 dark:text-gray-100'
                                  : 'text-gray-400 dark:text-gray-600'
                              }`}
                            >
                              {day.getDate()}
                            </span>
                            {eventsForDay.length > 0 && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                {eventsForDay.length}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 space-y-1 overflow-hidden">
                            {eventsForDay.slice(0, 2).map((event) => renderEventPill(event, true))}
                            {eventsForDay.length > 2 && (
                              <p className="px-1 text-[10px] text-gray-400 dark:text-gray-500">
                                +{eventsForDay.length - 2} more
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {view === 'week' && (
                <div className="h-full min-w-[780px]">
                  <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-gray-100 text-center text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <div />
                    {weekDays.map((day) => (
                      <button
                        key={dateKey(day)}
                        type="button"
                        onClick={() => setViewDate(day)}
                        className={`pb-2 ${isSameDay(day, new Date()) ? 'text-purple-600 dark:text-purple-300' : ''}`}
                      >
                        <span className="block uppercase tracking-[0.14em]">{WEEKDAYS[(day.getDay() + 6) % 7]}</span>
                        <span className="block text-base font-semibold">{day.getDate()}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
                    <TimeLabels />
                    {weekDays.map((day) => (
                      <TimelineColumn
                        key={dateKey(day)}
                        day={day}
                        events={timelineEvents(day)}
                        onCreate={openCreateModal}
                        onDropTask={handleCalendarDrop}
                      />
                    ))}
                  </div>
                </div>
              )}

              {view === 'day' && (
                <div className="grid h-full grid-cols-[52px_minmax(0,1fr)]">
                  <TimeLabels />
                  <TimelineColumn
                    day={viewDate}
                    events={timelineEvents(viewDate)}
                    onCreate={openCreateModal}
                    onDropTask={handleCalendarDrop}
                  />
                </div>
              )}
            </div>

            <section className="shrink-0 border-t border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-gray-800 dark:bg-gray-950/30">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notepad</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Write tasks here, then drag them into a free calendar slot.
                  </p>
                </div>
                <form onSubmit={addNotepadTask} className="flex w-[420px] max-w-full gap-2">
                  <Input
                    value={notepadDraft}
                    onChange={(event) => setNotepadDraft(event.target.value)}
                    placeholder="Add a task to schedule..."
                    className="h-9"
                  />
                  <Button type="submit" size="sm" disabled={!notepadDraft.trim()}>
                    Add
                  </Button>
                </form>
              </div>
              <div className="mt-2 flex min-h-12 gap-2 overflow-hidden">
                {notepadTasks.length === 0 ? (
                  <p className="flex h-12 w-full items-center rounded-lg border border-dashed border-gray-200 px-3 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    No tasks yet.
                  </p>
                ) : (
                  notepadTasks.slice(0, 8).map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(event) => handleTaskDragStart(event, task)}
                      className="flex max-w-56 shrink-0 cursor-grab items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm active:cursor-grabbing dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
                    >
                      <GripVertical size={14} className="shrink-0 text-gray-400" />
                      <span className="truncate">{task.title}</span>
                      <button
                        type="button"
                        onClick={() => setNotepadTasks((prev) => prev.filter((item) => item.id !== task.id))}
                        className="ml-auto shrink-0 text-gray-400 transition hover:text-red-500"
                        aria-label="Remove task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </section>

          <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-hidden">
            <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
                  <CalendarDays size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Calendar pulse</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {monthEvents.length} visible blocks this month
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric label="Focus" value={monthEvents.filter((event) => event.kind === 'focus').length} />
                <Metric label="Meetings" value={monthEvents.filter((event) => event.kind === 'meeting').length} />
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={externalOpen}
                  onChange={(event) => setExternalOpen(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Add external calendars
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Connect Apple, Outlook, or Google for setup status.
                  </span>
                </span>
              </label>

              {externalOpen && (
                <div className="mt-4 space-y-2">
                  {(['apple', 'microsoft', 'google'] as CalendarProvider[]).map((provider) => {
                    const status = providerStatus(provider)
                    return (
                      <div key={provider} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                              {providerMeta[provider].label}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {status?.connected ? status.account ?? 'Connected' : providerMeta[provider].description}
                            </p>
                          </div>
                          {status?.connected && <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />}
                        </div>
                        <div className="mt-3 flex gap-2">
                          {status?.connected ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="w-full"
                              onClick={() => void disconnectProvider(provider)}
                            >
                              Disconnect
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="w-full"
                              onClick={() => connectProvider(provider)}
                            >
                              {provider === 'apple' && <Apple size={14} />}
                              {providerMeta[provider].button}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <NotesPanel variant="embedded" />
          </aside>
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

      <Modal open={appleModalOpen} onClose={() => setAppleModalOpen(false)} title="Add Apple Calendar">
        <form onSubmit={saveAppleConnection} className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Use your Apple ID and an app-specific password from appleid.apple.com.
          </p>
          <Input
            label="Apple ID"
            value={appleUsername}
            onChange={(event) => setAppleUsername(event.target.value)}
            placeholder="name@icloud.com"
          />
          <Input
            label="App-specific password"
            type="password"
            value={applePassword}
            onChange={(event) => setApplePassword(event.target.value)}
            placeholder="xxxx-xxxx-xxxx-xxxx"
          />
          <Input
            label="CalDAV server"
            value={appleServerUrl}
            onChange={(event) => setAppleServerUrl(event.target.value)}
            placeholder="https://caldav.icloud.com"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAppleModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={appleSaving} disabled={!appleUsername.trim() || !applePassword.trim()}>
              Save Apple Calendar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/70">
      <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  )
}

function TimeLabels() {
  return (
    <div>
      {SLOT_HOURS.map((hour) => (
        <div
          key={hour}
          className="border-b border-gray-100 pr-2 pt-1 text-right text-[10px] text-gray-400 dark:border-gray-800"
          style={{ height: HOUR_HEIGHT }}
        >
          {pad(hour)}:00
        </div>
      ))}
      <div className="pr-2 pt-1 text-right text-[10px] text-gray-400">{VISIBLE_END_HOUR}:00</div>
    </div>
  )
}

function TimelineColumn({
  day,
  events,
  onCreate,
  onDropTask,
}: {
  day: Date
  events: CalendarEvent[]
  onCreate: (day: Date, time?: string) => void
  onDropTask: (event: DragEvent<HTMLElement>, day: Date, preferredHour: number) => void
}) {
  return (
    <div
      className="relative border-l border-gray-100 dark:border-gray-800"
      style={{ height: SLOT_HOURS.length * HOUR_HEIGHT }}
    >
      {SLOT_HOURS.map((hour) => (
        <button
          key={hour}
          type="button"
          onClick={() => onCreate(day, `${pad(hour)}:00`)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onDropTask(event, day, hour)}
          className="block w-full border-b border-gray-100 text-left transition hover:bg-purple-50/50 dark:border-gray-800 dark:hover:bg-purple-950/20"
          style={{ height: HOUR_HEIGHT }}
          aria-label={`Create event at ${pad(hour)}:00`}
        />
      ))}
      {events.map((event) => {
        const position = eventPosition(event)
        return (
          <div
            key={event.id}
            className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md px-2 py-1 text-[11px] ring-1 ${toneClasses(event.tone)}`}
            style={{ top: position.top + 2, height: Math.max(22, position.height - 4) }}
          >
            <p className="truncate font-semibold">{event.title}</p>
            <p className="truncate opacity-80">{formatTimeRange(event.start, event.end)}</p>
          </div>
        )
      })}
    </div>
  )
}
