import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { verifyActionToken } from '@/lib/assistant/action-token'
import { logAiAuditEvent } from '@/lib/assistant/audit'
import { executeServerAssistantAction } from '@/lib/assistant/executor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ConfirmRequest = {
  token?: string
  sessionId?: string
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as ConfirmRequest
  if (!body.token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const action = verifyActionToken(body.token, auth.user.id)
  if (!action) return NextResponse.json({ error: 'Invalid or expired action' }, { status: 400 })

  await logAiAuditEvent(auth.supabase, auth.user, {
    sessionId: body.sessionId,
    action,
    status: 'confirmed',
  })

  try {
    const result = await executeServerAssistantAction(auth, action)
    await logAiAuditEvent(auth.supabase, auth.user, {
      sessionId: body.sessionId,
      action,
      status: 'executed',
    })
    return NextResponse.json(result)
  } catch (error) {
    await logAiAuditEvent(auth.supabase, auth.user, {
      sessionId: body.sessionId,
      action,
      status: 'failed',
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 }
    )
  }
}
