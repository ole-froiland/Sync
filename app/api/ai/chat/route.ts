import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { logAiAuditEvent } from '@/lib/assistant/audit'
import { buildActionEnvelopes } from '@/lib/assistant/envelope'
import { planCalendarAutomation } from '@/lib/assistant/calendar-automation'
import { planLocalSyncResponse, planOpenAiSyncResponse } from '@/lib/assistant/planner'
import { planPremierLeagueFixtures } from '@/lib/assistant/sports-fixtures'
import { planNorwegianFootballFixtures } from '@/lib/assistant/norwegian-fixtures'
import { planLocalGemmaResponse } from '@/lib/assistant/local-gemma'
import type { SyncAssistantCalendarEvent, SyncAssistantMessage, SyncAssistantPlan } from '@/lib/assistant/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChatRequest = {
  messages?: SyncAssistantMessage[]
  currentPath?: string
  sessionId?: string
  calendarEvents?: SyncAssistantCalendarEvent[]
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as ChatRequest
  const messages = sanitizeMessages(body.messages)
  const calendarEvents = sanitizeCalendarEvents(body.calendarEvents)
  if (messages.length === 0) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }

  let planner: 'openai' | 'gemma' | 'local' = 'local'
  const now = new Date()
  let plan: SyncAssistantPlan | null = planCalendarAutomation(messages, { events: calendarEvents, now })
  if (!plan) plan = await planPremierLeagueFixtures(messages, { now })
  if (!plan) plan = await planNorwegianFootballFixtures(messages, { now })
  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini'

  if (!plan) {
    try {
      plan = await planLocalGemmaResponse(messages, {
        userId: auth.user.id,
        currentPath: body.currentPath,
        now,
        calendarEvents,
      })
      if (plan) planner = 'gemma'
    } catch {
      plan = null
    }
  }

  if (!plan) {
    try {
      plan = await planOpenAiSyncResponse(messages, {
        currentPath: body.currentPath,
        now,
        calendarEvents,
      })
      if (plan) planner = 'openai'
    } catch {
      plan = null
    }
  }

  if (!plan) {
    plan = planLocalSyncResponse(messages, {
      currentPath: body.currentPath,
      now,
    })
  }

  const actions = buildActionEnvelopes(auth.user.id, plan.actions)
  await Promise.all(actions.map((item) =>
    logAiAuditEvent(auth.supabase, auth.user, {
      sessionId: body.sessionId,
      action: item.action,
      status: 'planned',
      model: planner === 'openai' ? model : planner === 'gemma' ? 'gemma4:latest' : 'local',
    })
  ))

  return NextResponse.json({
    message: { role: 'assistant', content: plan.reply },
    actions,
    planner,
    model: planner === 'openai' ? model : planner === 'gemma' ? 'gemma4:latest' : 'local',
  })
}

function sanitizeCalendarEvents(events: unknown): SyncAssistantCalendarEvent[] {
  if (!Array.isArray(events)) return []
  return events.slice(0, 100).flatMap((event) => {
    if (!event || typeof event !== 'object') return []
    const value = event as Record<string, unknown>
    const id = typeof value.id === 'string' ? value.id.slice(0, 200) : ''
    const title = typeof value.title === 'string' ? value.title.trim().slice(0, 240) : ''
    const start = typeof value.start === 'string' ? value.start : ''
    const end = typeof value.end === 'string' ? value.end : ''
    if (!id || !title || Number.isNaN(+new Date(start)) || Number.isNaN(+new Date(end)) || +new Date(end) <= +new Date(start)) return []
    return [{
      id,
      title,
      start,
      end,
      eventKind: value.eventKind === 'focus' || value.eventKind === 'launch' || value.eventKind === 'deadline' ? value.eventKind : 'meeting',
      allDay: value.allDay === true,
    }]
  })
}

function sanitizeMessages(messages: unknown): SyncAssistantMessage[] {
  if (!Array.isArray(messages)) return []
  return messages
    .filter((message): message is SyncAssistantMessage => {
      if (!message || typeof message !== 'object') return false
      const value = message as Record<string, unknown>
      return (value.role === 'user' || value.role === 'assistant') && typeof value.content === 'string'
    })
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4000),
    }))
}
