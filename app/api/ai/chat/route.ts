import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { logAiAuditEvent } from '@/lib/assistant/audit'
import { buildActionEnvelopes } from '@/lib/assistant/envelope'
import { planLocalSyncResponse, planOpenAiSyncResponse } from '@/lib/assistant/planner'
import type { SyncAssistantMessage, SyncAssistantPlan } from '@/lib/assistant/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChatRequest = {
  messages?: SyncAssistantMessage[]
  currentPath?: string
  sessionId?: string
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as ChatRequest
  const messages = sanitizeMessages(body.messages)
  if (messages.length === 0) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }

  let planner: 'openai' | 'local' = 'local'
  let plan: SyncAssistantPlan | null = null
  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini'

  try {
    plan = await planOpenAiSyncResponse(messages, {
      currentPath: body.currentPath,
      now: new Date(),
    })
    if (plan) planner = 'openai'
  } catch {
    plan = null
  }

  if (!plan) {
    plan = planLocalSyncResponse(messages, {
      currentPath: body.currentPath,
      now: new Date(),
    })
  }

  const actions = buildActionEnvelopes(auth.user.id, plan.actions)
  await Promise.all(actions.map((item) =>
    logAiAuditEvent(auth.supabase, auth.user, {
      sessionId: body.sessionId,
      action: item.action,
      status: 'planned',
      model: planner === 'openai' ? model : 'local',
    })
  ))

  return NextResponse.json({
    message: { role: 'assistant', content: plan.reply },
    actions,
    planner,
    model: planner === 'openai' ? model : 'local',
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
