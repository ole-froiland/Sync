'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bot, CalendarPlus, Check, FolderPlus, Languages, Loader2, MessageSquare, Navigation, Send, Sparkles, StickyNote, Workflow, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import { useLanguage } from '@/context/LanguageContext'
import { useUser } from '@/context/UserContext'
import {
  automaticBrowserAction,
  buildAssistantProjectFolder,
  calendarEventsForAction,
  PROJECT_FOLDER_CREATED_EVENT,
  PROJECT_FOLDERS_STORAGE_KEY,
  PROJECTS_TREE_EVENT,
  PROJECTS_VIEW_STORAGE_KEY,
  TASK_CREATED_EVENT,
  type AssistantLocalCalendarEvent,
} from '@/lib/assistant/client-actions'
import { cn } from '@/lib/utils'
import type { Post, ProjectFolder, Task } from '@/types'
import type {
  SyncAssistantAction,
  SyncAssistantActionEnvelope,
  SyncAssistantChatResponse,
  SyncAssistantMessage,
} from '@/lib/assistant/types'

type SyncAssistantPanelProps = {
  open: boolean
  onClose: () => void
}

type Toast = {
  tone: 'success' | 'error'
  message: string
}

const STORAGE_KEY = 'sync-calendar-events'
const CALENDAR_EVENT_CREATED = 'sync:calendar-event-created'

const starterMessage: SyncAssistantMessage = {
  role: 'assistant',
  content:
    'Jeg er Sync AI. Jeg kan bare hjelpe inne i Sync, for eksempel notes, kalender, prosjekter, posts, repos og innstillinger.',
}

export default function SyncAssistantPanel({ open, onClose }: SyncAssistantPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const profile = useUser()
  const { setLocale } = useLanguage()
  const [messages, setMessages] = useState<SyncAssistantMessage[]>([starterMessage])
  const [input, setInput] = useState('')
  const [actions, setActions] = useState<SyncAssistantActionEnvelope[]>([])
  const [busy, setBusy] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [sessionId] = useState(() => crypto.randomUUID())
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const canSend = input.trim().length > 0 && !busy

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!open) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [actions, messages, open])

  const suggestions = useMemo(
    () => [
      'Legg til note: ring Ola',
      'Lag kalenderaktivitet demo i morgen 10:30',
      'Åpne settings',
    ],
    [],
  )

  async function sendMessage() {
    const content = input.trim()
    if (!content || busy) return

    const nextMessages: SyncAssistantMessage[] = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setActions([])
    setToast(null)
    setBusy(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, currentPath: pathname, sessionId }),
      })
      const body = (await res.json().catch(() => ({}))) as Partial<SyncAssistantChatResponse> & { error?: string }
      if (!res.ok || !body.message) throw new Error(body.error ?? 'Sync AI svarte ikke.')

      setMessages((prev) => [...prev, body.message as SyncAssistantMessage])
      const plannedActions = body.actions ?? []
      const automaticAction = automaticBrowserAction(plannedActions)
      if (automaticAction) {
        await runBrowserAction(automaticAction.action)
        setActions([])
        onClose()
      } else {
        setActions(plannedActions)
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Sync AI feilet. Prøv igjen.',
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  async function runAction(envelope: SyncAssistantActionEnvelope) {
    if (runningId) return
    setRunningId(envelope.id)
    setToast(null)

    try {
      if (envelope.confirmationToken) {
        const res = await fetch('/api/ai/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: envelope.confirmationToken, sessionId }),
        })
        const body = (await res.json().catch(() => ({}))) as { message?: string; data?: unknown; error?: string }
        if (!res.ok) throw new Error(body.error ?? 'Kunne ikke kjøre handlingen.')
        setToast({ tone: 'success', message: body.message ?? 'Handling utført.' })
        handleServerActionResult(envelope.action, body.data)
      } else {
        const message = await runBrowserAction(envelope.action)
        setToast({ tone: 'success', message })
      }

      setActions((prev) => prev.filter((item) => item.id !== envelope.id))
    } catch (error) {
      setToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Kunne ikke kjøre handlingen.',
      })
    } finally {
      setRunningId(null)
    }
  }

  async function runBrowserAction(action: SyncAssistantAction) {
    switch (action.kind) {
      case 'navigate':
        router.push(action.href)
        return `Åpnet ${action.href}.`
      case 'open_modal':
        window.dispatchEvent(new Event(modalEventName(action.modal)))
        return 'Åpnet panelet.'
      case 'open_projects_tree':
        window.sessionStorage.setItem(PROJECTS_VIEW_STORAGE_KEY, 'tree')
        window.dispatchEvent(new Event(PROJECTS_TREE_EVENT))
        router.push('/projects')
        return 'Åpnet prosjektene som tre.'
      case 'set_language':
        setLocale(action.locale)
        return action.locale === 'en' ? 'Changed Sync to English.' : 'Endret Sync til norsk.'
      case 'create_calendar_event':
        createLocalCalendarEvents(action)
        router.push('/calendar')
        return `La "${action.title}" i kalenderen.`
      case 'create_calendar_events':
        createLocalCalendarEvents(action)
        router.push('/calendar')
        return `La ${action.events.length} hendelser i kalenderen.`
      case 'create_project_folder':
        await createProjectFolder(action)
        router.push('/projects')
        return `Opprettet prosjektmappen "${action.name}".`
      default:
        throw new Error('Denne handlingen må kjøres på serveren.')
    }
  }

  function handleServerActionResult(action: SyncAssistantAction, data: unknown) {
    if (action.kind === 'create_note' || action.kind === 'complete_note') {
      router.push('/notes')
      return
    }
    if (action.kind === 'create_post') {
      if (data && typeof data === 'object') {
        window.dispatchEvent(new CustomEvent<Post>('sync:post-created', { detail: data as Post }))
      }
      router.push('/dashboard')
      return
    }
    if (action.kind === 'create_project') {
      const id = data && typeof data === 'object' && 'id' in data ? String(data.id) : ''
      router.push(id ? `/projects/${encodeURIComponent(id)}` : '/projects')
      return
    }
    if (action.kind === 'create_task' && data && typeof data === 'object') {
      window.dispatchEvent(new CustomEvent<Task>(TASK_CREATED_EVENT, { detail: data as Task }))
    }
  }

  async function createProjectFolder(
    action: Extract<SyncAssistantAction, { kind: 'create_project_folder' }>
  ) {
    const folder = buildAssistantProjectFolder(action, profile)
    const existing = readProjectFolders()
    const next = [folder, ...existing.filter((item) => item.id !== folder.id)]
    window.localStorage.setItem(PROJECT_FOLDERS_STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent<ProjectFolder>(PROJECT_FOLDER_CREATED_EVENT, { detail: folder }))

    try {
      await fetch('/api/project-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folders: [folder] }),
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      // The local cache remains authoritative until the next successful project sync.
    }
  }

  function createLocalCalendarEvents(
    action: Extract<SyncAssistantAction, { kind: 'create_calendar_event' | 'create_calendar_events' }>
  ) {
    const calendarEvents = calendarEventsForAction(action)
    const existing = readCalendarEvents()
    const next = calendarEvents.reduce(upsertCalendarEvent, existing)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    for (const calendarEvent of calendarEvents) {
      window.dispatchEvent(new CustomEvent<AssistantLocalCalendarEvent>(CALENDAR_EVENT_CREATED, { detail: calendarEvent }))
    }
  }

  return (
    <aside
      aria-label="Sync AI"
      aria-hidden={!open}
      className={cn(
        'fixed inset-y-0 right-0 z-[980] flex w-full max-w-[28rem] flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform duration-200 ease-out dark:border-gray-800 dark:bg-gray-950 sm:max-w-[27rem]',
        open ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4 dark:border-gray-800">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fuchsia-600 text-white">
            <Sparkles size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-gray-950 dark:text-gray-100">Sync AI</h2>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">Kun inne i Sync</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Sync AI"
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-900 dark:hover:text-gray-200"
        >
          <X size={18} />
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {messages.map((message, index) => (
            <MessageBubble key={`${message.role}-${index}`} message={message} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 size={15} className="animate-spin" />
              Tenker i Sync-kontekst...
            </div>
          )}
        </div>

        {actions.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
              Foreslåtte handlinger
            </p>
            {actions.map((action) => (
              <ActionItem
                key={action.id}
                action={action}
                running={runningId === action.id}
                disabled={Boolean(runningId)}
                onRun={() => runAction(action)}
              />
            ))}
          </div>
        )}

        {toast && (
          <p
            aria-live="polite"
            className={cn(
              'mt-4 rounded-lg px-3 py-2 text-sm',
              toast.tone === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200'
                : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200',
            )}
          >
            {toast.message}
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
        {messages.length === 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setInput(suggestion)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-gray-800 dark:text-gray-300 dark:hover:border-fuchsia-900 dark:hover:bg-fuchsia-950/30 dark:hover:text-fuchsia-200"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void sendMessage()
              }
            }}
            rows={2}
            placeholder="Spør Sync AI..."
            className="max-h-32 min-h-[3rem]"
          />
          <Button
            type="button"
            size="md"
            onClick={() => void sendMessage()}
            disabled={!canSend}
            loading={busy}
            aria-label="Send to Sync AI"
            className="h-12 w-12 shrink-0 px-0"
          >
            {!busy && <Send size={17} />}
          </Button>
        </div>
      </div>
    </aside>
  )
}

function MessageBubble({ message }: { message: SyncAssistantMessage }) {
  const assistant = message.role === 'assistant'
  return (
    <div className={cn('flex gap-2', assistant ? 'justify-start' : 'justify-end')}>
      {assistant && (
        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-300">
          <Bot size={15} />
        </span>
      )}
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-5',
          assistant
            ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100'
            : 'bg-fuchsia-600 text-white',
        )}
      >
        {message.content}
      </div>
    </div>
  )
}

function ActionItem({
  action,
  running,
  disabled,
  onRun,
}: {
  action: SyncAssistantActionEnvelope
  running: boolean
  disabled: boolean
  onRun: () => void
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-950 dark:text-gray-300">
          {renderActionIcon(action.action)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{action.label}</p>
            {action.requiresConfirmation && (
              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                Bekreft
              </span>
            )}
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-gray-500 dark:text-gray-400">{action.description}</p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={action.requiresConfirmation ? 'primary' : 'secondary'}
        onClick={onRun}
        disabled={disabled}
        loading={running}
        className="mt-3 w-full"
      >
        {!running && <Check size={14} />}
        {action.requiresConfirmation ? 'Bekreft og kjør' : 'Kjør'}
      </Button>
    </div>
  )
}

function renderActionIcon(action: SyncAssistantAction) {
  switch (action.kind) {
    case 'navigate':
    case 'open_modal':
      return <Navigation size={16} />
    case 'open_projects_tree':
      return <Workflow size={16} />
    case 'set_language':
      return <Languages size={16} />
    case 'create_calendar_event':
    case 'create_calendar_events':
      return <CalendarPlus size={16} />
    case 'create_note':
    case 'complete_note':
      return <StickyNote size={16} />
    case 'create_project_folder':
      return <FolderPlus size={16} />
    default:
      return <MessageSquare size={16} />
  }
}

function modalEventName(modal: Extract<SyncAssistantAction, { kind: 'open_modal' }>['modal']) {
  if (modal === 'settings') return 'sync:open-settings'
  if (modal === 'new_repo') return 'sync:open-repo-modal'
  return 'sync:open-post-modal'
}

function readCalendarEvents() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as AssistantLocalCalendarEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readProjectFolders() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROJECT_FOLDERS_STORAGE_KEY) ?? '[]') as ProjectFolder[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function upsertCalendarEvent(events: AssistantLocalCalendarEvent[], event: AssistantLocalCalendarEvent) {
  return events.some((item) => item.id === event.id)
    ? events.map((item) => (item.id === event.id ? event : item))
    : [...events, event]
}
